import "dotenv/config";

import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";
import { migrate } from "postgres-migrations";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta DATABASE_URL. Copia .env.example a .env y completa la cadena.");
  process.exit(1);
}

const directorio = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../db/migrations",
);

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  await migrate({ client: pool }, directorio);
  console.log(`Migraciones aplicadas desde ${directorio}`);
} finally {
  await pool.end();
}
