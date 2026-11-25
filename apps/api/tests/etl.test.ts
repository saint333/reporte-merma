import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Decimal } from "decimal.js";
import ExcelJS from "exceljs";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { costoTotal } from "../src/etl/dinero.js";
import { fechaISO, semanaISO } from "../src/etl/fechas.js";
import { hashFila } from "../src/etl/hash.js";
import { ejecutar } from "../src/etl/load-xlsx.js";
import {
  normalizar,
  resolverMotivo,
  validarFila,
  type Material,
} from "../src/etl/reglas.js";

const material: Material = {
  codigo: 13060001,
  descripcion: "BOLSA ATMÓSFERA 4KG",
  um: "UNI",
  valorUnitario: "0.2800000000",
  codSubgrupo: "001",
  grupoMaterial: "BOLSAS",
  programa: "GENÉRICO",
  unidadesPorPallet: 84000,
};

const catalogo = new Set([
  "ROTURA DE EMBALAJES",
  "ERROR DE IMPRESIÓN",
  "SIN CLASIFICAR",
]);
const alias = new Map([["MALA IMPRESIÓN", "ERROR DE IMPRESIÓN"]]);

function revisar(overrides: Partial<Parameters<typeof validarFila>[0]> = {}) {
  return validarFila({
    fecha: "2026-09-01",
    codigo: material.codigo,
    cantidad: new Decimal(10),
    motivoOriginal: "ROTURA DE EMBALAJES",
    material,
    catalogo,
    alias,
    esDuplicado: false,
    ...overrides,
  });
}

describe("redondeo de dinero", () => {
  it("reproduce el ROUND de 15 dígitos del Excel", () => {
    expect(costoTotal("50", "0.005699")).toBe("0.2850");
    expect(costoTotal("3", "5.09985")).toBe("15.2996");
    expect(costoTotal("75", "0.0038722407")).toBe("0.2904");
  });
});

describe("fechas", () => {
  it("convierte Date UTC y texto ISO", () => {
    expect(fechaISO(new Date("2026-05-08T00:00:00.000Z"))).toBe("2026-05-08");
    expect(fechaISO("2026-11-23")).toBe("2026-11-23");
    expect(fechaISO("no es fecha")).toBeNull();
  });

  it("calcula semanas ISO", () => {
    expect(semanaISO("2026-05-08")).toBe(19);
    expect(semanaISO("2026-11-23")).toBe(48);
    expect(semanaISO("2026-01-01")).toBe(1);
    expect(semanaISO("2026-12-31")).toBe(53);
  });
});

describe("motivos", () => {
  it("normaliza tildes, mayúsculas y espacios", () => {
    expect(normalizar("  mala   impresión ")).toBe("MALA IMPRESIÓN");
  });

  it("resuelve catálogo, alias y huérfano", () => {
    expect(resolverMotivo("rotura de embalajes", catalogo, alias)).toEqual({
      codigo: "ROTURA DE EMBALAJES",
      esAlias: false,
      huerfano: false,
    });
    expect(resolverMotivo("MALA IMPRESIÓN", catalogo, alias)).toEqual({
      codigo: "ERROR DE IMPRESIÓN",
      esAlias: true,
      huerfano: false,
    });
    expect(resolverMotivo("MOTIVO RARO", catalogo, alias)).toEqual({
      codigo: "SIN CLASIFICAR",
      esAlias: false,
      huerfano: true,
    });
  });
});

describe("validación de filas", () => {
  it("rechaza un código inexistente", () => {
    const revision = revisar({ codigo: 99999999, material: undefined });
    expect(revision.estado).toBe("error");
    expect(revision.observaciones[0]?.codigo).toBe("MATERIAL_NO_REGISTRADO");
  });

  it("rechaza cantidad cero o negativa", () => {
    const revision = revisar({ cantidad: new Decimal(0) });
    expect(revision.estado).toBe("error");
    expect(revision.observaciones[0]?.codigo).toBe("CANTIDAD_INVALIDA");
  });

  it("marca alias y conserva el motivo resuelto", () => {
    const revision = revisar({ motivoOriginal: "MALA IMPRESIÓN" });
    expect(revision.estado).toBe("observada");
    expect(revision.motivoCodigo).toBe("ERROR DE IMPRESIÓN");
    expect(revision.observaciones.map((o) => o.codigo)).toContain("MOTIVO_ALIAS");
  });

  it("marca motivo no catalogado como SIN CLASIFICAR", () => {
    const revision = revisar({ motivoOriginal: "MOTIVO RARO" });
    expect(revision.estado).toBe("observada");
    expect(revision.motivoCodigo).toBe("SIN CLASIFICAR");
    expect(revision.observaciones.map((o) => o.codigo)).toContain(
      "MOTIVO_NO_CATALOGADO",
    );
  });

  it("marca duplicado, fecha fuera de campaña y cantidad atípica", () => {
    expect(revisar({ esDuplicado: true }).observaciones.map((o) => o.codigo)).toContain(
      "POSIBLE_DUPLICADO",
    );
    expect(revisar({ fecha: "2025-12-31" }).observaciones.map((o) => o.codigo)).toContain(
      "FECHA_FUERA_DE_CAMPANIA",
    );
    expect(
      revisar({ cantidad: new Decimal("10000001") }).observaciones.map((o) => o.codigo),
    ).toContain("CANTIDAD_ATIPICA");
  });
});

describe("hash de fila", () => {
  it("ignora mayúsculas y espacios del motivo", () => {
    const a = hashFila("2026-09-01", 13060001, "10.0000", "ROTURA DE EMBALAJES");
    const b = hashFila("2026-09-01", 13060001, "10", "  rotura   de embalajes ");
    expect(a).toBe(b);
  });
});

describe("archivo inválido", () => {
  let dir = "";

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "merma-etl-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("falla si faltan hojas", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("REGISTRO_MERMAS").addRow(["solo una hoja"]);
    const ruta = path.join(dir, "incompleto.xlsx");
    await wb.xlsx.writeFile(ruta);

    await expect(
      ejecutar({ ruta }, "dry-run", {
        pool: {} as Pool,
        reportDir: dir,
      }),
    ).rejects.toThrow(/Faltan hojas/);
  });
});
