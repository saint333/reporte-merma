import type { Pool } from "pg";

import { FiltroInvalido } from "../http/errores.js";
import type { Filtros } from "../http/filtros.js";

export type Catalogos = {
  programas: string[];
  familias: string[];
  gestiones: string[];
};

export type CatalogoMaterial = {
  codigo: number;
  descripcion: string;
  um: string;
  familia: string;
  programa: string;
  valor_unitario: string;
};

export type CatalogoMotivo = {
  codigo: string;
  categoria: string;
  area_responsable: string;
  gestionabilidad: string;
  accion_correctiva: string | null;
};

export type CatalogosManuales = {
  materiales: CatalogoMaterial[];
  motivos: CatalogoMotivo[];
};

export async function obtenerCatalogosManuales(
  pool: Pool,
): Promise<CatalogosManuales> {
  const [materiales, motivos] = await Promise.all([
    pool.query<CatalogoMaterial>(
      `select codigo::int as codigo,
              descripcion,
              um,
              grupo_material as familia,
              programa,
              valor_unitario::text as valor_unitario
         from merma.dim_material
        where activo
        order by descripcion, codigo`,
    ),
    pool.query<CatalogoMotivo>(
      `select codigo,
              categoria,
              area_responsable,
              gestionabilidad,
              accion_correctiva
         from merma.dim_motivo
        where activo
        order by gestionabilidad, codigo`,
    ),
  ]);

  return { materiales: materiales.rows, motivos: motivos.rows };
}

export async function obtenerMaterial(
  pool: Pool,
  codigo: number,
): Promise<CatalogoMaterial | null> {
  const { rows } = await pool.query<CatalogoMaterial>(
    `select codigo::int as codigo,
            descripcion,
            um,
            grupo_material as familia,
            programa,
            valor_unitario::text as valor_unitario
       from merma.dim_material
      where codigo = $1`,
    [codigo],
  );

  return rows[0] ?? null;
}

export async function obtenerCatalogos(pool: Pool): Promise<Catalogos> {
  const [programas, familias, gestiones] = await Promise.all([
    pool.query<{ valor: string }>(
      "select distinct programa as valor from merma.dim_material order by 1",
    ),
    pool.query<{ valor: string }>(
      "select distinct grupo_material as valor from merma.dim_material order by 1",
    ),
    pool.query<{ valor: string }>(
      "select distinct gestionabilidad as valor from merma.dim_motivo order by 1",
    ),
  ]);

  return {
    programas: programas.rows.map((fila) => fila.valor),
    familias: familias.rows.map((fila) => fila.valor),
    gestiones: gestiones.rows.map((fila) => fila.valor),
  };
}

export async function validarValores(pool: Pool, filtros: Filtros): Promise<void> {
  const catalogos = await obtenerCatalogos(pool);
  const invalidos: string[] = [];

  for (const programa of filtros.programa ?? []) {
    if (!catalogos.programas.includes(programa)) invalidos.push(`programa=${programa}`);
  }
  for (const familia of filtros.familia ?? []) {
    if (!catalogos.familias.includes(familia)) invalidos.push(`familia=${familia}`);
  }
  for (const gestion of filtros.gestion ?? []) {
    if (!catalogos.gestiones.includes(gestion)) invalidos.push(`gestion=${gestion}`);
  }

  if (invalidos.length > 0) {
    throw new FiltroInvalido(
      `Valores inexistentes en el catálogo: ${invalidos.join(", ")}`,
      invalidos,
    );
  }
}
