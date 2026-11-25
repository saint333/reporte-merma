import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { filtrosMeta, parseRegistros } from "../http/filtros.js";
import { queryRegistros } from "../http/openapi.js";
import { envelope } from "../http/respuesta.js";
import {
  consultarRegistros,
  consultarRegistrosCsv,
  type FilaRegistro,
} from "../services/registros.js";

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

export function registrarRegistros(app: FastifyInstance, pool: Pool): void {
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
