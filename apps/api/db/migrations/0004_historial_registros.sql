-- ============================================================
-- 0004 · Historial de cambios de los eventos de merma
-- ============================================================

-- Auditoría de altas, ediciones y eliminaciones. No tiene FK hacia
-- fact_merma porque el hecho puede eliminarse y su rastro debe quedar.
create table merma.fact_merma_historial (
  id                 bigserial primary key,
  fact_id            bigint not null,
  carga_id           bigint references merma.carga(id),
  codigo_material    bigint not null references merma.dim_material(codigo),
  accion             text not null
                     check (accion in ('crear', 'editar', 'eliminar')),
  datos_anteriores   jsonb,
  datos_nuevos       jsonb,
  cambiado_en        timestamptz not null default now()
);

create index ix_hist_material
  on merma.fact_merma_historial (codigo_material, cambiado_en desc);
create index ix_hist_fact
  on merma.fact_merma_historial (fact_id, cambiado_en desc);
create index ix_hist_fecha
  on merma.fact_merma_historial (cambiado_en desc);

-- Línea base: cada hecho existente queda registrado como su alta, con la
-- fecha de la carga que lo trajo. Así el historial de cada producto arranca
-- con los eventos que ya estaban en la base.
insert into merma.fact_merma_historial
  (fact_id, carga_id, codigo_material, accion, datos_anteriores, datos_nuevos, cambiado_en)
select
  r.id,
  r.carga_id,
  r.codigo_material,
  'crear',
  null,
  jsonb_build_object(
    'fecha', r.fecha::text,
    'semana_iso', r.semana_iso,
    'mes', r.mes::text,
    'codigo_material', r.codigo_material::int,
    'descripcion', m.descripcion,
    'cantidad', r.cantidad::text,
    'um', m.um,
    'motivo', r.motivo_codigo,
    'motivo_original', r.motivo_original,
    'valor_unitario', r.valor_unitario::text,
    'costo_total', r.costo_total::text,
    'origen_fila', r.origen_fila
  ),
  c.creada_en
from merma.fact_merma r
join merma.dim_material m on m.codigo = r.codigo_material
join merma.carga c on c.id = r.carga_id;
