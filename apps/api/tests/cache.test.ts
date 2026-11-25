import { describe, expect, it } from "vitest";

import { CacheApi, claveCache } from "../src/http/cache.js";

describe("CacheApi", () => {
  it("calcula una sola vez por clave y reutiliza el resultado", async () => {
    const cache = new CacheApi(60);
    let llamadas = 0;

    const calcular = async () => {
      llamadas += 1;
      return { valor: llamadas };
    };

    const primero = await cache.obtener("prueba", calcular);
    const segundo = await cache.obtener("prueba", calcular);

    expect(llamadas).toBe(1);
    expect(primero).toBe(segundo);
    expect(segundo).toEqual({ valor: 1 });
  });

  it("separa rutas y filtros distintos", () => {
    const a = claveCache("kpis", { desde: "2026-05-08" });
    const b = claveCache("kpis", { desde: "2026-05-09" });
    const c = claveCache("pareto", { desde: "2026-05-08" });

    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(claveCache("kpis", { desde: "2026-05-08" })).toBe(a);
  });
});
