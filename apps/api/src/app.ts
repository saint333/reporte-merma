import { randomUUID } from "node:crypto";

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { registrarErrores } from "./http/errores.js";
import { registrarKpis } from "./routes/kpis.js";
import { registrarMeta } from "./routes/meta.js";
import { registrarSalud } from "./routes/salud.js";

export async function buildApp(opciones: {
  pool: Pool;
  corsOrigins: string[];
  logger?: boolean;
}): Promise<FastifyInstance> {
  const { pool, corsOrigins, logger = true } = opciones;

  const app = Fastify({
    logger,
    genReqId: (request) => {
      const cabecera = request.headers["x-request-id"];
      return typeof cabecera === "string" && cabecera.length > 0
        ? cabecera
        : randomUUID();
    },
  });

  await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "OPTIONS"],
    credentials: false,
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    reply.header("x-robots-tag", "noindex");
  });

  registrarErrores(app);
  registrarSalud(app, pool, "0.1.0");
  registrarMeta(app, pool);
  registrarKpis(app, pool);

  return app;
}
