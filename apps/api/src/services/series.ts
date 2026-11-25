import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { where, type Filtros, type SerieSemanalQuery } from "../http/filtros.js";

type FilaMensual = { mes: string; eventos: number; costo: string };
type FilaSemanal = {
  semana_iso: number;
  inicio: string;
  eventos: number;
  costo: string;
};

export type TotalSerie = { eventos: number; costo: string };

const REDONDEO = Decimal.ROUND_HALF_UP;

function aDinero(valor: Decimal): string {
  return valor.toDecimalPlaces(4, REDONDEO).toFixed(4);
}

export async function obtenerSerieMensual(
  pool: Pool,
  filtros: Filtros,
): Promise<{ filas: (FilaMensual & { participacion: string })[]; total: TotalSerie }> {
  const filtro = where(filtros);
  const { rows } = await pool.query<FilaMensual>(
    `
    select r.mes::text as mes,
           count(*)::int as eventos,
           sum(r.costo_total)::numeric(16,4)::text as costo
    from merma.fact_merma r
    join merma.dim_material m on m.codigo = r.codigo_material
    join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
    where ${filtro.sql}
    group by r.mes
    order by r.mes
    `,
    filtro.params,
  );

  const totalCosto = rows.reduce(
    (acumulado, fila) => acumulado.plus(fila.costo),
    new Decimal(0),
  );
  const totalEventos = rows.reduce((acumulado, fila) => acumulado + fila.eventos, 0);

  return {
    filas: rows.map((fila) => ({
      ...fila,
      participacion: totalCosto.gt(0)
        ? new Decimal(fila.costo).div(totalCosto).toDecimalPlaces(4, REDONDEO).toFixed(4)
        : "0.0000",
    })),
    total: { eventos: totalEventos, costo: aDinero(totalCosto) },
  };
}

export async function obtenerSerieSemanal(
  pool: Pool,
  filtros: SerieSemanalQuery,
): Promise<{
  filas: Record<string, unknown>[];
  total: TotalSerie;
  resumen: {
    semanas: number;
    promedio: string;
    promedio_ajustado: string;
    umbral: string;
  };
}> {
  const filtro = where(filtros);

  const [semanas, parametro] = await Promise.all([
    pool.query<FilaSemanal>(
      `
      with semanas as (
        select generate_series(
                 date_trunc('week', $1::date),
                 date_trunc('week', $2::date),
                 interval '7 days'
               )::date as inicio
      ),
      base as (
        select date_trunc('week', r.fecha)::date as inicio,
               count(*)::int as eventos,
               sum(r.costo_total)::numeric(16,4) as costo
        from merma.fact_merma r
        join merma.dim_material m on m.codigo = r.codigo_material
        join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
        where ${filtro.sql}
        group by 1
      )
      select to_char(s.inicio, 'IW')::int as semana_iso,
             s.inicio::text as inicio,
             coalesce(b.eventos, 0)::int as eventos,
             coalesce(b.costo, 0)::numeric(16,4)::text as costo
      from semanas s
      left join base b using (inicio)
      order by s.inicio
      `,
      filtro.params,
    ),
    pool.query<{ valor: string }>(
      "select valor::text from merma.parametro where clave = 'umbral_semana_atipica'",
    ),
  ]);

  const umbral = new Decimal(parametro.rows[0]?.valor ?? 3000);
  const filasBase = semanas.rows.map((fila) => ({
    ...fila,
    costoDecimal: new Decimal(fila.costo),
  }));

  const filas = filasBase.map((fila, indice) => {
    const anterior = indice > 0 ? filasBase[indice - 1] : undefined;
    const wowCosto =
      anterior !== undefined
        ? aDinero(fila.costoDecimal.minus(anterior.costoDecimal))
        : null;
    const wowPct =
      anterior !== undefined && anterior.costoDecimal.gt(0)
        ? fila.costoDecimal
            .minus(anterior.costoDecimal)
            .div(anterior.costoDecimal)
            .toDecimalPlaces(4, REDONDEO)
            .toNumber()
        : null;

    return {
      semana_iso: fila.semana_iso,
      inicio: fila.inicio,
      eventos: fila.eventos,
      costo: fila.costo,
      ...(filtros.incluir_wow ? { wow_costo: wowCosto, wow_pct: wowPct } : {}),
      es_atipica: fila.costoDecimal.gte(umbral),
    };
  });

  const totalCosto = filasBase.reduce(
    (acumulado, fila) => acumulado.plus(fila.costoDecimal),
    new Decimal(0),
  );
  const totalEventos = filasBase.reduce((acumulado, fila) => acumulado + fila.eventos, 0);

  const promedio = filasBase.length
    ? totalCosto.div(filasBase.length)
    : new Decimal(0);

  const validas = filasBase.filter((fila) => fila.costoDecimal.lt(umbral));
  const promedioAjustado = validas.length
    ? validas
        .reduce((acumulado, fila) => acumulado.plus(fila.costoDecimal), new Decimal(0))
        .div(validas.length)
    : new Decimal(0);

  return {
    filas,
    total: { eventos: totalEventos, costo: aDinero(totalCosto) },
    resumen: {
      semanas: filasBase.length,
      promedio: aDinero(promedio),
      promedio_ajustado: aDinero(promedioAjustado),
      umbral: umbral.toFixed(2),
    },
  };
}
