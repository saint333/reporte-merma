/**
 * Genera docs/api/openapi.json a partir de la app real de Fastify.
 * No abre conexiones: solo registra las rutas y serializa el esquema.
 *
 * Uso: npm run api:openapi
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { buildApp } from "../src/app.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = resolve(aqui, "../../../docs/api/openapi.json");

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgresql://merma:merma@localhost:5432/merma",
  max: 1,
});

const app = await buildApp({
  pool,
  corsOrigins: ["http://localhost:5173"],
  logger: false,
});

try {
  await app.ready();
  const esquema = app.swagger();
  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, `${JSON.stringify(esquema, null, 2)}\n`, "utf8");

  const rutas = Object.keys(esquema.paths ?? {}).length;
  const version = (esquema as { openapi?: string }).openapi ?? "3.1.0";
  console.log(
    `openapi.json escrito en ${destino} (${rutas} rutas, OpenAPI ${version})`,
  );
} finally {
  await app.close();
  await pool.end();
}
