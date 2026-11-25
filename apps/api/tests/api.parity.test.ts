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

  it("GET /series/mensual reproduce los meses del libro", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/series/mensual?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.data).toHaveLength(7);
    expect(body.data[0]).toEqual({
      mes: "2026-05",
      eventos: 84,
      costo: "162.3657",
      participacion: "0.0090",
    });
    expect(body.data[4]).toEqual({
      mes: "2026-09",
      eventos: 320,
      costo: "9108.9505",
      participacion: "0.5061",
    });
    expect(body.meta.total).toEqual({ eventos: 1618, costo: "17999.6033" });
  });

  it("GET /series/semanal reproduce la serie ISO y el pico", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/series/semanal?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.data).toHaveLength(28);
    expect(body.data[0]).toMatchObject({
      semana_iso: 19,
      inicio: "2026-05-04",
      eventos: 1,
      costo: "0.2904",
      es_atipica: false,
    });
    expect(body.data[27]).toMatchObject({
      semana_iso: 46,
      inicio: "2026-11-09",
      eventos: 57,
      costo: "488.2063",
      wow_pct: -0.5537,
    });

    const pico = body.data.find(
      (fila: { semana_iso: number }) => fila.semana_iso === 40,
    );
    expect(pico).toMatchObject({
      costo: "5579.3052",
      eventos: 79,
      es_atipica: true,
    });
    expect(body.resumen).toEqual({
      semanas: 28,
      promedio: "642.8430",
      promedio_ajustado: "342.6986",
      umbral: "3000.00",
    });
  });

  it("GET /cortes/* reproduce los rankings del dashboard", async () => {
    const motivos = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/motivos?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(motivos.statusCode).toBe(200);
    expect(motivos.json().data).toHaveLength(13);
    expect(motivos.json().data[0]).toMatchObject({
      clave: "CONTRAMUESTRA",
      gestion: "Estándar Técnico",
      eventos: 37,
      costo: "3594.0076",
      participacion: "0.1997",
      orden: 1,
    });
    expect(motivos.json().total).toEqual({
      eventos: 1618,
      costo: "17999.6033",
    });

    const familias = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/familias?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(familias.json().data).toHaveLength(8);
    expect(familias.json().data[0]).toMatchObject({
      clave: "ETIQUETAS",
      eventos: 732,
      costo: "5635.0527",
      pallets_equiv: "0.687946",
      participacion: "0.3131",
      orden: 1,
    });

    const programas = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/programas?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(programas.json().data).toHaveLength(5);
    expect(programas.json().data[0]).toMatchObject({
      clave: "GENÉRICO",
      costo: "14007.7370",
      participacion: "0.7782",
    });

    const gestion = await app.inject({
      method: "GET",
      url: "/api/v1/cortes/gestion?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(gestion.json().data[0]).toMatchObject({
      clave: "Controlable",
      eventos: 1418,
      costo: "11232.0822",
      participacion: "0.6240",
    });
    expect(gestion.json().data[2]).toMatchObject({
      clave: "Por Auditar",
      eventos: 7,
      costo: "1118.1265",
    });
  });

  it("GET /pareto reproduce 14 clase A y el top 15", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pareto?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.data).toHaveLength(15);
    expect(body.data[0]).toMatchObject({
      rank: 1,
      codigo: 13060001,
      eventos: 6,
      cantidad: "13875.0000",
      costo: "3885.0000",
      participacion: "0.215838",
      acumulado: "0.215838",
      clase_abc: "A (Crítico)",
      prioridad: "CRÍTICO (A)",
    });
    expect(body.data[14]).toMatchObject({
      rank: 15,
      codigo: 31070001,
      costo: "319.5779",
      acumulado: "0.810935",
      clase_abc: "B (Moderado)",
      prioridad: "ALTO IMPACTO",
    });
    expect(body.resumen).toEqual({
      skus: 79,
      clase_a: 14,
      clase_b: 24,
      clase_c: 41,
      costo_top: "14596.5068",
      participacion_top: "0.810935",
    });
  });

  it("GET /proyeccion reproduce los escenarios A/B/C", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/proyeccion?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const { parametros, escenarios } = res.json().data;
    expect(parametros).toEqual({
      acumulado: "17999.6033",
      semanas_observadas: 28,
      promedio_global: "642.8430",
      promedio_ajustado: "342.6986",
      semanas_excluidas: [39, 40],
      semanas_restantes: 6,
      meta_reduccion: 0.25,
      proporcion_controlable: "0.6240",
    });
    expect(escenarios).toEqual([
      {
        id: "tendencial",
        nombre: "A. Tendencial histórico",
        tasa: "642.8430",
        proyeccion_6s: "3857.0579",
        cierre: "21856.6612",
        ahorro: "0.0000",
      },
      {
        id: "base",
        nombre: "B. Base operativo",
        tasa: "342.6986",
        proyeccion_6s: "2056.1914",
        cierre: "20055.7947",
        ahorro: "1800.8664",
      },
      {
        id: "meta",
        nombre: "C. Meta optimizada",
        tasa: "289.2376",
        proyeccion_6s: "1735.4256",
        cierre: "19735.0289",
        ahorro: "2121.6323",
      },
    ]);

    const conFiltro = await app.inject({
      method: "GET",
      url: `/api/v1/proyeccion?desde=2026-05-08&hasta=2026-11-11&programa=${encodeURIComponent(
        "GENÉRICO",
      )}`,
    });
    expect(conFiltro.json().data).toEqual(res.json().data);
  });

  it("GET /registros pagina, filtra y exporta CSV", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.page).toEqual({
      page: 1,
      per_page: 50,
      total: 1618,
      pages: 33,
    });
    expect(body.data[0].id).toBeGreaterThan(0);
    expect(body.data[0]).toMatchObject({
      fecha: "2026-11-11",
      semana_iso: 46,
      mes: "2026-11",
      motivo: "APILADO",
      gestion: "Controlable",
      costo_total: "58.8703",
      es_duplicado: false,
    });

    const sinClasificar = await app.inject({
      method: "GET",
      url: `/api/v1/registros?desde=2026-05-08&hasta=2026-11-11&motivo=${encodeURIComponent(
        "SIN CLASIFICAR",
      )}`,
    });
    expect(sinClasificar.json().page.total).toBe(7);

    const sku = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-05-08&hasta=2026-11-11&codigo=13060001",
    });
    expect(sku.json().page.total).toBe(6);

    const busqueda = await app.inject({
      method: "GET",
      url: "/api/v1/registros?desde=2026-05-08&hasta=2026-11-11&q=ATMOSFERA",
    });
    expect(busqueda.json().page.total).toBe(6);

    const csv = await app.inject({
      method: "GET",
      url: "/api/v1/registros.csv?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(csv.statusCode).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.body.charCodeAt(0)).toBe(0xfeff);
    expect(csv.body.split("\r\n").filter(Boolean)).toHaveLength(1619);
  });

  it("GET /alertas reproduce las seis alertas del archivo", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/alertas?desde=2026-05-08&hasta=2026-11-11",
    });
    expect(res.statusCode).toBe(200);

    const { data } = res.json();
    expect(data.map((alerta: { id: string }) => alerta.id)).toEqual([
      "sin-clasificar",
      "duplicados",
      "motivo-huerfano",
      "pico-semanal",
      "concentracion-sku",
      "variacion-wow",
    ]);
    expect(data[0]).toMatchObject({
      valor: "1118.1265",
      eventos: 7,
      titulo: "7 registros sin motivo por $1,118.13",
    });
    expect(data[1]).toMatchObject({ valor: "24.3581", eventos: 4 });
    expect(data[2]).toMatchObject({
      titulo: "Motivo no catalogado: MALA IMPRESIÓN",
      valor: "39.3084",
      eventos: 3,
    });
    expect(data[3]).toMatchObject({
      valor: "5579.3052",
      eventos: 79,
      severidad: "alta",
    });
    expect(data[4]).toMatchObject({ valor: "3885.0000", eventos: 6 });
    expect(data[5]).toMatchObject({ valor: "-0.5537", severidad: "media" });

    const vacio = await app.inject({
      method: "GET",
      url: "/api/v1/alertas?desde=2025-01-01&hasta=2025-01-31",
    });
    expect(vacio.json().data.map((alerta: { id: string }) => alerta.id)).toEqual([
      "sin-datos",
    ]);
  });
});
