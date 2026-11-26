import { ErrorApi } from "./errores.js";
import { verificarToken } from "./sesion.js";

/**
 * Con sesión configurada, la escritura exige un Bearer válido emitido por el login.
 * Sin sesión configurada (solo desarrollo y pruebas) la escritura queda abierta.
 */
export function exigirAutorizacion(
  sesion: { secreto: string } | null,
  bearer: string | null,
): void {
  if (!sesion) return;
  if (verificarToken(bearer, sesion.secreto)) return;

  throw new ErrorApi(
    "NO_AUTORIZADO",
    "Inicia sesión para realizar esta acción.",
    null,
    401,
  );
}
