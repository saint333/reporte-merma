import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { filtrosMeta, parseProyeccion } from "../http/filtros.js";
import { queryProyeccion } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import { obtenerProyeccion } from "../services/proyeccion.js";

export function registrarProyeccion(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/proyeccion",
    {
      attachValidation: true,
      schema: {
        tags: ["Proyección"],
        summary: "Escenarios de cierre tendencial, base y meta",
        querystring: queryProyeccion,
      },
    },
    async (request) => {
      const filtros = parseProyeccion(request.query);
      const data = await app.cache.obtener(
        claveCache("proyeccion", request.query),
        () => obtenerProyeccion(pool, filtros),
      );

      return envelope(data, {
        filtros: filtrosMeta(filtros),
        alcance: "global",
        nota: "La proyección usa solo el rango de fechas e ignora programa, familia, mes y gestión.",
      });
    },
  );
}
