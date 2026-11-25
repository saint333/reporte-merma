import type { FastifyInstance } from "fastify";

export class ErrorApi extends Error {
  constructor(
    public readonly codigo: string,
    mensaje: string,
    public readonly detalle: unknown = null,
    public readonly status = 422,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

export class FiltroInvalido extends ErrorApi {
  constructor(mensaje: string, detalle: unknown = null) {
    super("FILTRO_INVALIDO", mensaje, detalle);
  }
}

export class SerieInsuficiente extends ErrorApi {
  constructor(mensaje: string, detalle: unknown = null) {
    super("SERIE_INSUFICIENTE", mensaje, detalle);
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
    if (error instanceof ErrorApi) {
      return reply.code(error.status).send({
        error: {
          codigo: error.codigo,
          mensaje: error.message,
          detalle: error.detalle,
        },
      });
    }

    const errorHttp = error as { statusCode?: number; message?: string };
    const status = errorHttp.statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({
        error: {
          codigo: status === 429 ? "RATE_LIMIT" : "SOLICITUD_INVALIDA",
          mensaje: errorHttp.message ?? "Solicitud inválida",
          detalle: null,
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
