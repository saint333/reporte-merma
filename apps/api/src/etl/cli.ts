import path from "node:path";
import { parseArgs } from "node:util";

import { crearPool } from "../db.js";
import { ejecutar, type Modo } from "./load-xlsx.js";

const MODOS = new Set<Modo>(["dry-run", "append", "replace"]);

const { values } = parseArgs({
  options: {
    file: { type: "string", short: "f" },
    mode: { type: "string", default: "append" },
    confirm: { type: "boolean", default: false },
  },
});

if (!values.file) {
  console.error(
    "Uso: npm run etl -- --file <ruta.xlsx> [--mode dry-run|append|replace] [--confirm]",
  );
  process.exit(1);
}

const modo = values.mode as Modo;
if (!MODOS.has(modo)) {
  console.error(`Modo inválido: ${values.mode}. Use dry-run, append o replace.`);
  process.exit(1);
}

if (modo === "replace" && !values.confirm) {
  console.error("El modo replace borra los hechos de la carga anterior. Repite con --confirm.");
  process.exit(1);
}

const pool = crearPool();

try {
  const reporte = await ejecutar(path.resolve(values.file), modo, { pool });
  console.log(JSON.stringify(reporte, null, 2));
} finally {
  await pool.end();
}
