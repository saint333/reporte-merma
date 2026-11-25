import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { envelope } from "../http/respuesta.js";

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

export function registrarCatalogos(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/catalogos",
    {
      schema: {
        tags: ["Catálogo"],
        summary: "Materiales y motivos para registrar un evento manual",
      },
    },
    async (request) => {
      const data = await app.cache.obtener(
        claveCache("catalogos", request.query),
        async (): Promise<CatalogosManuales> => {
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
        },
      );

      return envelope(data);
    },
  );
}
