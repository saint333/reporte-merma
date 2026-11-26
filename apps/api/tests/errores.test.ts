import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { registrarErrores } from "../src/http/errores.js";

describe("errores no controlados", () => {
  it("500 incluye el id de la solicitud en detalle", async () => {
    const app = Fastify({ logger: false });
    registrarErrores(app);
    app.get("/fallo", async () => {
      throw new Error("boom");
    });

    const res = await app.inject({ method: "GET", url: "/fallo" });

    expect(res.statusCode).toBe(500);
    expect(res.json().error.codigo).toBe("ERROR_INTERNO");
    expect(res.json().error.detalle.id_incidente).toBeTruthy();
    await app.close();
  });
});
