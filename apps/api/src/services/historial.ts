import type { Pool, PoolClient } from "pg";

import { isoLima } from "../http/fechas.js";

export type AccionHistorial = "crear" | "editar" | "eliminar";

export type SnapshotRegistro = {
  fecha: string;
  semana_iso: number;
  mes: string;
  codigo_material: number;
  descripcion: string;
  cantidad: string;
  um: string;
  motivo: string;
  motivo_original: string | null;
  valor_unitario: string;
  costo_total: string;
  origen_fila: number | null;
  carga_id?: number;
};

export type CambioHistorial = {
  id: number;
  fact_id: number;
  codigo_material: number;
  descripcion: string;
  accion: AccionHistorial;
  datos_anteriores: SnapshotRegistro | null;
  datos_nuevos: SnapshotRegistro | null;
  cambiado_en: string;
};

type FilaHistorial = Omit<CambioHistorial, "cambiado_en"> & {
  cambiado_en: Date;
};

const SELECT_SNAPSHOT = `
  select r.fecha::text as fecha,
         r.semana_iso,
         r.mes::text as mes,
         r.codigo_material::int as codigo_material,
         m.descripcion,
         r.cantidad::text as cantidad,
         m.um,
         r.motivo_codigo as motivo,
         r.motivo_original,
         r.valor_unitario::text as valor_unitario,
         r.costo_total::text as costo_total,
         r.origen_fila,
         r.carga_id::int as carga_id
    from merma.fact_merma r
    join merma.dim_material m on m.codigo = r.codigo_material
   where r.id = $1`;

export async function leerSnapshot(
  ejecutor: Pool | PoolClient,
  id: number,
  bloquear = false,
): Promise<SnapshotRegistro | null> {
  const { rows } = await ejecutor.query<SnapshotRegistro>(
    `${SELECT_SNAPSHOT}${bloquear ? " for update of r" : ""}`,
    [id],
  );

  return rows[0] ?? null;
}

export async function registrarCambio(
  client: PoolClient,
  cambio: {
    factId: number;
    cargaId: number | null;
    codigoMaterial: number;
    accion: AccionHistorial;
    antes: SnapshotRegistro | null;
    despues: SnapshotRegistro | null;
  },
): Promise<void> {
  await client.query(
    `insert into merma.fact_merma_historial
       (fact_id, carga_id, codigo_material, accion,
        datos_anteriores, datos_nuevos)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [
      cambio.factId,
      cambio.cargaId,
      cambio.codigoMaterial,
      cambio.accion,
      cambio.antes ? JSON.stringify(cambio.antes) : null,
      cambio.despues ? JSON.stringify(cambio.despues) : null,
    ],
  );
}

function mapear(fila: FilaHistorial): CambioHistorial {
  return { ...fila, cambiado_en: isoLima(fila.cambiado_en) };
}

const SELECT_HISTORIAL = `
  select h.id::int as id,
         h.fact_id::int as fact_id,
         h.codigo_material::int as codigo_material,
         m.descripcion,
         h.accion,
         h.datos_anteriores,
         h.datos_nuevos,
         h.cambiado_en
    from merma.fact_merma_historial h
    join merma.dim_material m on m.codigo = h.codigo_material`;

export async function consultarHistorialRegistro(
  pool: Pool,
  factId: number,
): Promise<CambioHistorial[]> {
  const { rows } = await pool.query<FilaHistorial>(
    `${SELECT_HISTORIAL}
      where h.fact_id = $1
      order by h.cambiado_en desc, h.id desc`,
    [factId],
  );

  return rows.map(mapear);
}

// Un cambio de material aparece en el historial de ambos productos: el
// destino por codigo_material y el origen por el snapshot anterior.
const FILTRO_PRODUCTO = `(
  h.codigo_material = $1::bigint
  or h.datos_anteriores ->> 'codigo_material' = $1::text
  or h.datos_nuevos ->> 'codigo_material' = $1::text
)`;

export async function consultarHistorialProducto(
  pool: Pool,
  codigo: number,
  page: number,
  perPage: number,
): Promise<{ filas: CambioHistorial[]; total: number }> {
  const parametros = [String(codigo)];

  const [datos, conteo] = await Promise.all([
    pool.query<FilaHistorial>(
      `${SELECT_HISTORIAL}
        where ${FILTRO_PRODUCTO}
        order by h.cambiado_en desc, h.id desc
        limit $2 offset $3`,
      [...parametros, perPage, (page - 1) * perPage],
    ),
    pool.query<{ total: number }>(
      `select count(*)::int as total
         from merma.fact_merma_historial h
        where ${FILTRO_PRODUCTO}`,
      parametros,
    ),
  ]);

  return {
    filas: datos.rows.map(mapear),
    total: conteo.rows[0]?.total ?? 0,
  };
}
