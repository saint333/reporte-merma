import { describe, expect, it } from "vitest";

import { cargarConfig } from "../src/config.js";

const BASE = {
  DATABASE_URL: "postgresql://merma:merma@localhost:5432/merma_test",
};

describe("CORS_ORIGINS", () => {
  it("en desarrollo acepta localhost por defecto", () => {
    expect(cargarConfig({ ...BASE }).corsOrigins).toEqual(["http://localhost:5173"]);
  });

  it("en producción exige CORS_ORIGINS", () => {
    expect(() =>
      cargarConfig({ ...BASE, APP_ENV: "production", CORS_ORIGINS: " " }),
    ).toThrow(/CORS_ORIGINS es obligatoria/);
  });

  it("en producción rechaza localhost", () => {
    expect(() =>
      cargarConfig({
        ...BASE,
        APP_ENV: "production",
        CORS_ORIGINS: "http://localhost:5173",
      }),
    ).toThrow(/https:\/\/ públicos/);
  });

  it("en producción rechaza orígenes que no son https", () => {
    expect(() =>
      cargarConfig({
        ...BASE,
        APP_ENV: "production",
        CORS_ORIGINS: "http://reporte-merma.netlify.app",
      }),
    ).toThrow(/https:\/\/ públicos/);
  });

  it("en producción acepta orígenes https y limpia espacios", () => {
    expect(
      cargarConfig({
        ...BASE,
        APP_ENV: "production",
        CORS_ORIGINS: " https://reporte-merma.netlify.app , https://otro.example.com ",
      }).corsOrigins,
    ).toEqual(["https://reporte-merma.netlify.app", "https://otro.example.com"]);
  });
});
