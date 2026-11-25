import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const nombreBase = databaseUrl
  ? new URL(databaseUrl).pathname.replace(/^\//, "")
  : "";
const suite =
  databaseUrl && nombreBase.includes("test") ? describe : describe.skip;

suite("API contra Postgres de prueba", () => {
  let pool: Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl as string, max: 2 });

    await pool.query(
      "truncate merma.fact_merma, merma.carga, merma.dim_material restart identity cascade",
    );

    await pool.query(`
      insert into merma.dim_material
        (codigo, descripcion, um, valor_unitario, grupo_material, programa, unidades_por_pallet)
      values
        (90000001, 'BOLSA TEST', 'UNI', 1, 'BOLSAS', 'GENÉRICO', 1000),
        (90000002, 'CLAMSHELL TEST', 'UNI', 1, 'CLAMSHELL', 'UNIFRUTTI', 500)
    `);

    const carga = await pool.query<{ id: number }>(`
      insert into merma.carga
        (archivo, hash_archivo, filas_leidas, filas_insertadas, desde, hasta, estado)
      values ('api-test.xlsx', 'hash-api-test', 4, 4, '2026-09-01', '2026-09-22', 'completada')
      returning id
    `);
    const cargaId = carga.rows[0]?.id;
    if (!cargaId) throw new Error("No se pudo crear la carga de prueba");

    await pool.query(
      `insert into merma.fact_merma
         (carga_id, fecha, semana_iso, mes, codigo_material, cantidad,
          motivo_codigo, valor_unitario, costo_total, origen_fila, hash_fila)
       values
         ($1, '2026-09-01', 36, '2026-09', 90000001, 100, 'ROTURA DE EMBALAJES', 1, 100, 1, 'h1'),
         ($1, '2026-09-08', 37, '2026-09', 90000001,  50, 'CONTRAMUESTRA',       1,  50, 2, 'h2'),
         ($1, '2026-09-15', 38, '2026-09', 90000002,  20, 'ROTURA DE EMBALAJES', 1,  20, 3, 'h3'),
         ($1, '2026-09-22', 39, '2026-09', 90000002,  30, 'ROTURA DE EMBALAJES', 1,  30, 4, 'h4')`,
      [cargaId],
    );

    app = await buildApp({
      pool,
      corsOrigins: ["http://localhost:5173"],
      logger: false,
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (pool) {
      await pool.query(
        "truncate merma.fact_merma, merma.carga, merma.dim_material restart identity cascade",
      );
      await pool.end();
    }
  });

  it("GET /salud responde 200 y reporta la última carga", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/salud",
      headers: { "x-request-id": "prueba-123" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-request-id"]).toBe("prueba-123");
    expect(res.headers["x-robots-tag"]).toBe("noindex");
    expect(res.json()).toMatchObject({
      estado: "ok",
      db: "ok",
      version: "0.1.0",
    });
    expect(res.json().ultima_carga).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/,
    );
  });

  it("GET /meta devuelve rango, catálogos, vistas y totales", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/meta" });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data.rango).toEqual({
      min: "2026-09-01",
      max: "2026-09-22",
      dias: 22,
    });
    expect(body.data.meses).toEqual(["2026-09"]);
    expect(body.data.programas).toEqual(["GENÉRICO", "UNIFRUTTI"]);
    expect(body.data.familias).toEqual(["BOLSAS", "CLAMSHELL"]);
    expect(body.data.gestiones).toEqual([
      "Controlable",
      "Estándar Técnico",
      "Por Auditar",
      "Recuperable Proveedor",
    ]);
    expect(body.data.totales).toEqual({
      registros: 4,
      materiales: 2,
      motivos: 13,
    });
    expect(body.data.vistas.map((vista: { id: string }) => vista.id)).toEqual([
      "campania-28s",
      "todo",
    ]);
    expect(body.data.ultima_carga.archivo).toBe("api-test.xlsx");
    expect(typeof body.data.ultima_carga.id).toBe("number");
    expect(body.meta.moneda).toBe("USD");
  });

  it("GET /kpis calcula los indicadores del periodo", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data).toEqual({
      merma_total: "200.0000",
      eventos: 4,
      ticket_promedio: "50.0000",
      merma_controlable: "150.0000",
      controlable_pct: 0.75,
      pallets_equiv: "0.250000",
      skus_con_merma: 2,
      skus_total: 2,
      semana_pico: { semana_iso: 36, costo: "100.0000" },
      variacion_ultima_semana: 0.5,
    });
    expect(body.meta.filas_base).toBe(4);
    expect(body.meta.filtros).toEqual({
      desde: "2026-09-01",
      hasta: "2026-09-30",
      mes: null,
      programa: null,
      familia: null,
      gestion: null,
    });
  });

  it("GET /kpis respeta familia, gestión, programa y mes", async () => {
    const familia = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&familia=CLAMSHELL",
    });
    expect(familia.statusCode).toBe(200);
    expect(familia.json().data).toMatchObject({
      merma_total: "50.0000",
      eventos: 2,
      controlable_pct: 1,
      pallets_equiv: "0.100000",
      skus_con_merma: 1,
      semana_pico: { semana_iso: 39, costo: "30.0000" },
    });

    const gestion = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&gestion=Controlable",
    });
    expect(gestion.statusCode).toBe(200);
    expect(gestion.json().data).toMatchObject({
      merma_total: "150.0000",
      eventos: 3,
      merma_controlable: "150.0000",
      controlable_pct: 1,
      pallets_equiv: "0.200000",
    });

    const programa = await app.inject({
      method: "GET",
      url: `/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&programa=${encodeURIComponent("GENÉRICO")}`,
    });
    expect(programa.statusCode).toBe(200);
    expect(programa.json().data).toMatchObject({
      merma_total: "150.0000",
      eventos: 2,
      merma_controlable: "100.0000",
      controlable_pct: 0.6667,
      variacion_ultima_semana: -0.5,
    });

    const mes = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&mes=2026-09",
    });
    expect(mes.statusCode).toBe(200);
    expect(mes.json().data.merma_total).toBe("200.0000");

    const varios = await app.inject({
      method: "GET",
      url: `/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&gestion=${encodeURIComponent(
        "Controlable,Estándar Técnico",
      )}`,
    });
    expect(varios.statusCode).toBe(200);
    expect(varios.json().data.merma_total).toBe("200.0000");
  });

  it("GET /kpis responde 200 con ceros si el rango no tiene datos", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/kpis?desde=2026-01-01&hasta=2026-01-31",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual({
      merma_total: "0.0000",
      eventos: 0,
      ticket_promedio: "0.0000",
      merma_controlable: "0.0000",
      controlable_pct: 0,
      pallets_equiv: "0.000000",
      skus_con_merma: 0,
      skus_total: 2,
      semana_pico: null,
      variacion_ultima_semana: null,
    });
  });

  it("GET /kpis rechaza filtros inválidos con 422", async () => {
    const urls = [
      "/api/v1/kpis?desde=2026-09-01",
      "/api/v1/kpis?desde=2026-09-30&hasta=2026-09-01",
      "/api/v1/kpis?desde=2026-09-01&hasta=2030-01-01",
      "/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&mes=2026-13",
      "/api/v1/kpis?desde=2026-02-31&hasta=2026-09-30",
      "/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&programa=NO%20EXISTE",
      `/api/v1/kpis?desde=2026-09-01&hasta=2026-09-30&program=${encodeURIComponent("GENÉRICO")}`,
    ];

    for (const url of urls) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(422);
      expect(res.json().error.codigo).toBe("FILTRO_INVALIDO");
    }
  });

  it("aplica CORS solo a los orígenes permitidos", async () => {
    const permitido = await app.inject({
      method: "GET",
      url: "/api/v1/salud",
      headers: { origin: "http://localhost:5173" },
    });
    expect(permitido.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );

    const denegado = await app.inject({
      method: "GET",
      url: "/api/v1/salud",
      headers: { origin: "http://evil.example" },
    });
    expect(denegado.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responde 404 con el sobre de error", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/nada" });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.codigo).toBe("NO_ENCONTRADO");
  });

  it("GET /salud responde 503 si la base no responde", async () => {
    const poolCaido = new Pool({
      connectionString: "postgresql://x:x@127.0.0.1:1/x",
      connectionTimeoutMillis: 500,
      max: 1,
    });
    const appCaida = await buildApp({
      pool: poolCaido,
      corsOrigins: [],
      logger: false,
    });

    const res = await appCaida.inject({
      method: "GET",
      url: "/api/v1/salud",
    });

    expect(res.statusCode).toBe(503);
    expect(res.json().error.codigo).toBe("BASE_NO_DISPONIBLE");

    await appCaida.close();
    await poolCaido.end();
  });
});
