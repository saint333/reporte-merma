const CLAVE_SESION = "merma.sesion";

export type Sesion = {
  token: string;
  usuario: string;
  expira: string;
};

export function leerSesion(): Sesion | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESION);
    if (!crudo) return null;
    const sesion = JSON.parse(crudo) as Sesion;
    if (new Date(sesion.expira).getTime() <= Date.now()) {
      borrarSesion();
      return null;
    }
    return sesion;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: Sesion): void {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    // Sin almacenamiento disponible: la sesión dura lo que la pestaña en memoria.
  }
}

export function borrarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    // Sin almacenamiento disponible: nada que limpiar.
  }
}

export function tokenSesion(): string | null {
  return leerSesion()?.token ?? null;
}
