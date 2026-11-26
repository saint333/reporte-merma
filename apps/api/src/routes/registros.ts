import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { exigirAutorizacion } from "../http/autorizacion.js";
import {
  filtrosMeta,
  parseEditarRegistro,
  parseRegistroManual,
  parseRegistros,
} from "../http/filtros.js";
import { queryRegistros } from "../http/openapi.js";
import { leerEnteroPositivo } from "../http/parametros.js";
import { envelope } from "../http/respuesta.js";
import {
  editarRegistro,
  eliminarRegistro,
  obtenerRegistro,
} from "../services/edicion.js";
import { consultarHistorialRegistro } from "../services/historial.js";
import { crearRegistroManual } from "../services/manuales.js";
import {
  consultarRegistros,
  consultarRegistrosCsv,
  type FilaRegistro,
} from "../services/registros.js";

const paramsId = {
  type: "object",
  required: ["id"],
  properties: {
    id: {
      type: "integer",
      minimum: 1,
      description: "Identificador del evento de merma.",
    },
  },
  additionalProperties: false,
} as const;

const propiedadesRegistro = {
  fecha: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    examples: ["2026-11-25"],
  },
  codigo_material: {
    type: "integer",
    minimum: 1,
    examples: [10012345],
  },
  cantidad: {
    anyOf: [{ type: "string" }, { type: "number" }],
    examples: ["12.5"],
  },
  motivo: {
    type: "string",
    minLength: 1,
    maxLength: 120,
    examples: ["ROTURA DE EMBALAJES"],
  },
} as const;

const COLUMNAS: { clave: keyof FilaRegistro; titulo: string }[] = [
  { clave: "id", titulo: "id" },
  { clave: "fecha", titulo: "fecha" },
  { clave: "semana_iso", titulo: "semana_iso" },
  { clave: "mes", titulo: "mes" },
  { clave: "codigo_material", titulo: "codigo_material" },
  { clave: "descripcion", titulo: "descripcion" },
  { clave: "familia", titulo: "familia" },
  { clave: "programa", titulo: "programa" },
  { clave: "cantidad", titulo: "cantidad" },
  { clave: "um", titulo: "um" },
  { clave: "motivo", titulo: "motivo" },
  { clave: "gestion", titulo: "gestion" },
  { clave: "area_responsable", titulo: "area_responsable" },
  { clave: "costo_total", titulo: "costo_total" },
  { clave: "es_duplicado", titulo: "es_duplicado" },
  { clave: "origen_fila", titulo: "origen_fila" },
];

