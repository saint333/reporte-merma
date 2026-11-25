import type { Pool } from "pg";

import { FiltroInvalido } from "../http/errores.js";
import type { Filtros } from "../http/filtros.js";

export type Catalogos = {
  programas: string[];
  familias: string[];
  gestiones: string[];
};

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
