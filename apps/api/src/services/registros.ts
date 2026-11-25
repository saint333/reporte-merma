import type { Pool } from "pg";

import { where, type RegistrosQuery } from "../http/filtros.js";

export type FilaRegistro = {
  id: number;
  fecha: string;
  semana_iso: number;
  mes: string;
  codigo_material: number;
  descripcion: string;
  familia: string;
  programa: string;
  cantidad: string;
  um: string;
  motivo: string;
  gestion: string;
  area_responsable: string;
  costo_total: string;
  es_duplicado: boolean;
  origen_fila: number | null;
};

const ORDEN: Record<RegistrosQuery["sort"], string> = {
  fecha: "r.fecha",
  costo_total: "r.costo_total",
  cantidad: "r.cantidad",
  semana_iso: "r.semana_iso",
};

function construirWhere(query: RegistrosQuery) {
  const filtro = where(query);
  const condiciones = [filtro.sql];
  const params = [...filtro.params];

  if (query.motivo) {
    params.push(query.motivo);
    condiciones.push(`r.motivo_codigo = $${params.length}`);
  }

  if (query.codigo) {
    params.push(query.codigo);
    condiciones.push(`r.codigo_material = $${params.length}::bigint`);
  }

  if (query.q) {
    params.push(`%${query.q}%`);
    condiciones.push(`(
      m.descripcion ilike $${params.length}
      or r.codigo_material::text ilike $${params.length}
      or r.motivo_codigo ilike $${params.length}
      or coalesce(r.motivo_original, '') ilike $${params.length}
    )`);
  }

  return { sql: condiciones.join(" and "), params };
}

export async function consultarRegistros(
  pool: Pool,
  query: RegistrosQuery,
): Promise<{
  filas: FilaRegistro[];
  total: number;
  pages: number;
}> {
  const filtro = construirWhere(query);
  const limite = query.per_page;
  const offset = (query.page - 1) * limite;

  const [datos, conteo] = await Promise.all([
    pool.query<FilaRegistro>(
      `
      select r.id::int as id,
             r.fecha::text as fecha,
             r.semana_iso,
             r.mes::text as mes,
             r.codigo_material::int as codigo_material,
             m.descripcion,
             m.grupo_material as familia,
             m.programa,
             r.cantidad::text as cantidad,
             m.um,
             r.motivo_codigo as motivo,
             mo.gestionabilidad as gestion,
             mo.area_responsable,
             r.costo_total::text as costo_total,
             r.es_duplicado,
             r.origen_fila
      from merma.fact_merma r
      join merma.dim_material m on m.codigo = r.codigo_material
      join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
      where ${filtro.sql}
      order by ${ORDEN[query.sort]} ${query.order}, r.id desc
      limit $${filtro.params.length + 1}
      offset $${filtro.params.length + 2}
      `,
      [...filtro.params, limite, offset],
    ),
    pool.query<{ total: number }>(
      `
      select count(*)::int as total
      from merma.fact_merma r
      join merma.dim_material m on m.codigo = r.codigo_material
      join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
      where ${filtro.sql}
      `,
      filtro.params,
    ),
  ]);

  const total = conteo.rows[0]?.total ?? 0;

  return {
    filas: datos.rows,
    total,
    pages: total === 0 ? 0 : Math.ceil(total / limite),
  };
}

export async function consultarRegistrosCsv(
  pool: Pool,
  query: RegistrosQuery,
): Promise<FilaRegistro[]> {
  const filtro = construirWhere(query);

  const { rows } = await pool.query<FilaRegistro>(
    `
    select r.id::int as id,
           r.fecha::text as fecha,
           r.semana_iso,
           r.mes::text as mes,
           r.codigo_material::int as codigo_material,
           m.descripcion,
           m.grupo_material as familia,
           m.programa,
           r.cantidad::text as cantidad,
           m.um,
           r.motivo_codigo as motivo,
           mo.gestionabilidad as gestion,
           mo.area_responsable,
           r.costo_total::text as costo_total,
           r.es_duplicado,
           r.origen_fila
    from merma.fact_merma r
    join merma.dim_material m on m.codigo = r.codigo_material
    join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
    where ${filtro.sql}
    order by ${ORDEN[query.sort]} ${query.order}, r.id desc
    limit 50000
    `,
    filtro.params,
  );

  return rows;
}