function campoCsv(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

function aCsv(filas: FilaRegistro[]): string {
  const lineas = [
    COLUMNAS.map((columna) => columna.titulo).join(","),
    ...filas.map((fila) =>
      COLUMNAS.map((columna) => campoCsv(fila[columna.clave])).join(","),
    ),
  ];

  return `\uFEFF${lineas.join("\r\n")}\r\n`;
}

export function registrarRegistros(
  app: FastifyInstance,
  pool: Pool,
  opciones: { adminToken: string | null },
): void {
  app.get(
    "/api/v1/registros",
    {
      attachValidation: true,
      schema: {
        tags: ["Registros"],
        summary: "Detalle paginado de eventos de merma",
        querystring: queryRegistros,
      },
    },
    async (request) => {
      const query = parseRegistros(request.query);
      const { filas, total, pages } = await consultarRegistros(pool, query);

      return {
        ...envelope(filas, { filtros: filtrosMeta(query) }),
        page: {
          page: query.page,
          per_page: query.per_page,
          total,
          pages,
        },
      };
    },
  );

  app.post(
    "/api/v1/registros",
    {
      attachValidation: true,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["Registros"],
        summary: "Registra manualmente un evento de merma",
        description:
          "Resuelve el motivo con el catálogo y los alias (o lo guarda como SIN CLASIFICAR), calcula la semana ISO, el valor unitario y el costo total con las mismas reglas del ETL, y devuelve las observaciones de campaña, cantidad atípica, motivo no catalogado o pallet singular. " +
          "Deja una carga de auditoría con el evento. Solo pide la cabecera x-admin-token si la API define ADMIN_TOKEN.",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["fecha", "codigo_material", "cantidad", "motivo"],
          properties: propiedadesRegistro,
        },
      },
    },
    async (request, reply) => {
      exigirAutorizacion(request.headers["x-admin-token"], opciones.adminToken);

      const entrada = parseRegistroManual(request.body);
      const data = await crearRegistroManual(pool, {
        fecha: entrada.fecha,
        codigoMaterial: entrada.codigo_material,
        cantidad: entrada.cantidad,
        motivo: entrada.motivo,
      });

      // KPIs, series, cortes y Pareto cacheados quedan obsoletos.
      app.cache.limpiar();

      request.log.info(
        { carga_id: data.carga_id, registro_id: data.registro.id },
        "registro manual creado",
      );

      return reply.code(201).send(envelope(data));
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/registros/:id",
    {
      attachValidation: true,
      schema: {
        tags: ["Registros"],
        summary: "Detalle de un evento de merma",
        params: paramsId,
      },
    },
    async (request) => {
      const id = leerEnteroPositivo(request.params.id, "El id del registro");
      return envelope(await obtenerRegistro(pool, id));
    },
  );

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/api/v1/registros/:id",
    {
      attachValidation: true,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["Registros"],
        summary: "Edita un evento de merma",
        description:
          "Actualiza los campos enviados, resuelve el motivo igual que el alta manual (catálogo, alias o SIN CLASIFICAR), recalcula semana ISO, valor unitario, costo total y hash con las reglas del ETL, devuelve las observaciones y registra el antes/después en el historial. " +
          "Solo pide x-admin-token si la API define ADMIN_TOKEN.",
        params: paramsId,
        body: {
          type: "object",
          additionalProperties: false,
          properties: propiedadesRegistro,
        },
      },
    },
    async (request) => {
      exigirAutorizacion(request.headers["x-admin-token"], opciones.adminToken);

      const id = leerEnteroPositivo(request.params.id, "El id del registro");
      const entrada = parseEditarRegistro(request.body);
      const { registro, observaciones } = await editarRegistro(pool, id, {
        fecha: entrada.fecha,
        codigoMaterial: entrada.codigo_material,
        cantidad: entrada.cantidad,
        motivo: entrada.motivo,
      });

      app.cache.limpiar();

      request.log.info({ registro_id: id }, "registro editado");
      return envelope({ registro, observaciones });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/v1/registros/:id",
    {
      attachValidation: true,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["Registros"],
        summary: "Elimina un evento de merma",
        description:
          "Borra el evento y conserva su rastro en el historial. Solo pide x-admin-token si la API define ADMIN_TOKEN.",
        params: paramsId,
      },
    },
    async (request) => {
      exigirAutorizacion(request.headers["x-admin-token"], opciones.adminToken);

      const id = leerEnteroPositivo(request.params.id, "El id del registro");
      const registro = await eliminarRegistro(pool, id);

      app.cache.limpiar();

      request.log.info({ registro_id: id }, "registro eliminado");
      return envelope({ registro });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/v1/registros/:id/historial",
    {
      attachValidation: true,
      schema: {
        tags: ["Historial"],
        summary: "Cambios de un evento de merma",
        params: paramsId,
      },
    },
    async (request) => {
      const id = leerEnteroPositivo(request.params.id, "El id del registro");
      return envelope(await consultarHistorialRegistro(pool, id));
    },
  );

  app.get(
    "/api/v1/registros.csv",
    {
      attachValidation: true,
      schema: {
        tags: ["Registros"],
        summary: "Exporta los registros filtrados a CSV",
        querystring: queryRegistros,
        produces: ["text/csv"],
      },
    },
    async (request, reply) => {
      const query = parseRegistros(request.query);
      const filas = await consultarRegistrosCsv(pool, query);

      return reply
        .type("text/csv; charset=utf-8")
        .header("content-disposition", 'attachment; filename="registros.csv"')
        .send(aCsv(filas));
    },
  );
}
