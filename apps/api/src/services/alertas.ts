import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { where, type Filtros } from "../http/filtros.js";

type SinClasificar = {
  fecha: string;
  semana_iso: number;
  n: number;
  costo: string;
};

type Pico = {
  semana_iso: number;
  costo: string;
  eventos: number;
};

type Resumen = {
  eventos: number;
  costo: string;
};

type TopSku = {
  codigo: number;
  descripcion: string;
  eventos: number;
  costo: string;
  participacion: string;
};

type Semana = { semana_iso: number; costo: string };

type AliasCarga = {
  motivo?: string;
  filas?: number[];
  costo?: string;
};

const formatoMonto = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function monto(valor: string): string {
  return `$${formatoMonto.format(Number(valor))}`;
}

function porcentaje(valor: Decimal): string {
  return `${valor.mul(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1)}%`;
}

function fechaCorta(fecha: string): string {
  const [anio = "", mes = "", dia = ""] = fecha.split("-");
  return `${dia}/${mes}/${anio}`;
}

export type Alerta = {
  id: string;
  severidad: "alta" | "media" | "baja";
  icono: string;
  titulo: string;
  detalle: string;
  valor: string;
  eventos: number;
  accion?: { texto: string; filtro: string };
};

export async function obtenerAlertas(
  pool: Pool,
  filtros: Filtros,
): Promise<Alerta[]> {
  const filtro = where(filtros);
  const desdeSql = `
    from merma.fact_merma r
    join merma.dim_material m on m.codigo = r.codigo_material
    join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
  `;

  const [sinClasificar, duplicados, resumen, topSku, semanas, carga] =
    await Promise.all([
      pool.query<SinClasificar>(
        `
        select r.fecha::text as fecha,
               r.semana_iso,
               count(*)::int as n,
               sum(r.costo_total)::numeric(16,4)::text as costo
        ${desdeSql}
        where ${filtro.sql} and mo.gestionabilidad = 'Por Auditar'
        group by r.fecha, r.semana_iso
        order by r.fecha
        `,
        filtro.params,
      ),
      pool.query<{ n: number; costo: string }>(
        `
        select count(*)::int as n,
               coalesce(sum(r.costo_total), 0)::numeric(16,4)::text as costo
        ${desdeSql}
        where ${filtro.sql} and r.es_duplicado
        `,
        filtro.params,
      ),
      pool.query<{ pico: Pico | null; total: Resumen }>(
        `
        with base as (
          select r.semana_iso, r.costo_total
          ${desdeSql}
          where ${filtro.sql}
        ),
        semanal as (
          select semana_iso, sum(costo_total) as costo, count(*)::int as eventos
          from base
          group by semana_iso
        ),
        total as (
          select count(*)::int as eventos,
                 coalesce(sum(costo_total), 0)::numeric(16,4) as costo
          from base
        )
        select (
                 select json_build_object(
                   'semana_iso', semana_iso,
                   'costo', costo::numeric(16,4)::text,
                   'eventos', eventos
                 )
                 from semanal
                 order by costo desc, semana_iso
                 limit 1
               ) as pico,
               (
                 select json_build_object(
                   'eventos', eventos,
                   'costo', costo::text
                 )
                 from total
               ) as total
        `,
        filtro.params,
      ),
      pool.query<TopSku>(
        `
        with base as (
          select r.codigo_material,
                 m.descripcion,
                 count(*)::int as eventos,
                 sum(r.costo_total)::numeric(16,4) as costo
          ${desdeSql}
          where ${filtro.sql}
          group by r.codigo_material, m.descripcion
          having sum(r.costo_total) > 0
        ),
        total as (
          select sum(costo) as costo_total
          from base
        ),
        ordenado as (
          select b.*,
                 row_number() over (order by b.costo desc, b.codigo_material)::int as rank,
                 (b.costo / nullif(t.costo_total, 0))::numeric(12,6) as participacion
          from base b
          cross join total t
        )
        select codigo_material::int as codigo,
               descripcion,
               eventos,
               costo::text as costo,
               participacion::text as participacion
        from ordenado
        where rank = 1
        `,
        filtro.params,
      ),
      pool.query<Semana>(
        `
        select r.semana_iso,
               sum(r.costo_total)::numeric(16,4)::text as costo
        ${desdeSql}
        where ${filtro.sql}
        group by r.semana_iso
        order by r.semana_iso desc
        limit 2
        `,
        filtro.params,
      ),
      pool.query<{ id: number; aliases: AliasCarga[] | null }>(
        `
        select id::int as id, detalle->'motivos_alias' as aliases
        from merma.carga
        where estado = 'completada'
        order by creada_en desc, id desc
        limit 1
        `,
      ),
    ]);

  const total = resumen.rows[0]?.total ?? { eventos: 0, costo: "0.0000" };
  const pico = resumen.rows[0]?.pico ?? null;

  if (total.eventos === 0 || Number(total.costo) === 0) {
    return [
      {
        id: "sin-datos",
        severidad: "media",
        icono: "info",
        titulo: "Sin datos para el rango seleccionado",
        detalle: "Ajusta el rango de fechas o los filtros para ver alertas.",
        valor: "0.0000",
        eventos: 0,
      },
    ];
  }

  const alertas: Alerta[] = [];
  const totalDecimal = new Decimal(total.costo);

  if (sinClasificar.rows.length > 0) {
    const eventos = sinClasificar.rows.reduce((suma, fila) => suma + fila.n, 0);
    const costo = sinClasificar.rows.reduce(
      (suma, fila) => suma.plus(fila.costo),
      new Decimal(0),
    );
    const fechas = [...new Set(sinClasificar.rows.map((fila) => fila.fecha))];
    const detalle =
      fechas.length === 1
        ? `Todos del ${fechaCorta(fechas[0] ?? "")} (semana ${
            sinClasificar.rows[0]?.semana_iso
          }). Requiere cierre con Jefatura de Turno.`
        : `Repartidos en ${fechas.length} fechas. Requiere cierre con Jefatura de Turno.`;

    alertas.push({
      id: "sin-clasificar",
      severidad: "alta",
      icono: "alert-triangle",
      titulo: `${eventos} registros sin motivo por ${monto(costo.toFixed(4))}`,
      detalle,
      accion: {
        texto: "Ver registros",
        filtro: "/registros?motivo=SIN%20CLASIFICAR",
      },
      valor: costo.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
      eventos,
    });
  }

  const duplicadosFila = duplicados.rows[0];
  if (duplicadosFila && duplicadosFila.n > 0) {
    alertas.push({
      id: "duplicados",
      severidad: "media",
      icono: "alert-triangle",
      titulo: `${duplicadosFila.n} posibles duplicados`,
      detalle:
        "Filas idénticas en fecha, código, cantidad y motivo. Se suman y se reportan.",
      valor: duplicadosFila.costo,
      eventos: duplicadosFila.n,
    });
  }

  const cargaActual = carga.rows[0];
  for (const alias of cargaActual?.aliases ?? []) {
    if (!alias.motivo || !alias.filas?.length) continue;

    const { rows } = await pool.query<{ n: number; costo: string }>(
      `
      select count(*)::int as n,
             coalesce(sum(r.costo_total), 0)::numeric(16,4)::text as costo
      from merma.fact_merma r
      where r.carga_id = $1
        and r.origen_fila = any($2::int[])
      `,
      [cargaActual?.id, alias.filas],
    );

    const fila = rows[0];
    if (!fila || fila.n === 0) continue;

    alertas.push({
      id: "motivo-huerfano",
      severidad: "media",
      icono: "alert-triangle",
      titulo: `Motivo no catalogado: ${alias.motivo}`,
      detalle:
        "Se resolvió por alias al motivo del catálogo. Revisar la digitación en origen.",
      valor: fila.costo,
      eventos: fila.n,
    });
  }

  if (pico) {
    const picoCosto = new Decimal(pico.costo);
    const participacion = picoCosto.div(totalDecimal);
    alertas.push({
      id: "pico-semanal",
      severidad: participacion.gt(0.25) ? "alta" : "media",
      icono: "alert-triangle",
      titulo: `La semana ${pico.semana_iso} concentra ${porcentaje(
        participacion,
      )} de la merma`,
      detalle: `Semana ISO ${pico.semana_iso} con ${
        pico.eventos
      } eventos y ${monto(pico.costo)}.`,
      valor: pico.costo,
      eventos: pico.eventos,
    });
  }

  const sku = topSku.rows[0];
  if (sku) {
    const participacion = new Decimal(sku.participacion);
    if (participacion.gt(0.2)) {
      alertas.push({
        id: "concentracion-sku",
        severidad: "alta",
        icono: "alert-triangle",
        titulo: `1 SKU concentra ${porcentaje(participacion)} del costo (${
          sku.descripcion
        })`,
        detalle: `Código ${sku.codigo} con ${sku.eventos} eventos y ${monto(
          sku.costo,
        )}.`,
        accion: {
          texto: "Ver registros",
          filtro: `/registros?codigo=${sku.codigo}`,
        },
        valor: sku.costo,
        eventos: sku.eventos,
      });
    }
  }

  const [ultima, anterior] = semanas.rows;
  if (ultima && anterior) {
    const costoUltima = new Decimal(ultima.costo);
    const costoAnterior = new Decimal(anterior.costo);
    if (costoAnterior.gt(0)) {
      const variacion = costoUltima.minus(costoAnterior).div(costoAnterior);
      if (variacion.abs().gte(0.5)) {
        const sentido = variacion.isNegative() ? "Caída" : "Aumento";
        alertas.push({
          id: "variacion-wow",
          severidad: "media",
          icono: "alert-triangle",
          titulo: `${sentido} de ${porcentaje(
            variacion.abs(),
          )} en la última semana`,
          detalle: `Semana ${ultima.semana_iso} frente a la semana ${anterior.semana_iso}.`,
          valor: variacion
            .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
            .toFixed(4),
          eventos: 0,
        });
      }
    }
  }

  return alertas;
}
