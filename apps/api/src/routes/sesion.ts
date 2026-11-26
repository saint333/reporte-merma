import type { FastifyInstance, FastifyRequest } from "fastify";

import { ErrorApi } from "../http/errores.js";
import {
  emitirToken,
  verificarPassword,
  verificarToken,
} from "../http/sesion.js";
import { envelope } from "../http/respuesta.js";

export type OpcionesSesion = {
  usuario: string;
  passwordHash: string;
  secreto: string;
};

/** Rutas que no exigen sesión aunque la API tenga login configurado. */
const RUTAS_PUBLICAS = new Set([
  "/api/v1/salud",
  "/api/v1/auth/login",
]);

export function extraerBearer(cabecera: unknown): string | null {
  if (typeof cabecera !== "string") return null;
  const coincidencia = /^Bearer\s+(.+)$/i.exec(cabecera.trim());
  return coincidencia?.[1] ?? null;
}

export function registrarSesion(
  app: FastifyInstance,
  opciones: OpcionesSesion,
): void {
  // Sin este hook la API sigue igual; con él, toda ruta /api/v1 exige sesión
  // excepto salud y login. Es el único control de escritura: el token se emite aquí.
  app.addHook("onRequest", async (request: FastifyRequest) => {
    const ruta = (request.routeOptions as { url?: string }).url;
    if (!ruta || !ruta.startsWith("/api/v1/")) return;
    if (RUTAS_PUBLICAS.has(ruta)) return;

    const sesion = verificarToken(
      extraerBearer(request.headers.authorization),
      opciones.secreto,
    );
    if (!sesion) {
      throw new ErrorApi(
        "SESION_REQUERIDA",
        "Inicia sesión para consultar la API.",
        null,
        401,
      );
    }
  });

  app.post<{ Body: { usuario?: unknown; password?: unknown } }>(
    "/api/v1/auth/login",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: {
        tags: ["Sistema"],
        summary: "Inicia sesión y devuelve un token de 8 horas",
        body: {
          type: "object",
          required: ["usuario", "password"],
          additionalProperties: false,
          properties: {
            usuario: { type: "string", minLength: 1, maxLength: 120 },
            password: { type: "string", minLength: 1, maxLength: 512 },
          },
        },
      },
    },
    async (request) => {
      const usuario = String(request.body.usuario ?? "");
      const password = String(request.body.password ?? "");

      const usuarioOk = usuario === opciones.usuario;
      const passwordOk = await verificarPassword(password, opciones.passwordHash);

      if (!usuarioOk || !passwordOk) {
        throw new ErrorApi(
          "CREDENCIALES_INVALIDAS",
          "Usuario o contraseña incorrectos.",
          null,
          401,
        );
      }

      const { token, expira } = emitirToken(usuario, opciones.secreto);
      return envelope({
        token,
        tipo: "Bearer",
        expira: new Date(expira * 1000).toISOString(),
        usuario,
      });
    },
  );
}
