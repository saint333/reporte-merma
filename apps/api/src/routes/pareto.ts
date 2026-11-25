import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { filtrosMeta, parsePareto } from "../http/filtros.js";
import { queryPareto } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import { obtenerPareto } from "../services/pareto.js";

export function registrarPareto(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/pareto",
    {
      attachValidation: true,
      schema: {
        tags: ["Pareto"],
        summary: "Pareto ABC de SKUs con Top configurable",
        querystring: queryPareto,
      },
    },
    async (request) => {
      const filtros = parsePareto(request.query);
      const { filas, resumen } = await app.cache.obtener(
        claveCache("pareto", request.query),
        () => obtenerPareto(pool, filtros),
      );

      return {
        ...envelope(filas, {
          filtros: filtrosMeta(filtros),
          limite: filtros.limite,
        }),
        resumen,
      };
    },
  );
}
