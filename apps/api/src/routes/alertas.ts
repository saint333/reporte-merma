import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { filtrosMeta, parseFiltros } from "../http/filtros.js";
import { queryBase } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import { obtenerAlertas } from "../services/alertas.js";

export function registrarAlertas(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/alertas",
    {
      attachValidation: true,
      schema: {
        tags: ["Alertas"],
        summary: "Alertas de calidad, concentración y variación",
        querystring: queryBase,
      },
    },
    async (request) => {
      const filtros = parseFiltros(request.query);
      const data = await app.cache.obtener(
        claveCache("alertas", request.query),
        () => obtenerAlertas(pool, filtros),
      );

      return envelope(data, { filtros: filtrosMeta(filtros) });
    },
  );
}
