-- Controles de calidad del Paso 6 (docs/08 §6). Todos deben devolver 0.
select
  (select count(*)
     from merma.fact_merma r
     left join merma.dim_material m on m.codigo = r.codigo_material
    where m.codigo is null)                                                 as materiales_huerfanos,
  (select count(*)
     from merma.fact_merma
    where costo_total < 0 or costo_total is null)                           as costos_invalidos,
  (select count(*)
     from merma.fact_merma
    where abs(costo_total - round(cantidad * valor_unitario, 4)) > 0.0001)  as costo_recalculado,
  (select count(*)
     from merma.fact_merma
    where semana_iso <> extract(week from fecha))                           as semana_iso,
  (select count(*)
     from merma.fact_merma r
     left join merma.dim_motivo m on m.codigo = r.motivo_codigo
    where m.codigo is null)                                                 as motivos_huerfanos,
  (select count(*) from merma.fact_merma)                                   as hechos,
  (select coalesce(round(sum(costo_total), 4), 0)
     from merma.fact_merma)                                                 as costo_total;
