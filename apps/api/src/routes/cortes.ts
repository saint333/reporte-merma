import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { claveCache } from "../http/cache.js";
import { FiltroInvalido } from "../http/errores.js";
import { filtrosMeta, parseFiltros } from "../http/filtros.js";
import { paramsDimension, queryBase } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import { DIMENSIONES, obtenerCorte } from "../services/cortes.js";

const esquemaDimension = z.enum(DIMENSIONES);

export function registrarCortes(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/cortes/:dimension",
    {
      attachValidation: true,
      schema: {
        tags: ["Cortes"],
        summary: "Ranking por motivo, familia, programa o gestión",
        params: paramsDimension,
        querystring: queryBase,
      },
    },
    async (request) => {
      const dimension = esquemaDimension.safeParse(
        (request.params as { dimension?: string }).dimension,
      );
      if (!dimension.success) {
        throw new FiltroInvalido(
          `Dimensión inválida. Usa: ${DIMENSIONES.join(", ")}`,
          dimension.error.issues,
        );
      }

      const filtros = parseFiltros(request.query);
      const { filas, total } = await app.cache.obtener(
        claveCache(`cortes-${dimension.data}`, request.query),
        () => obtenerCorte(pool, dimension.data, filtros),
      );

      return {
        ...envelope(filas, { filtros: filtrosMeta(filtros) }),
        total,
      };
    },
  );
}
