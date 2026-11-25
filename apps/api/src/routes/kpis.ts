import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { filtrosMeta, parseFiltros } from "../http/filtros.js";
import { queryBase } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import { validarValores } from "../services/catalogos.js";
import { obtenerKpis } from "../services/kpis.js";

export function registrarKpis(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/kpis",
    {
      attachValidation: true,
      schema: {
        tags: ["KPIs"],
        summary: "KPIs del rango filtrado",
        querystring: queryBase,
      },
    },
    async (request) => {
      const filtros = parseFiltros(request.query);
      await validarValores(pool, filtros);

      const { kpis, filasBase } = await app.cache.obtener(
        claveCache("kpis", request.query),
        () => obtenerKpis(pool, filtros),
      );

      return envelope(kpis, {
        filtros: filtrosMeta(filtros),
        filas_base: filasBase,
      });
    },
  );
}
