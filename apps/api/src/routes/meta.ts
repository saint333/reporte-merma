import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { isoLima } from "../http/fechas.js";
import { envelope } from "../http/respuesta.js";
import { obtenerCatalogos } from "../services/catalogos.js";

export function registrarMeta(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/meta",
    {
      schema: {
        tags: ["Catálogo"],
        summary: "Rango, filtros, vistas y última carga",
      },
    },
    async (request) => {
      const data = await app.cache.obtener(
        claveCache("meta", request.query),
        async () => {
          const [rango, meses, catalogos, totales, carga] = await Promise.all([
            pool.query<{ min: string | null; max: string | null }>(
              "select min(fecha)::text as min, max(fecha)::text as max from merma.fact_merma",
            ),
            pool.query<{ mes: string }>(
              "select distinct mes::text as mes from merma.fact_merma order by 1",
            ),
            obtenerCatalogos(pool),
            pool.query<{
              registros: number;
              materiales: number;
              motivos: number;
            }>(
              `select
                 (select count(*)::int from merma.fact_merma) as registros,
                 (select count(*)::int from merma.dim_material where activo) as materiales,
                 (select count(*)::int from merma.dim_motivo where activo) as motivos`,
            ),
            pool.query<{ id: number; archivo: string; creada_en: Date }>(
              `select id::int as id, archivo, creada_en
                 from merma.carga
                where estado = 'completada'
                order by creada_en desc, id desc
                limit 1`,
            ),
          ]);

          const minimo = rango.rows[0]?.min ?? null;
          const maximo = rango.rows[0]?.max ?? null;
          const dias =
            minimo && maximo
              ? Math.round(
                  (Date.parse(maximo) - Date.parse(minimo)) / 86_400_000,
                ) + 1
              : 0;

          const vistas =
            minimo && maximo
              ? [
                  {
                    id: "campania-28s",
                    nombre: "Campaña 28 semanas (corte 11/11)",
                    desde: "2026-05-08",
                    hasta: "2026-11-11",
                  },
                  {
                    id: "todo",
                    nombre: "Todo el registro",
                    desde: minimo,
                    hasta: maximo,
                  },
                ]
              : [];

          const ultima = carga.rows[0];
          const totalesFila = totales.rows[0] ?? {
            registros: 0,
            materiales: 0,
            motivos: 0,
          };

          return {
            rango: { min: minimo, max: maximo, dias },
            meses: meses.rows.map((fila) => fila.mes),
            programas: catalogos.programas,
            familias: catalogos.familias,
            gestiones: catalogos.gestiones,
            vistas,
            totales: totalesFila,
            ultima_carga: ultima
              ? {
                  id: ultima.id,
                  archivo: ultima.archivo,
                  creada_en: isoLima(ultima.creada_en),
                }
              : null,
          };
        },
      );

      return envelope(data, { filtros: null });
    },
  );
}
