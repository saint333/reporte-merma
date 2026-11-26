-- ============================================================
-- 0005 · Hash de identidad con el motivo del catálogo
-- ============================================================
-- El ETL calculaba hash_fila con el texto crudo del Excel y el alta manual
-- con el motivo resuelto. Un mismo evento escrito con un alias generaba dos
-- hashes distintos y podía insertarse dos veces (una por cada vía).
-- Desde esta migración la identidad depende siempre de motivo_codigo;
-- motivo_original se conserva solo como trazabilidad.

update merma.fact_merma
   set hash_fila = encode(
         sha256(convert_to(
           concat(
             fecha::text, '|',
             codigo_material::text, '|',
             cantidad::text, '|',
             motivo_codigo
           ),
           'UTF8'
         )),
         'hex'
       )
 where hash_fila is distinct from encode(
         sha256(convert_to(
           concat(
             fecha::text, '|',
             codigo_material::text, '|',
             cantidad::text, '|',
             motivo_codigo
           ),
           'UTF8'
         )),
         'hex'
       );
