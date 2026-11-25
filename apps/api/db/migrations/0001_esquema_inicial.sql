-- ============================================================
-- 0001 · Esquema inicial del Reporte de Merma
-- PostgreSQL 16
-- ============================================================

create schema if not exists merma;

-- ============================================================
-- 1. Catálogo de motivos (13 filas, ver 0003)
-- ============================================================
create table merma.dim_motivo (
  codigo             text primary key,
  categoria          text not null,
  area_responsable   text not null,
  gestionabilidad    text not null
                     check (gestionabilidad in
                       ('Controlable', 'Estándar Técnico', 'Por Auditar', 'Recuperable Proveedor')),
  accion_correctiva  text,
  activo             boolean not null default true
);

-- Alias para unificar variantes de digitación (MALA IMPRESIÓN, etc.)
create table merma.dim_motivo_alias (
  alias          text primary key,
  motivo_codigo  text not null references merma.dim_motivo(codigo),
  creado_en      timestamptz not null default now()
);

-- ============================================================
-- 2. Catálogo de materiales (108 filas, se cargan en el Paso 2)
-- ============================================================
create table merma.dim_material (
  codigo               bigint primary key,
  descripcion          text not null,
  um                   text not null,
  valor_unitario       numeric(16,10) not null check (valor_unitario >= 0),
  cod_subgrupo         text,
  grupo_material       text not null,
  programa             text not null,
  unidades_por_pallet  integer not null check (unidades_por_pallet > 0),
  activo               boolean not null default true,
  actualizado_en       timestamptz not null default now()
);

create index ix_material_grupo    on merma.dim_material (grupo_material);
create index ix_material_programa on merma.dim_material (programa);

-- ============================================================
-- 3. Control de cargas
-- ============================================================
create table merma.carga (
  id                bigserial primary key,
  archivo           text not null,
  hash_archivo      text not null,
  filas_leidas      integer not null default 0,
  filas_insertadas  integer not null default 0,
  filas_duplicadas  integer not null default 0,
  filas_observadas  integer not null default 0,
  desde             date,
  hasta             date,
  estado            text not null default 'en_proceso'
                    check (estado in ('en_proceso', 'completada', 'fallida', 'revertida')),
  detalle           jsonb not null default '{}'::jsonb,
  creada_en         timestamptz not null default now()
);

-- Una sola carga vigente por archivo. Las revertidas se conservan como historial,
-- por eso el índice es parcial y no un unique de columna.
create unique index ux_carga_hash_vigente
  on merma.carga (hash_archivo)
  where estado in ('en_proceso', 'completada');

-- ============================================================
-- 4. Hecho: eventos de merma
-- ============================================================
create table merma.fact_merma (
  id                  bigserial primary key,
  carga_id            bigint not null references merma.carga(id),
  fecha               date not null,
  semana_iso          smallint not null check (semana_iso between 1 and 53),
  mes                 char(7) not null,
  codigo_material     bigint not null references merma.dim_material(codigo),
  cantidad            numeric(16,4) not null check (cantidad > 0),
  motivo_codigo       text not null references merma.dim_motivo(codigo),
  motivo_original     text,
  valor_unitario      numeric(16,10) not null,
  costo_total         numeric(16,4) not null check (costo_total >= 0),
  origen_fila         integer,
  hash_fila           text not null,
  es_duplicado        boolean not null default false,
  creado_en           timestamptz not null default now()
);

create index ix_fact_fecha    on merma.fact_merma (fecha);
create index ix_fact_mes      on merma.fact_merma (mes);
create index ix_fact_semana   on merma.fact_merma (semana_iso);
create index ix_fact_material on merma.fact_merma (codigo_material);
create index ix_fact_motivo   on merma.fact_merma (motivo_codigo);
create index ix_fact_hash     on merma.fact_merma (hash_fila);
create index ix_fact_dup      on merma.fact_merma (es_duplicado) where es_duplicado;

-- ============================================================
-- 5. Parámetros de escenario (ver 0003)
-- ============================================================
create table merma.parametro (
  clave          text primary key,
  valor          numeric(16,6) not null,
  etiqueta       text not null,
  descripcion    text,
  actualizado_en timestamptz not null default now()
);
