import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { alSesionVencidaCallback, ApiError, getJson } from "./api";
import { guardarSesion, tokenSesion } from "./sesion";

const almacen = new Map<string, string>();

function simularSessionStorage(): void {
  almacen.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (clave: string) => almacen.get(clave) ?? null,
    setItem: (clave: string, valor: string) => almacen.set(clave, valor),
    removeItem: (clave: string) => almacen.delete(clave),
    clear: () => almacen.clear(),
  });
}

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getJson", () => {
  beforeEach(() => {
    simularSessionStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    alSesionVencidaCallback(null);
  });

  it("envía el Bearer guardado y omite parámetros vacíos", async () => {
    guardarSesion({ token: "tok-123", usuario: "admin", expira: "2099-01-01T00:00:00Z" });
    const fetchMock = vi.fn().mockResolvedValue(respuesta(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await getJson("/api/v1/cargas", { desde: "2026-05-08", mes: "", programa: undefined });

    const [url, opciones] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/cargas?desde=2026-05-08");
    expect(url).not.toContain("mes=");
    expect(url).not.toContain("programa=");
    expect((opciones.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("lanza ApiError con el código de la API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respuesta(422, { error: { codigo: "FILTRO_INVALIDO", mensaje: "Fecha inválida" } }),
      ),
    );

    const error = await getJson("/api/v1/registros").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).codigo).toBe("FILTRO_INVALIDO");
    expect((error as ApiError).message).toBe("Fecha inválida");
  });

  it("con sesión, un 401 cierra la sesión y avisa", async () => {
    guardarSesion({ token: "vencido", usuario: "admin", expira: "2099-01-01T00:00:00Z" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuesta(401, { error: { codigo: "SESION_REQUERIDA" } })),
    );
    const avisar = vi.fn();
    alSesionVencidaCallback(avisar);

    await expect(getJson("/api/v1/cargas")).rejects.toBeInstanceOf(ApiError);

    expect(avisar).toHaveBeenCalledOnce();
    expect(tokenSesion()).toBeNull();
  });

  it("sin conexión lanza ApiError con status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await getJson("/api/v1/salud").catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(0);
  });
});
