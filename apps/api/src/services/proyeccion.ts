import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { SerieInsuficiente } from "../http/errores.js";
import { whereRango, type ProyeccionQuery } from "../http/filtros.js";

const REDONDEO = Decimal.ROUND_HALF_UP;

function dinero(valor: Decimal): string {
  return valor.toDecimalPlaces(4, REDONDEO).toFixed(4);
}

type FilaSemana = { semana_iso: number; costo: string };

export async function obtenerProyeccion(pool: Pool, filtros: ProyeccionQuery) {
  const rango = whereRango(filtros.desde, filtros.hasta);

  const [semanas, controlable, parametros] = await Promise.all([
    pool.query<FilaSemana>(
      `
      select semana_iso,
             sum(costo_total)::numeric(16,4)::text as costo
      from merma.fact_merma r
      where ${rango.sql}
      group by semana_iso
      order by semana_iso
      `,
      rango.params,
    ),
    pool.query<{ controlable: string }>(
      `
      select coalesce(
               sum(r.costo_total) filter (where mo.gestionabilidad = 'Controlable'),
               0
             )::numeric(16,4)::text as controlable
      from merma.fact_merma r
      join merma.dim_motivo mo on mo.codigo = r.motivo_codigo
      where ${rango.sql}
      `,
      rango.params,
    ),
    pool.query<{ clave: string; valor: string }>(
      `select clave, valor::text as valor
         from merma.parametro
        where clave in (
          'meta_reduccion_controlable',
          'semanas_restantes',
          'umbral_semana_atipica'
        )`,
    ),
  ]);

  const valores = new Map(parametros.rows.map((fila) => [fila.clave, fila.valor]));
  const umbral = new Decimal(
    String(filtros.umbral_atipico ?? valores.get("umbral_semana_atipica") ?? 3000),
  );
  const metaReduccion = new Decimal(
    String(
      filtros.meta_reduccion ??
        valores.get("meta_reduccion_controlable") ??
        0.25,
    ),
  );
  const semanasRestantes =
    filtros.semanas_restantes ?? Number(valores.get("semanas_restantes") ?? 6);

  const filas = semanas.rows.map((fila) => ({
    semana_iso: fila.semana_iso,
    costo: new Decimal(fila.costo),
  }));

  const total = filas.reduce(
    (acumulado, fila) => acumulado.plus(fila.costo),
    new Decimal(0),
  );

  if (filas.length === 0 || total.lte(0)) {
    throw new SerieInsuficiente(
      "No hay datos en el rango para proyectar el cierre",
    );
  }

  const validas = filas.filter((fila) => fila.costo.lt(umbral));
  if (validas.length < 4) {
    throw new SerieInsuficiente(
      "Se necesitan al menos 4 semanas válidas para proyectar",
      { semanas_validas: validas.length, umbral: umbral.toFixed(2) },
    );
  }

  const promedioGlobal = total.div(filas.length);
  const promedioAjustado = validas
    .reduce((acumulado, fila) => acumulado.plus(fila.costo), new Decimal(0))
    .div(validas.length);

  const controlableTotal = new Decimal(controlable.rows[0]?.controlable ?? 0);
  const proporcionControlable = controlableTotal
    .div(total)
    .toDecimalPlaces(4, REDONDEO);

  const tasaMeta = promedioAjustado.mul(
    new Decimal(1).minus(metaReduccion.mul(proporcionControlable)),
  );

  const tendencial = total.plus(promedioGlobal.mul(semanasRestantes));
  const base = total.plus(promedioAjustado.mul(semanasRestantes));
  const meta = total.plus(tasaMeta.mul(semanasRestantes));

  return {
    parametros: {
      acumulado: dinero(total),
      semanas_observadas: filas.length,
      promedio_global: dinero(promedioGlobal),
      promedio_ajustado: dinero(promedioAjustado),
      semanas_excluidas: filas
        .filter((fila) => fila.costo.gte(umbral))
        .map((fila) => fila.semana_iso),
      semanas_restantes: semanasRestantes,
      meta_reduccion: metaReduccion.toNumber(),
      proporcion_controlable: proporcionControlable.toFixed(4),
    },
    escenarios: [
      {
        id: "tendencial",
        nombre: "A. Tendencial histórico",
        tasa: dinero(promedioGlobal),
        proyeccion_6s: dinero(promedioGlobal.mul(semanasRestantes)),
        cierre: dinero(tendencial),
        ahorro: "0.0000",
      },
      {
        id: "base",
        nombre: "B. Base operativo",
        tasa: dinero(promedioAjustado),
        proyeccion_6s: dinero(promedioAjustado.mul(semanasRestantes)),
        cierre: dinero(base),
        ahorro: dinero(tendencial.minus(base)),
      },
      {
        id: "meta",
        nombre: "C. Meta optimizada",
        tasa: dinero(tasaMeta),
        proyeccion_6s: dinero(tasaMeta.mul(semanasRestantes)),
        cierre: dinero(meta),
        ahorro: dinero(tendencial.minus(meta)),
      },
    ],
  };
}
