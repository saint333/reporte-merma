import { describe, expect, it } from "vitest";

import { paramsFiltros } from "./filters";

describe("paramsFiltros", () => {
  it("convierte los filtros opcionales ausentes en cadenas vacías", () => {
    expect(
      paramsFiltros({ desde: "2026-05-08", hasta: "2026-11-11" }),
    ).toEqual({
      desde: "2026-05-08",
      hasta: "2026-11-11",
      mes: "",
      programa: "",
      familia: "",
      gestion: "",
    });
  });

  it("conserva los filtros que sí tienen valor", () => {
    expect(
      paramsFiltros({
        desde: "2026-05-08",
        hasta: "2026-11-11",
        mes: "2026-07",
        programa: "Frutas",
      }),
    ).toMatchObject({ mes: "2026-07", programa: "Frutas", familia: "" });
  });
});
