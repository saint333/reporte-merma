import type { FastifyInstance, FastifyRequest } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { Pool } from "pg";

import { ejecutar, type Modo, type Reporte } from "../etl/load-xlsx.js";
import { exigirAutorizacion } from "../http/autorizacion.js";
import { ErrorApi, esErrorDeBase } from "../http/errores.js";
import { isoLima } from "../http/fechas.js";
import { envelope } from "../http/respuesta.js";

const MODOS = new Set<Modo>(["append", "replace"]);
const EXTENSION = /\.xlsx$/i;

export type OpcionesCargas = {
  adminToken: string | null;
  maxBytes: number;
};

export type CargaHistorial = {
  id: number;
  archivo: string;
  filas_leidas: number;
  filas_insertadas: number;
  filas_duplicadas: number;
  filas_observadas: number;
  desde: string | null;
  hasta: string | null;
  estado: string;
  costo_total: string | null;
  modo: string | null;
  creada_en: string;
};

type FilaCarga = Omit<CargaHistorial, "creada_en"> & { creada_en: Date };

type ArchivoRecibido = { bytes: Buffer; nombre: string };

function traducirErrorArchivo(error: unknown, maxBytes: number): never {
  if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
    throw new ErrorApi(
      "ARCHIVO_MUY_GRANDE",
      `El archivo supera el límite de ${Math.round(
        maxBytes / (1024 * 1024),
      )} MB.`,
      null,
      413,
    );
  }

  throw error;
}

async function leerArchivo(
  request: FastifyRequest,
  maxBytes: number,
): Promise<ArchivoRecibido> {
  let archivo: MultipartFile | undefined;

  try {
    archivo = await request.file();
  } catch (error) {
    traducirErrorArchivo(error, maxBytes);
  }

  if (!archivo) {
    throw new ErrorApi(
      "ARCHIVO_REQUERIDO",
      "Falta el archivo en el campo archivo.",
      null,
      400,
    );
  }

  try {
    const bytes = await archivo.toBuffer();
    return { bytes, nombre: archivo.filename };
  } catch (error) {
    traducirErrorArchivo(error, maxBytes);
  }
}

export function registrarCargas(
  app: FastifyInstance,
  pool: Pool,
  opciones: OpcionesCargas,
): void {
  app.post<{ Querystring: { modo?: string; confirmar?: string } }>(
    "/api/v1/cargas",
    {
      config: { rateLimit: { max: 6, timeWindow: "1 minute" } },
      schema: {
        tags: ["Cargas"],
        summary: "Carga el Excel de mermas desde el navegador",
        description:
          "Recibe el archivo en multipart/form-data (campo archivo) y ejecuta el mismo ETL que la CLI. " +
          "Solo pide la cabecera x-admin-token si la API define ADMIN_TOKEN. El modo replace borra los hechos de la carga previa del mismo archivo.",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            modo: {
              type: "string",
              enum: ["append", "replace"],
              default: "append",
            },
            confirmar: { type: "string", enum: ["true", "false"] },
          },
        },
      },
    },
    async (request, reply) => {
      exigirAutorizacion(request.headers["x-admin-token"], opciones.adminToken);

      if (!request.isMultipart()) {
        throw new ErrorApi(
          "ARCHIVO_REQUERIDO",
          "Envía el archivo como multipart/form-data en el campo archivo.",
          null,
          400,
        );
      }

      const modo = (request.query.modo ?? "append") as Modo;
      if (!MODOS.has(modo)) {
        throw new ErrorApi(
          "MODO_INVALIDO",
          "El modo debe ser append o replace.",
          null,
          422,
        );
      }

      if (modo === "replace" && request.query.confirmar !== "true") {
        throw new ErrorApi(
          "CONFIRMACION_REQUERIDA",
          "El modo replace borra los hechos de la carga anterior. Repite con confirmar=true.",
          null,
          422,
        );
      }

      const { bytes, nombre } = await leerArchivo(request, opciones.maxBytes);

      if (!EXTENSION.test(nombre)) {
        throw new ErrorApi(
          "FORMATO_INVALIDO",
          "El archivo debe tener extensión .xlsx.",
          null,
          415,
        );
      }

      if (bytes.length === 0) {
        throw new ErrorApi("ARCHIVO_VACIO", "El archivo está vacío.", null, 400);
      }

      let reporte: Reporte;
      try {
        reporte = await ejecutar({ bytes, nombre }, modo, {
          pool,
          guardarReporte: false,
        });
      } catch (error) {
        if (esErrorDeBase(error)) throw error;

        throw new ErrorApi(
          "ARCHIVO_INVALIDO",
          error instanceof Error
            ? error.message
            : "No se pudo procesar el archivo.",
          null,
          422,
        );
      }

      // Los KPIs y series cacheados quedan obsoletos en cuanto entran datos nuevos.
      app.cache.limpiar();

      request.log.info(
        {
          archivo: nombre,
          modo,
          insertadas: reporte.insertadas,
          ya_cargado: reporte.ya_cargado ?? false,
        },
        "carga web procesada",
      );

      return reply
        .code(reporte.ya_cargado ? 200 : 201)
        .send(envelope(reporte));
    },
  );

  app.get<{ Querystring: { limite?: number } }>(
    "/api/v1/cargas",
    {
      schema: {
        tags: ["Cargas"],
        summary: "Historial de cargas registradas",
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limite: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { rows } = await pool.query<FilaCarga>(
        `select id,
                archivo,
                filas_leidas,
                filas_insertadas,
                filas_duplicadas,
                filas_observadas,
                desde::text as desde,
                hasta::text as hasta,
                estado,
                coalesce(detalle ->> 'costo_total', '0') as costo_total,
                detalle ->> 'modo' as modo,
                creada_en
           from merma.carga
          where archivo <> 'Registro manual'
          order by creada_en desc, id desc
          limit $1`,
        [request.query.limite ?? 20],
      );

      const data: CargaHistorial[] = rows.map((fila) => ({
        ...fila,
        id: Number(fila.id),
        creada_en: isoLima(fila.creada_en),
      }));

      return envelope(data);
    },
  );
}
