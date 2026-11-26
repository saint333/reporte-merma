import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { claveCache } from "../http/cache.js";
import { envelope } from "../http/respuesta.js";
import { obtenerCatalogosManuales } from "../services/catalogos.js";

export function registrarCatalogos(app: FastifyInstance, pool: Pool): void {
  app.get(
    "/api/v1/catalogos",
    {
      schema: {
        tags: ["Catálogo"],
        summary: "Materiales y motivos para registrar o editar un evento",
      },
    },
    async (request) => {
      const data = await app.cache.obtener(
        claveCache("catalogos", request.query),
        () => obtenerCatalogosManuales(pool),
      );

      return envelope(data);
    },
  );
}
