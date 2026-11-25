import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { where, type Filtros } from "../http/filtros.js";

export const DIMENSIONES = ["motivos", "familias", "programas", "gestion"] as const;
export type Dimension = (typeof DIMENSIONES)[number];

type Configuracion = {
  clave: string;
  etiqueta: string;
  gestion: string;
  pallets: boolean;
};

const CONFIGURACIONES: Record<Dimension, Configuracion> = {
  motivos: {
    clave: "motivo",
    etiqueta: "motivo",
    gestion: "gestionabilidad",
    pallets: false,
  },
  familias: {
    clave: "grupo_material",
    etiqueta: "grupo_material",
    gestion: "null::text",
    pallets: true,
  },
  programas: {
    clave: "programa",
    etiqueta: "programa",
    gestion: "null::text",
    pallets: true,
  },
  gestion: {
    clave: "gestionabilidad",
    etiqueta: "gestionabilidad",
    gestion: "null::text",
    pallets: false,
  },
};

export type FilaCorte = {
  clave: string;
  etiqueta: string;
  gestion: string | null;
  eventos: number;
  costo: string;
  participacion: string;
  orden: number;
  pallets_equiv?: string;
};

export async function obtenerCorte(
  pool: Pool,
  dimension: Dimension,
  filtros: Filtros,
): Promise<{
  filas: FilaCorte[];
  total: { eventos: number; costo: string };
}> {
  const configuracion = CONFIGURACIONES[dimension];
  const filtro = where(filtros);

  const { rows } = await pool.query<FilaCorte>(
    `
    with base as (
      select r.costo_total::numeric(16,4) as costo,
             (r.cantidad / m.unidades_por_pallet) as pallets,
             m.grupo_material,
             m.programa,
             mo.codigo as motivo,
             mo.gestionabilidad
      from merma.fact_merma r
      join merma.dim_material m on m.codigo = r.codigo_material
      join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
      where ${filtro.sql}
    ),
    agrupado as (
      select ${configuracion.clave} as clave,
             ${configuracion.etiqueta} as etiqueta,
             ${configuracion.gestion} as gestion,
             count(*)::int as eventos,
             sum(costo)::numeric(16,4) as costo,
             ${
               configuracion.pallets
                 ? "sum(pallets)::numeric(16,6)"
                 : "0::numeric(16,6)"
             } as pallets_equiv
      from base
      group by 1, 2, 3
    )
    select clave,
           etiqueta,
           gestion,
           eventos,
           costo::text as costo,
           ${
             configuracion.pallets
               ? "pallets_equiv::text as pallets_equiv,"
               : ""
           }
           (costo / nullif(sum(costo) over (), 0))::numeric(12,4)::text as participacion,
           row_number() over (order by costo desc, clave)::int as orden
    from agrupado
    order by agrupado.costo desc, agrupado.clave
    `,
    filtro.params,
  );

  const totalCosto = rows.reduce(
    (acumulado, fila) => acumulado.plus(fila.costo),
    new Decimal(0),
  );
  const totalEventos = rows.reduce((acumulado, fila) => acumulado + fila.eventos, 0);

  return {
    filas: rows,
    total: {
      eventos: totalEventos,
      costo: totalCosto.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4),
    },
  };
}
