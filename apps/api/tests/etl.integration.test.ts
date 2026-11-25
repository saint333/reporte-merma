import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import ExcelJS from "exceljs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ejecutar } from "../src/etl/load-xlsx.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const nombreBase = databaseUrl
  ? new URL(databaseUrl).pathname.replace(/^\//, "")
  : "";
const suite =
  databaseUrl && nombreBase.includes("test") ? describe : describe.skip;

async function crearLibro(ruta: string): Promise<void> {
  const wb = new ExcelJS.Workbook();

  const catalogo = wb.addWorksheet("CATALOGO_MOTIVOS");
  for (let i = 0; i < 4; i++) catalogo.addRow([]);
  const motivo = catalogo.addRow([]);
  motivo.getCell(1).value = "ROTURA DE EMBALAJES";
  motivo.getCell(2).value = "Operativa";
  motivo.getCell(3).value = "Packing / Estiba";
  motivo.getCell(4).value = "Controlable";
  motivo.getCell(5).value = "Acción";
  const fallback = catalogo.addRow([]);
  fallback.getCell(1).value = "SIN CLASIFICAR";
  fallback.getCell(2).value = "Auditoría Pendiente";
  fallback.getCell(3).value = "Supervisor de Turno";
  fallback.getCell(4).value = "Por Auditar";
  fallback.getCell(5).value = "Regularizar";

  const maestro = wb.addWorksheet("MAESTRO_MATERIALES");
  for (let i = 0; i < 4; i++) maestro.addRow([]);
  const material = maestro.addRow([]);
  material.getCell(1).value = 13060001;
  material.getCell(2).value = "BOLSA ATMÓSFERA 4KG";
  material.getCell(3).value = "UNI";
  material.getCell(4).value = 0.5;
  material.getCell(5).value = "001";
  material.getCell(6).value = "BOLSAS";
  material.getCell(7).value = "GENÉRICO";
  material.getCell(8).value = 84000;

  const registro = wb.addWorksheet("REGISTRO_MERMAS");
  for (let i = 0; i < 4; i++) registro.addRow([]);
  for (const [fecha, cantidad] of [
    ["2026-09-01", 10],
    ["2026-09-02", 4],
  ] as const) {
    const fila = registro.addRow([]);
    fila.getCell(4).value = new Date(`${fecha}T00:00:00Z`);
    fila.getCell(5).value = 13060001;
    fila.getCell(10).value = cantidad;
    fila.getCell(12).value = "ROTURA DE EMBALAJES";
  }

  await wb.xlsx.writeFile(ruta);
}

suite("ETL contra Postgres de prueba", () => {
  let pool: Pool;
  let dir = "";
  let archivo = "";

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl as string, max: 2 });
    await pool.query(
      "truncate merma.fact_merma, merma.carga, merma.dim_material restart identity cascade",
    );
    dir = await mkdtemp(path.join(os.tmpdir(), "merma-etl-int-"));
    archivo = path.join(dir, "prueba.xlsx");
    await crearLibro(archivo);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(
        "truncate merma.fact_merma, merma.carga, merma.dim_material restart identity cascade",
      );
      await pool.end();
    }
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("carga dos filas y no duplica en un segundo append", async () => {
    const primero = await ejecutar(archivo, "append", { pool, reportDir: dir });
    expect(primero.insertadas).toBe(2);
    expect(primero.errores).toBe(0);
    expect(primero.costo_total).toBe("7.0000");

    const segundo = await ejecutar(archivo, "append", { pool, reportDir: dir });
    expect(segundo.ya_cargado).toBe(true);
    expect(segundo.insertadas).toBe(0);

    const { rows } = await pool.query<{ n: number; costo: string }>(
      "select count(*)::int as n, sum(costo_total)::text as costo from merma.fact_merma",
    );
    expect(rows[0]?.n).toBe(2);
    expect(rows[0]?.costo).toBe("7.0000");
  });

  it("replace reinserta y deja la carga anterior revertida", async () => {
    const reporte = await ejecutar(archivo, "replace", { pool, reportDir: dir });
    expect(reporte.insertadas).toBe(2);

    const cargas = await pool.query<{ estado: string; n: number }>(
      "select estado, count(*)::int as n from merma.carga group by estado order by estado",
    );
    expect(cargas.rows).toEqual([
      { estado: "completada", n: 1 },
      { estado: "revertida", n: 1 },
    ]);

    const hechos = await pool.query<{ n: number }>(
      "select count(*)::int as n from merma.fact_merma",
    );
    expect(hechos.rows[0]?.n).toBe(2);
  });
});
