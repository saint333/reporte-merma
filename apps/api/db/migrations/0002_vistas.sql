-- ============================================================
-- 0002 · Vistas de apoyo
-- ============================================================

-- Vista plana: evita repetir joins en cada consulta
create or replace view merma.v_registro as
select
  r.id,
  r.fecha,
  r.mes,
  r.semana_iso,
  r.codigo_material,
  m.descripcion,
  m.um,
  m.grupo_material as familia,
  m.programa,
  m.unidades_por_pallet,
  r.cantidad,
  (r.cantidad / m.unidades_por_pallet)::numeric(16,6) as pallets_equiv,
  r.motivo_codigo,
  mo.gestionabilidad as gestion,
  mo.area_responsable,
  r.valor_unitario,
  r.costo_total,
  r.es_duplicado,
  r.carga_id
from merma.fact_merma r
join merma.dim_material m on m.codigo = r.codigo_material
join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo;

-- Pareto ABC calculado (no depende del orden físico de las filas)
create or replace view merma.v_abc as
with base as (
  select codigo_material,
         count(*)      as eventos,
         sum(cantidad) as cantidad,
         sum(costo_total) as costo
  from merma.fact_merma
  group by codigo_material
), ordenado as (
  select b.*,
         sum(costo) over () as costo_total_global,
         sum(costo) over (order by costo desc, codigo_material
                          rows between unbounded preceding and current row) as costo_acumulado
  from base b
)
select
  o.*,
  (costo / nullif(costo_total_global, 0))::numeric(12,6)           as participacion,
  (costo_acumulado / nullif(costo_total_global, 0))::numeric(12,6) as participacion_acumulada,
  case
    when costo = 0 then 'Sin Merma'
    when costo_acumulado / nullif(costo_total_global, 0) <= 0.80 then 'A (Crítico)'
    when costo_acumulado / nullif(costo_total_global, 0) <= 0.95 then 'B (Moderado)'
    else 'C (Bajo)'
  end as clase_abc
from ordenado o;
