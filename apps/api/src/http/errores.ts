import type { FastifyInstance } from "fastify";

export class FiltroInvalido extends Error {
  constructor(
    mensaje: string,
    public readonly detalle: unknown = null,
  ) {
    super(mensaje);
    this.name = "FiltroInvalido";
  }
}

const CODIGOS_BASE = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "08000",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
]);

export function esErrorDeBase(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const codigo = (error as { code?: string }).code;
  return codigo ? CODIGOS_BASE.has(codigo) : false;
}

export function registrarErrores(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof FiltroInvalido) {
      return reply.code(422).send({
        error: {
          codigo: "FILTRO_INVALIDO",
          mensaje: error.message,
          detalle: error.detalle,
        },
      });
    }

    if (esErrorDeBase(error)) {
      request.log.error({ err: error }, "base de datos no disponible");
      return reply.code(503).send({
        error: {
          codigo: "BASE_NO_DISPONIBLE",
          mensaje: "La base de datos no está disponible",
          detalle: null,
        },
      });
    }

    request.log.error({ err: error }, "error no controlado");
    return reply.code(500).send({
      error: {
        codigo: "ERROR_INTERNO",
        mensaje: "Error interno del servidor",
        detalle: null,
      },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        codigo: "NO_ENCONTRADO",
        mensaje: `Ruta no encontrada: ${request.method} ${request.url}`,
        detalle: null,
      },
    }),
  );
}
