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
const sql = await readFile(path.join(directorio, "check_calidad.sql"), "utf8");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

// Cada control cuenta violaciones: se espera 0.
const controles = [
  "materiales_huerfanos",
  "costos_invalidos",
  "costo_recalculado",
  "semana_iso",
  "motivos_huerfanos",
] as const;

try {
  const { rows } = await pool.query(sql);
  const fila = rows[0];
  if (!fila) throw new Error("La consulta de calidad no devolvió filas");

  const resultados = controles.map((control) => {
    const obtenido = Number(fila[control]);
    return { control, violaciones: obtenido, ok: obtenido === 0 };
  });

  console.table(resultados);
  console.log(`hechos=${fila.hechos} costo_total=${fila.costo_total}`);

  if (resultados.some((r) => !r.ok)) {
    throw new Error("Hay violaciones de calidad: la carga no es aceptable");
  }

  console.log("Calidad OK");
} finally {
  await pool.end();
}
