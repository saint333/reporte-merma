import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { filtrosMeta, parseFiltros } from "../http/filtros.js";
import { envelope } from "../http/respuesta.js";
import { validarValores } from "../services/catalogos.js";
import { obtenerKpis } from "../services/kpis.js";

export function registrarKpis(app: FastifyInstance, pool: Pool): void {
  app.get("/api/v1/kpis", async (request) => {
    const filtros = parseFiltros(request.query);
    await validarValores(pool, filtros);

    const { kpis, filasBase } = await obtenerKpis(pool, filtros);

    return envelope(kpis, {
      filtros: filtrosMeta(filtros),
      filas_base: filasBase,
    });
  });
}
