import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Falta DATABASE_URL. Copia .env.example a .env y completa la cadena.");
  process.exit(1);
}

const directorio = path.dirname(fileURLToPath(import.meta.url));
const sql = await readFile(path.join(directorio, "check_schema.sql"), "utf8");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

const esperado = {
  tablas: 6,
  vistas: 2,
  motivos: 13,
  alias: 1,
  parametros: 3,
} as const;

try {
  const { rows } = await pool.query(sql);
  const fila = rows[0];
  if (!fila) throw new Error("La consulta de verificación no devolvió filas");

  const resultados = Object.entries(esperado).map(([chequeo, valor]) => {
    const obtenido = Number(fila[chequeo]);
    return { chequeo, esperado: valor, obtenido, ok: obtenido === valor };
  });

  console.table(resultados);
  console.log(
    `materiales=${fila.materiales} hechos=${fila.hechos} ` +
      "(se validan con el ETL del Paso 2)",
  );

  if (resultados.some((r) => !r.ok)) {
    throw new Error("El esquema no cumple lo esperado");
  }

  console.log("Esquema OK");
} finally {
  await pool.end();
}
