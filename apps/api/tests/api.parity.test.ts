import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const databaseUrl = process.env.PARITY_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite("Paridad de la API con el reporte real", () => {
  let pool: Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl as string, max: 2 });
    app = await buildApp({ pool, corsOrigins: [], logger: false });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  it("GET /meta coincide con el rango y los totales del libro", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/meta" });
    expect(res.statusCode).toBe(200);

    const { data } = res.json();
    expect(data.rango).toEqual({
      min: "2026-05-08",
      max: "2026-11-23",
      dias: 200,
    });
    expect(data.meses).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(data.totales).toEqual({
      registros: 1795,
      materiales: 108,
      motivos: 13,
    });
    expect(data.vistas).toContainEqual({
      id: "todo",
      nombre: "Todo el registro",
      desde: "2026-05-08",
      hasta: "2026-11-23",
    });
  });

  it("GET /kpis reproduce la ventana de la campaña (08/05–11/11)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const { data, meta } = res.json();
    expect(data).toEqual({
      merma_total: "17999.6033",
      eventos: 1618,
      ticket_promedio: "11.1246",
      merma_controlable: "11232.0822",
      controlable_pct: 0.624,
      pallets_equiv: "14.898022",
      skus_con_merma: 79,
      skus_total: 108,
      semana_pico: { semana_iso: 40, costo: "5579.3052" },
      variacion_ultima_semana: -0.5537,
    });
    expect(meta.filas_base).toBe(1795);
    expect(meta.filtros.desde).toBe("2026-05-08");
    expect(meta.filtros.hasta).toBe("2026-11-11");
  });

  it("GET /kpis devuelve el total completo del libro", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-05-08&hasta=2026-11-23",
    });
    expect(res.statusCode).toBe(200);

    const { data } = res.json();
    expect(data.merma_total).toBe("20383.7525");
    expect(data.eventos).toBe(1795);
    expect(data.skus_total).toBe(108);
  });

  it("GET /kpis filtra por gestión controlable sin alterar el total", async () => {
    const todos = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11",
    });
    const controlable = await app.inject({
      method: "GET",
      url: `/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11&gestion=${encodeURIComponent("Controlable")}`,
    });

    expect(controlable.statusCode).toBe(200);
    const total = controlable.json().data;
    expect(total.merma_total).toBe(todos.json().data.merma_controlable);
    expect(total.controlable_pct).toBe(1);
  });
});
