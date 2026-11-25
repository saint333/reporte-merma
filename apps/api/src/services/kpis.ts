import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { where, type Filtros } from "../http/filtros.js";

type FilaKpis = {
  merma_total: string;
  eventos: number;
  merma_controlable: string;
  pallets_equiv: string;
  skus_con_merma: number;
  skus_total: number;
  filas_base: number;
  semana_pico: { semana_iso: number; costo: string } | null;
  ultimas: { semana_iso: number; costo: string }[] | null;
};

export type Kpis = {
  merma_total: string;
  eventos: number;
  ticket_promedio: string;
  merma_controlable: string;
  controlable_pct: number;
  pallets_equiv: string;
  skus_con_merma: number;
  skus_total: number;
  semana_pico: { semana_iso: number; costo: string } | null;
  variacion_ultima_semana: number | null;
};

export async function obtenerKpis(
  pool: Pool,
  filtros: Filtros,
): Promise<{ kpis: Kpis; filasBase: number }> {
  const filtro = where(filtros);

  const { rows } = await pool.query<FilaKpis>(
    `
    with base as (
      select r.fecha, r.mes, r.semana_iso, r.costo_total, r.cantidad,
             m.unidades_por_pallet, m.programa, m.grupo_material,
             mo.gestionabilidad, r.codigo_material
      from merma.fact_merma r
      join merma.dim_material m on m.codigo = r.codigo_material
      join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
      where ${filtro.sql}
    ),
    totales as (
      select
        coalesce(sum(costo_total), 0)::numeric(16,4) as merma_total,
        count(*)::int as eventos,
        coalesce(sum(costo_total) filter (where gestionabilidad = 'Controlable'), 0)::numeric(16,4) as merma_controlable,
        coalesce(round(sum(cantidad / unidades_por_pallet), 6), 0)::numeric(16,6) as pallets_equiv,
        count(distinct codigo_material) filter (where costo_total > 0)::int as skus_con_merma
      from base
    ),
    por_semana as (
      select semana_iso, sum(costo_total) as costo
      from base
      group by semana_iso
    ),
    ultimas as (
      select semana_iso, costo
      from por_semana
      order by semana_iso desc
      limit 2
    )
    select
      t.merma_total::text as merma_total,
      t.eventos,
      t.merma_controlable::text as merma_controlable,
      t.pallets_equiv::text as pallets_equiv,
      t.skus_con_merma,
      (select count(*)::int from merma.dim_material where activo) as skus_total,
      (select count(*)::int from merma.fact_merma) as filas_base,
      (select json_build_object('semana_iso', semana_iso, 'costo', round(costo, 4)::text)
         from por_semana
        order by costo desc, semana_iso asc
        limit 1) as semana_pico,
      (select json_agg(json_build_object('semana_iso', semana_iso, 'costo', costo::text)
                       order by semana_iso desc)
         from ultimas) as ultimas
    from totales t
    `,
    filtro.params,
  );

  const fila = rows[0];
  if (!fila) throw new Error("La consulta de KPIs no devolvió filas");

  const total = new Decimal(fila.merma_total);
  const controlable = new Decimal(fila.merma_controlable);

  const ticket =
    fila.eventos > 0
      ? total.dividedBy(fila.eventos).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)
      : "0.0000";

  const controlablePct = total.gt(0)
    ? controlable.dividedBy(total).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber()
    : 0;

  const [ultima, anterior] = fila.ultimas ?? [];
  let variacion: number | null = null;
  if (ultima && anterior) {
    const costoActual = new Decimal(ultima.costo);
    const costoAnterior = new Decimal(anterior.costo);
    if (costoAnterior.gt(0)) {
      variacion = costoActual
        .minus(costoAnterior)
        .dividedBy(costoAnterior)
        .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
        .toNumber();
    }
  }

  return {
    kpis: {
      merma_total: fila.merma_total,
      eventos: fila.eventos,
      ticket_promedio: ticket,
      merma_controlable: fila.merma_controlable,
      controlable_pct: controlablePct,
      pallets_equiv: fila.pallets_equiv,
      skus_con_merma: fila.skus_con_merma,
      skus_total: fila.skus_total,
      semana_pico: fila.semana_pico,
      variacion_ultima_semana: variacion,
    },
    filasBase: fila.filas_base,
  };
}
