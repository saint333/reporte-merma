import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { ErrorApi } from "../http/errores.js";
import { leerEnteroPositivo } from "../http/parametros.js";
import { envelope } from "../http/respuesta.js";
import { obtenerMaterial } from "../services/catalogos.js";
import { consultarHistorialProducto } from "../services/historial.js";

const paramsCodigo = {
  type: "object",
  required: ["codigo"],
  properties: {
    codigo: {
      type: "integer",
      minimum: 1,
      description: "Código del material (SKU).",
    },
  },
  additionalProperties: false,
} as const;

export function registrarHistorial(app: FastifyInstance, pool: Pool): void {
  app.get<{
    Params: { codigo: string };
    Querystring: { page?: number; per_page?: number };
  }>(
    "/api/v1/productos/:codigo/historial",
    {
      schema: {
        tags: ["Historial"],
        summary: "Historial de cambios de un producto",
        description:
          "Devuelve las altas, ediciones y eliminaciones de todos los eventos del SKU, incluidos los cambios que lo movieron a otro material.",
        params: paramsCodigo,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            per_page: { type: "integer", minimum: 1, maximum: 100, default: 25 },
          },
        },
      },
    },
    async (request) => {
      const codigo = leerEnteroPositivo(
        request.params.codigo,
        "El código del producto",
      );
      const page = Math.max(1, Number(request.query.page) || 1);
      const perPage = Math.min(
        100,
        Math.max(1, Number(request.query.per_page) || 25),
      );

      const material = await obtenerMaterial(pool, codigo);
      if (!material) {
        throw new ErrorApi(
          "PRODUCTO_NO_ENCONTRADO",
          `El producto ${codigo} no existe en el maestro de materiales.`,
          null,
          404,
        );
      }

      const { filas, total } = await consultarHistorialProducto(
        pool,
        codigo,
        page,
        perPage,
      );

      return {
        ...envelope(filas, { material }),
        page: {
          page,
          per_page: perPage,
          total,
          pages: total === 0 ? 0 : Math.ceil(total / perPage),
        },
      };
    },
  );
}
