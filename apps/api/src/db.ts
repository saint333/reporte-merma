import { config as cargarEnv } from "dotenv";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
cargarEnv({ path: path.resolve(AQUI, "../.env") });

export function crearPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error(
      "Falta DATABASE_URL. Copia apps/api/.env.example a apps/api/.env o exporta la variable.",
    );
  }

  return new Pool({ connectionString, max: 5 });
}
