import { timingSafeEqual } from "node:crypto";

import { ErrorApi } from "./errores.js";

function tokenValido(recibido: unknown, esperado: string): boolean {
  if (typeof recibido !== "string") return false;

  const a = Buffer.from(recibido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sin ADMIN_TOKEN la escritura queda abierta: es el modo por defecto.
 * Con ADMIN_TOKEN configurado, toda ruta de escritura exige x-admin-token.
 */
export function exigirAutorizacion(
  token: unknown,
  adminToken: string | null,
): void {
  if (!adminToken) return;

  if (!tokenValido(token, adminToken)) {
    throw new ErrorApi(
      "NO_AUTORIZADO",
      "La clave de administración no es válida.",
      null,
      401,
    );
  }
}
