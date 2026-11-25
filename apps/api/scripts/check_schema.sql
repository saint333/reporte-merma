-- Verificación del Paso 1. Una sola fila con los conteos del esquema.
select
  (select count(*)
     from information_schema.tables
    where table_schema = 'merma' and table_type = 'BASE TABLE') as tablas,
  (select count(*)
     from information_schema.views
    where table_schema = 'merma') as vistas,
  (select count(*) from merma.dim_motivo)        as motivos,
  (select count(*) from merma.dim_motivo_alias)  as alias,
  (select count(*) from merma.parametro)         as parametros,
  (select count(*) from merma.dim_material)      as materiales,
  (select count(*) from merma.fact_merma)        as hechos;
