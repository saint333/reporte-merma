import { describe, expect, it } from "vitest";

import {
  emitirToken,
  hashPassword,
  verificarPassword,
  verificarToken,
} from "../src/http/sesion.js";

const SECRETO = "secreto-de-prueba-con-mas-de-32-caracteres";

describe("tokens de sesión", () => {
  it("acepta un token recién emitido y expone el usuario", () => {
    const { token } = emitirToken("admin", SECRETO, 1_000);
    expect(verificarToken(token, SECRETO, 1_001)).toEqual({
      usuario: "admin",
      expira: 1_000 + 8 * 60 * 60,
    });
  });

  it("rechaza un token vencido", () => {
    const { token } = emitirToken("admin", SECRETO, 1_000);
    expect(verificarToken(token, SECRETO, 1_000 + 8 * 60 * 60)).toBeNull();
  });

  it("rechaza un token firmado con otro secreto", () => {
    const { token } = emitirToken("admin", SECRETO, 1_000);
    expect(verificarToken(token, "otro-secreto-distinto-de-prueba-1234", 1_001)).toBeNull();
  });

  it("rechaza un payload alterado", () => {
    const { token } = emitirToken("admin", SECRETO, 1_000);
    const [, firma] = token.split(".") as [string, string];
    const falsoCuerpo = Buffer.from(
      JSON.stringify({ sub: "otro", iat: 1_000, exp: 99_999_999_999 }),
    ).toString("base64url");
    expect(verificarToken(`${falsoCuerpo}.${firma}`, SECRETO, 1_001)).toBeNull();
  });

  it("rechaza valores que no son tokens", () => {
    expect(verificarToken(undefined, SECRETO)).toBeNull();
    expect(verificarToken("sin-punto", SECRETO)).toBeNull();
    expect(verificarToken("a.b.c", SECRETO)).toBeNull();
  });
});

describe("contraseña del administrador", () => {
  it("verifica la contraseña correcta y rechaza otra", async () => {
    const hash = await hashPassword("clave-correcta-123");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verificarPassword("clave-correcta-123", hash)).toBe(true);
    expect(await verificarPassword("clave-incorrecta", hash)).toBe(false);
  });

  it("rechaza un hash con formato desconocido", async () => {
    expect(await verificarPassword("x", "texto-plano")).toBe(false);
  });
});
