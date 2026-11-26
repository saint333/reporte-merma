import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { CacheApi } from "./http/cache.js";
import { registrarErrores } from "./http/errores.js";
import { registrarAlertas } from "./routes/alertas.js";
import { registrarCargas } from "./routes/cargas.js";
import { registrarCatalogos } from "./routes/catalogos.js";
import { registrarCortes } from "./routes/cortes.js";
import { registrarHistorial } from "./routes/historial.js";
import { registrarKpis } from "./routes/kpis.js";
import { registrarMeta } from "./routes/meta.js";
import { registrarPareto } from "./routes/pareto.js";
import { registrarProyeccion } from "./routes/proyeccion.js";
import { registrarRegistros } from "./routes/registros.js";
import { registrarSalud } from "./routes/salud.js";
import { registrarSeries } from "./routes/series.js";
import { registrarSesion, type OpcionesSesion } from "./routes/sesion.js";

const RUTAS_CACHEABLES = new Set([
  "/api/v1/meta",
  "/api/v1/catalogos",
  "/api/v1/kpis",
  "/api/v1/series/mensual",
  "/api/v1/series/semanal",
  "/api/v1/cortes/:dimension",
  "/api/v1/pareto",
  "/api/v1/proyeccion",
  "/api/v1/alertas",
]);

export async function buildApp(opciones: {
  pool: Pool;
  corsOrigins: string[];
  logger?: boolean;
  cacheTtlSeconds?: number;
  rateLimitMax?: number;
  uploadMaxBytes?: number;
  sesion?: OpcionesSesion | null;
}): Promise<FastifyInstance> {
  const {
    pool,
    corsOrigins,
    logger = true,
    cacheTtlSeconds = 60,
    rateLimitMax = 600,
    uploadMaxBytes = 20 * 1024 * 1024,
    sesion = null,
  } = opciones;

  const app = Fastify({
    logger,
    genReqId: (request) => {
      const cabecera = request.headers["x-request-id"];
      return typeof cabecera === "string" && cabecera.length > 0
        ? cabecera
        : randomUUID();
    },
  });

  app.decorate("cache", new CacheApi(cacheTtlSeconds));

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    global: true,
    max: rateLimitMax,
    timeWindow: "1 minute",
  });
  await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-request-id"],
    credentials: false,
  });
  await app.register(multipart, {
    limits: { fileSize: uploadMaxBytes, files: 1, fields: 4 },
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "API del Reporte de Merma",
        version: "0.1.0",
        description:
          "Endpoints de consulta para KPIs, series, cortes, Pareto, proyección, registros y alertas; carga del Excel, registro manual, edición y eliminación de eventos, y su historial de cambios.",
      },
      servers: [{ url: "/", description: "Origen actual" }],
      tags: [
        { name: "Sistema", description: "Salud y documentación" },
        { name: "Catálogo", description: "Filtros y metadatos" },
        { name: "KPIs", description: "Indicadores del rango" },
        { name: "Series", description: "Evolución mensual y semanal" },
        { name: "Cortes", description: "Rankings por dimensión" },
        { name: "Pareto", description: "ABC por SKU" },
        { name: "Proyección", description: "Escenarios de cierre" },
        { name: "Registros", description: "Detalle, edición y eliminación de eventos" },
        {
          name: "Historial",
          description: "Auditoría de cambios por evento y por producto",
        },
        { name: "Alertas", description: "Calidad y concentración" },
        { name: "Cargas", description: "Carga del Excel desde la web" },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", filter: true },
  });

  app.get("/openapi.json", { schema: { hide: true } }, async () =>
    app.swagger(),
  );

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    reply.header("x-robots-tag", "noindex");

    const ruta = (request.routeOptions as { url?: string }).url;
    if (ruta && RUTAS_CACHEABLES.has(ruta)) {
      reply.header("cache-control", `public, max-age=${cacheTtlSeconds}`);
    }

    return payload;
  });

  registrarErrores(app);
  if (sesion) registrarSesion(app, sesion);
  registrarSalud(app, pool, "0.1.0", {
    requiereTokenCarga: Boolean(sesion),
  });
  registrarMeta(app, pool);
  registrarCatalogos(app, pool);
  registrarKpis(app, pool);
  registrarSeries(app, pool);
  registrarCortes(app, pool);
  registrarPareto(app, pool);
  registrarProyeccion(app, pool);
  registrarRegistros(app, pool, { sesion });
  registrarHistorial(app, pool);
  registrarAlertas(app, pool);
  registrarCargas(app, pool, { sesion, maxBytes: uploadMaxBytes });

  return app;
}
