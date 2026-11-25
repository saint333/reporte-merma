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
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.json()).toMatchObject({
      estado: "ok",
      db: "ok",
      version: "0.1.0",
      carga_requiere_token: false,
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
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
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

  it("GET /series/mensual agrupa por mes y calcula participación", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/series/mensual?desde=2026-09-01&hasta=2026-09-30",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([
      {
        mes: "2026-09",
        eventos: 4,
        costo: "200.0000",
        participacion: "1.0000",
      },
    ]);
    expect(res.json().meta.total).toEqual({ eventos: 4, costo: "200.0000" });
  });

  it("GET /series/semanal genera semanas vacías, WoW y resumen", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/series/semanal?desde=2026-09-01&hasta=2026-09-30",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data).toHaveLength(5);
    expect(body.data[0]).toMatchObject({
      semana_iso: 36,
      inicio: "2026-08-31",
      eventos: 1,
      costo: "100.0000",
      wow_costo: null,
      wow_pct: null,
      es_atipica: false,
    });
    expect(body.data[1].wow_pct).toBe(-0.5);
    expect(body.data[4]).toMatchObject({
      semana_iso: 40,
      inicio: "2026-09-28",
      eventos: 0,
      costo: "0.0000",
      wow_pct: -1,
      es_atipica: false,
    });
    expect(body.resumen).toEqual({
      semanas: 5,
      promedio: "40.0000",
      promedio_ajustado: "40.0000",
      umbral: "3000.00",
    });

    const sinWow = await app.inject({
      method: "GET",
      url: "/api/v1/series/semanal?desde=2026-09-01&hasta=2026-09-30&incluir_wow=false",
    });
    expect(sinWow.json().data[0]).not.toHaveProperty("wow_pct");
  });

  it("GET /cortes/:dimension agrupa y ordena por costo", async () => {
    const motivos = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/motivos?desde=2026-09-01&hasta=2026-09-30",
    });
    expect(motivos.statusCode).toBe(200);
    expect(motivos.json().data).toHaveLength(2);
    expect(motivos.json().data[0]).toMatchObject({
      clave: "ROTURA DE EMBALAJES",
      gestion: "Controlable",
      eventos: 3,
      costo: "150.0000",
      participacion: "0.7500",
      orden: 1,
    });
    expect(motivos.json().total).toEqual({
      eventos: 4,
      costo: "200.0000",
    });

    const familias = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/familias?desde=2026-09-01&hasta=2026-09-30",
    });
    const bolsas = familias
      .json()
      .data.find((fila: { clave: string }) => fila.clave === "BOLSAS");
    const clamshell = familias
      .json()
      .data.find((fila: { clave: string }) => fila.clave === "CLAMSHELL");
    expect(bolsas).toMatchObject({ costo: "150.0000", pallets_equiv: "0.150000" });
    expect(clamshell).toMatchObject({
      costo: "50.0000",
      pallets_equiv: "0.100000",
    });

    const gestion = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/gestion?desde=2026-09-01&hasta=2026-09-30",
    });
    expect(gestion.json().data[0]).toMatchObject({
      clave: "Controlable",
      costo: "150.0000",
      participacion: "0.7500",
    });

    const invalida = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/no-existe?desde=2026-09-01&hasta=2026-09-30",
    });
    expect(invalida.statusCode).toBe(422);
    expect(invalida.json().error.codigo).toBe("FILTRO_INVALIDO");
  });

  it("GET /pareto calcula ABC y su resumen", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pareto?desde=2026-09-01&hasta=2026-09-30",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      rank: 1,
      codigo: 90000001,
      eventos: 2,
      cantidad: "150.0000",
      costo: "150.0000",
      participacion: "0.750000",
      acumulado: "0.750000",
      clase_abc: "A (Crítico)",
      prioridad: "CRÍTICO (A)",
    });
    expect(body.data[1]).toMatchObject({
      rank: 2,
      clase_abc: "C (Bajo)",
      prioridad: "BAJO IMPACTO",
    });
    expect(body.resumen).toEqual({
      skus: 2,
      clase_a: 1,
      clase_b: 0,
      clase_c: 1,
      costo_top: "200.0000",
      participacion_top: "1.000000",
    });

    const invalido = await app.inject({
      method: "GET",
      url: "/api/v1/pareto?desde=2026-09-01&hasta=2026-09-30&limite=0",
    });
    expect(invalido.statusCode).toBe(422);
  });

  it("GET /proyeccion calcula los tres escenarios", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/proyeccion?desde=2026-09-01&hasta=2026-09-30",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data.parametros).toEqual({
      acumulado: "200.0000",
      semanas_observadas: 4,
      promedio_global: "50.0000",
      promedio_ajustado: "50.0000",
      semanas_excluidas: [],
      semanas_restantes: 6,
      meta_reduccion: 0.25,
      proporcion_controlable: "0.7500",
    });
    expect(body.data.escenarios[0]).toEqual({
      id: "tendencial",
      nombre: "A. Tendencial histórico",
      tasa: "50.0000",
      proyeccion_6s: "300.0000",
      cierre: "500.0000",
      ahorro: "0.0000",
    });
    expect(body.data.escenarios[2]).toEqual({
      id: "meta",
      nombre: "C. Meta optimizada",
      tasa: "40.6250",
      proyeccion_6s: "243.7500",
      cierre: "443.7500",
      ahorro: "56.2500",
    });

    const insuficiente = await app.inject({
      method: "GET",
      url: "/api/v1/proyeccion?desde=2026-09-01&hasta=2026-09-01",
    });
    expect(insuficiente.statusCode).toBe(422);
    expect(insuficiente.json().error.codigo).toBe("SERIE_INSUFICIENTE");
  });

  it("GET /registros pagina, filtra y exporta CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-09-01&hasta=2026-09-30&per_page=2",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBeUndefined();
    const body = res.json();
    expect(body.page).toEqual({ page: 1, per_page: 2, total: 4, pages: 2 });
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({
      fecha: "2026-09-22",
      codigo_material: 90000002,
      costo_total: "30.0000",
    });

    const porMotivo = await app.inject({
      method: "GET",
      url: `/api/v1/registros?desde=2026-09-01&hasta=2026-09-30&motivo=${encodeURIComponent(
        "ROTURA DE EMBALAJES",
      )}`,
    });
    expect(porMotivo.json().page.total).toBe(3);

    const porCodigo = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-09-01&hasta=2026-09-30&codigo=90000002",
    });
    expect(porCodigo.json().page.total).toBe(2);

    const csv = await app.inject({
      method: "GET",
      url: "/api/v1/registros.csv?desde=2026-09-01&hasta=2026-09-30&per_page=2",
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body.charCodeAt(0)).toBe(0xfeff);
    expect(csv.body.split("\r\n").filter(Boolean)).toHaveLength(5);

    const ascendente = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-09-01&hasta=2026-09-30&sort=cantidad&order=asc&per_page=1",
    });
    expect(ascendente.json().data[0].cantidad).toBe("20.0000");

    const paginaInvalida = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-09-01&hasta=2026-09-30&page=0",
    });
    expect(paginaInvalida.statusCode).toBe(422);

    const ordenInvalido = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-09-01&hasta=2026-09-30&sort=descripcion",
    });
    expect(ordenInvalido.statusCode).toBe(422);
  });

  it("publica OpenAPI 3.1 y Swagger UI", async () => {
    const spec = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(spec.statusCode).toBe(200);

    const body = spec.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths["/api/v1/kpis"]).toBeTruthy();
    expect(
      body.paths["/api/v1/kpis"].get.parameters.some(
        (parametro: { name: string; in: string }) =>
          parametro.name === "desde" && parametro.in === "query",
      ),
    ).toBe(true);

    const docs = await app.inject({ method: "GET", url: "/docs" });
    expect([200, 302]).toContain(docs.statusCode);
  });

  it("aplica rate limit global por IP", async () => {
    const appLimitada = await buildApp({
      pool,
      corsOrigins: [],
      logger: false,
      rateLimitMax: 1,
    });

    const primera = await appLimitada.inject({
      method: "GET",
      url: "/api/v1/meta",
    });
    const segunda = await appLimitada.inject({
      method: "GET",
      url: "/api/v1/meta",
    });

    expect(primera.statusCode).toBe(200);
    expect(segunda.statusCode).toBe(429);
    await appLimitada.close();
  });

  it("GET /alertas deriva pico, concentración y variación", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/alertas?desde=2026-09-01&hasta=2026-09-30",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.data.map((alerta: { id: string }) => alerta.id)).toEqual([
      "pico-semanal",
      "concentracion-sku",
      "variacion-wow",
    ]);
    expect(body.data[0]).toMatchObject({
      valor: "100.0000",
      eventos: 1,
      severidad: "alta",
      titulo: "La semana 36 concentra 50.0% de la merma",
    });
    expect(body.data[1].titulo).toContain("75.0%");
    expect(body.data[2]).toMatchObject({
      valor: "0.5000",
      severidad: "media",
      titulo: "Aumento de 50.0% en la última semana",
    });

    const vacio = await app.inject({
      method: "GET",
      url: "/api/v1/alertas?desde=2026-09-01&hasta=2026-09-30&familia=RIBBON",
    });
    expect(vacio.json().data).toEqual([
      {
        id: "sin-datos",
        severidad: "media",
        icono: "info",
        titulo: "Sin datos para el rango seleccionado",
        detalle: "Ajusta el rango de fechas o los filtros para ver alertas.",
        valor: "0.0000",
        eventos: 0,
      },
    ]);
  });

  it("GET /cargas lista el historial de cargas", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/cargas" });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0]).toMatchObject({
      archivo: "api-test.xlsx",
      filas_leidas: 4,
      filas_insertadas: 4,
      estado: "completada",
    });
    expect(res.json().data[0].creada_en).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/,
    );
  });

  it("POST /cargas no pide clave cuando no hay ADMIN_TOKEN", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/cargas",
    });

    // Sin token configurado la petición pasa de largo la autorización y solo
    // falta el archivo.
    expect(res.statusCode).toBe(400);
    expect(res.json().error.codigo).toBe("ARCHIVO_REQUERIDO");
  });

  it("POST /cargas valida token, tipo de contenido y modo", async () => {
    const token = "token-de-prueba-123456";
    const appCarga = await buildApp({
      pool,
      corsOrigins: ["http://localhost:5173"],
      logger: false,
      adminToken: token,
    });

    const salud = await appCarga.inject({
      method: "GET",
      url: "/api/v1/salud",
    });
    expect(salud.json().carga_requiere_token).toBe(true);

    const sinToken = await appCarga.inject({
      method: "POST",
      url: "/api/v1/cargas",
    });
    expect(sinToken.statusCode).toBe(401);
    expect(sinToken.json().error.codigo).toBe("NO_AUTORIZADO");

    const tokenIncorrecto = await appCarga.inject({
      method: "POST",
      url: "/api/v1/cargas",
      headers: { "x-admin-token": "token-equivocado-123" },
    });
    expect(tokenIncorrecto.statusCode).toBe(401);

    const sinMultipart = await appCarga.inject({
      method: "POST",
      url: "/api/v1/cargas",
      headers: { "x-admin-token": token, "content-type": "application/json" },
      payload: { archivo: "nada" },
    });
    expect(sinMultipart.statusCode).toBe(400);
    expect(sinMultipart.json().error.codigo).toBe("ARCHIVO_REQUERIDO");

    const replaceSinConfirmar = await appCarga.inject({
      method: "POST",
      url: "/api/v1/cargas?modo=replace",
      headers: {
        "x-admin-token": token,
        "content-type": "multipart/form-data; boundary=----merma",
      },
    });
    expect(replaceSinConfirmar.statusCode).toBe(422);
    expect(replaceSinConfirmar.json().error.codigo).toBe(
      "CONFIRMACION_REQUERIDA",
    );

    const preflight = await appCarga.inject({
      method: "OPTIONS",
      url: "/api/v1/cargas",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "x-admin-token,content-type",
      },
    });
    expect(preflight.statusCode).toBeLessThan(300);
    expect(preflight.headers["access-control-allow-methods"]).toContain("POST");
    expect(
      String(preflight.headers["access-control-allow-headers"]).toLowerCase(),
    ).toContain("x-admin-token");

    await appCarga.close();
  });
});
