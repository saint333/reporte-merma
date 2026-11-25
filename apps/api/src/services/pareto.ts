import type { Pool } from "pg";

import { where, type ParetoQuery } from "../http/filtros.js";

type FilaParetoSql = {
  rank: number;
  codigo: number;
  descripcion: string;
  familia: string;
  programa: string;
  eventos: number;
  cantidad: string;
  costo: string;
  participacion: string;
  acumulado: string;
  clase_abc: string;
};

export type FilaPareto = FilaParetoSql & {
  rank: number;
  prioridad: string;
};

export type ResumenPareto = {
  skus: number;
  clase_a: number;
  clase_b: number;
  clase_c: number;
  costo_top: string;
  participacion_top: string;
};

function prioridad(clase: string): string {
  if (clase.startsWith("A")) return "CRÍTICO (A)";
  if (clase.startsWith("B")) return "ALTO IMPACTO";
  return "BAJO IMPACTO";
}

function consultaBase(filtro: { sql: string }, limite: number) {
  return `
    with base as (
      select r.codigo_material,
             m.descripcion,
             m.grupo_material as familia,
             m.programa,
             count(*)::int as eventos,
             sum(r.cantidad)::numeric(16,4) as cantidad,
             sum(r.costo_total)::numeric(16,4) as costo
      from merma.fact_merma r
      join merma.dim_material m on m.codigo = r.codigo_material
      join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
      where ${filtro.sql}
      group by 1, 2, 3, 4
      having sum(r.costo_total) > 0
    ),
    total as (
      select sum(costo) as total_global, count(*)::int as skus
      from base
    ),
    ordenado as (
      select b.*,
             row_number() over (order by b.costo desc, b.codigo_material)::int as rank,
             sum(b.costo) over (
               order by b.costo desc, b.codigo_material
               rows between unbounded preceding and current row
             ) as acumulado,
             t.total_global
      from base b
      cross join total t
    ),
    clasificado as (
      select *,
             case
               when acumulado / nullif(total_global, 0) <= 0.80 then 'A (Crítico)'
               when acumulado / nullif(total_global, 0) <= 0.95 then 'B (Moderado)'
               else 'C (Bajo)'
             end as clase_abc
      from ordenado
    )
    select rank,
           codigo_material::int as codigo,
           descripcion,
           familia,
           programa,
           eventos,
           cantidad::text as cantidad,
           costo::text as costo,
           (costo / nullif(total_global, 0))::numeric(12,6)::text as participacion,
           (acumulado / nullif(total_global, 0))::numeric(12,6)::text as acumulado,
           clase_abc
    from clasificado
    order by rank
    limit $${limite}
  `;
}

export async function obtenerPareto(
  pool: Pool,
  filtros: ParetoQuery,
): Promise<{ filas: FilaPareto[]; resumen: ResumenPareto }> {
  const filtro = where(filtros);
  const parametroLimite = filtro.params.length + 1;

  const [datos, resumen] = await Promise.all([
    pool.query<FilaParetoSql>(consultaBase(filtro, parametroLimite), [
      ...filtro.params,
      filtros.limite,
    ]),
    pool.query<ResumenPareto>(
      `
      with base as (
        select r.codigo_material,
               count(*)::int as eventos,
               sum(r.cantidad)::numeric(16,4) as cantidad,
               sum(r.costo_total)::numeric(16,4) as costo
        from merma.fact_merma r
        join merma.dim_material m on m.codigo = r.codigo_material
        join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
        where ${filtro.sql}
        group by 1
        having sum(r.costo_total) > 0
      ),
      total as (
        select sum(costo) as total_global, count(*)::int as skus
        from base
      ),
      ordenado as (
        select b.*,
               row_number() over (order by b.costo desc, b.codigo_material)::int as rank,
               sum(b.costo) over (
                 order by b.costo desc, b.codigo_material
                 rows between unbounded preceding and current row
               ) as acumulado,
               t.total_global
        from base b
        cross join total t
      ),
      clasificado as (
        select *,
               case
                 when acumulado / nullif(total_global, 0) <= 0.80 then 'A (Crítico)'
                 when acumulado / nullif(total_global, 0) <= 0.95 then 'B (Moderado)'
                 else 'C (Bajo)'
               end as clase_abc
        from ordenado
      )
      select count(*)::int as skus,
             count(*) filter (where clase_abc like 'A%')::int as clase_a,
             count(*) filter (where clase_abc like 'B%')::int as clase_b,
             count(*) filter (where clase_abc like 'C%')::int as clase_c,
             coalesce(
               sum(costo) filter (where rank <= $${parametroLimite}),
               0
             )::numeric(16,4)::text as costo_top,
             coalesce(
               sum(costo / nullif(total_global, 0)) filter (where rank <= $${parametroLimite}),
               0
             )::numeric(12,6)::text as participacion_top
      from clasificado
      `,
      [...filtro.params, filtros.limite],
    ),
  ]);

  const filas = datos.rows.map((fila) => ({
    ...fila,
    prioridad: prioridad(fila.clase_abc),
  }));

  return {
    filas,
    resumen:
      resumen.rows[0] ?? {
        skus: 0,
        clase_a: 0,
        clase_b: 0,
        clase_c: 0,
        costo_top: "0.0000",
        participacion_top: "0.000000",
      },
  };
}
