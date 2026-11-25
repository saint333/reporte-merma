import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import {
  filtrosMeta,
  parseFiltros,
  parseSerieSemanal,
} from "../http/filtros.js";
import { queryBase, querySerieSemanal } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import { obtenerSerieMensual, obtenerSerieSemanal } from "../services/series.js";

export function registrarSeries(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/series/mensual",
    {
      attachValidation: true,
      schema: {
        tags: ["Series"],
        summary: "Serie mensual con participación",
        querystring: queryBase,
      },
    },
    async (request) => {
      const filtros = parseFiltros(request.query);
      const { filas, total } = await app.cache.obtener(
        claveCache("series-mensual", request.query),
        () => obtenerSerieMensual(pool, filtros),
      );

      return envelope(filas, {
        filtros: filtrosMeta(filtros),
        total,
      });
    },
  );

  app.get(
    "/api/v1/series/semanal",
    {
      attachValidation: true,
      schema: {
        tags: ["Series"],
        summary: "Serie semanal con WoW y resumen",
        querystring: querySerieSemanal,
      },
    },
    async (request) => {
      const filtros = parseSerieSemanal(request.query);
      const { filas, total, resumen } = await app.cache.obtener(
        claveCache("series-semanal", request.query),
        () => obtenerSerieSemanal(pool, filtros),
      );

      return {
        ...envelope(filas, {
          filtros: filtrosMeta(filtros),
          total,
        }),
        resumen,
      };
    },
  );
}
