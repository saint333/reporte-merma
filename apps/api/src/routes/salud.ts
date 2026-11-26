import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

import { isoLima } from "../http/fechas.js";

export function registrarSalud(
  app: FastifyInstance,
  pool: Pool,
  version: string,
  opciones: { requiereTokenCarga?: boolean } = {},
): void {
  const { requiereTokenCarga = false } = opciones;

  app.get(
    "/api/v1/salud",
    {
      schema: {
        tags: ["Sistema"],
        summary: "Estado del servicio y de la base de datos",
      },
    },
    async (request, reply) => {
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        pool.query("select 1"),
        new Promise<never>((_, rechazar) => {
          timer = setTimeout(
            () => rechazar(new Error("La base no respondió en 2 s")),
            2_000,
          );
        }),
      ]);

      const { rows } = await pool.query<{ creada_en: Date }>(
        `select creada_en
           from merma.carga
          where estado = 'completada'
            and archivo <> 'Registro manual'
          order by creada_en desc, id desc
          limit 1`,
      );

      return {
        estado: "ok",
        db: "ok",
        version,
        carga_requiere_token: requiereTokenCarga,
        ultima_carga: rows[0] ? isoLima(rows[0].creada_en) : null,
      };
    } catch (error) {
      request.log.error({ err: error }, "salud: base no disponible");
      return reply.code(503).send({
        error: {
          codigo: "BASE_NO_DISPONIBLE",
          mensaje: "La base de datos no responde",
          detalle: null,
        },
      });
    } finally {
        if (timer) clearTimeout(timer);
      }
    },
  );
}
