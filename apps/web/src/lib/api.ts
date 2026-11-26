import { borrarSesion, guardarSesion, tokenSesion, type Sesion } from "./sesion";
import type {
  EdicionRegistroEntrada,
  RegistroEditado,
  RegistroManualCreado,
  RegistroManualEntrada,
  ReporteCarga,
  SnapshotRegistro,
} from "./types";

export type Parametros = Record<
  string,
  string | number | undefined | null
>;

export type ErrorApiPayload = {
  error?: {
    codigo?: string;
    mensaje?: string;
    detalle?: unknown;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ErrorApiPayload | null,
  ) {
    super(
      payload?.error?.mensaje ??
        (status === 0
          ? "No pudimos conectar con la API"
          : `La API respondió con estado ${status}`),
    );
    this.name = "ApiError";
  }

  get codigo(): string | undefined {
    return this.payload?.error?.codigo;
  }
}

const BASE = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

/** Se invoca cuando la API responde 401 a una petición con sesión. */
let alSesionVencida: (() => void) | null = null;

export function alSesionVencidaCallback(callback: (() => void) | null): void {
  alSesionVencida = callback;
}

function cabeceraSesion(): Record<string, string> {
  const token = tokenSesion();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function revisarSesion(respuesta: Response): void {
  if (respuesta.status === 401 && tokenSesion()) {
    borrarSesion();
    alSesionVencida?.();
  }
}

function construirUrl(path: string, params: Parametros): string {
  const qs = new URLSearchParams();

  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === "") continue;
    qs.set(clave, String(valor));
  }

  const query = qs.toString();
  return `${BASE}${path}${query ? `?${query}` : ""}`;
}

export async function getJson<T>(
  path: string,
  params: Parametros = {},
  signal?: AbortSignal,
): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(construirUrl(path, params), {
      signal,
      headers: { Accept: "application/json", ...cabeceraSesion() },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, null);
  }

  if (!respuesta.ok) {
    revisarSesion(respuesta);
    const payload = (await respuesta
      .json()
      .catch(() => null)) as ErrorApiPayload | null;
    throw new ApiError(respuesta.status, payload);
  }

  return (await respuesta.json()) as T;
}

async function enviarJson<T>(
  path: string,
  metodo: "POST" | "PATCH" | "DELETE",
  cuerpo: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...cabeceraSesion() };
  if (cuerpo !== undefined) headers["content-type"] = "application/json";

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${path}`, {
      method: metodo,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, null);
  }

  const payload = (await respuesta
    .json()
    .catch(() => null)) as (ErrorApiPayload & { data?: T }) | null;

  if (!respuesta.ok || !payload?.data) {
    revisarSesion(respuesta);
    throw new ApiError(respuesta.status, payload);
  }

  return payload.data;
}

export async function iniciarSesion(
  usuario: string,
  password: string,
  signal?: AbortSignal,
): Promise<Sesion> {
  const data = await enviarJson<{ token: string; usuario: string; expira: string }>(
    "/api/v1/auth/login",
    "POST",
    { usuario, password },
    signal,
  );
  const sesion: Sesion = { token: data.token, usuario: data.usuario, expira: data.expira };
  guardarSesion(sesion);
  return sesion;
}

export function cerrarSesion(): void {
  borrarSesion();
}

export async function actualizarRegistro(
  id: number,
  entrada: EdicionRegistroEntrada,
  signal?: AbortSignal,
): Promise<RegistroEditado> {
  return enviarJson<RegistroEditado>(
    `/api/v1/registros/${id}`,
    "PATCH",
    entrada,
    signal,
  );
}

export async function eliminarRegistro(
  id: number,
  signal?: AbortSignal,
): Promise<SnapshotRegistro> {
  const data = await enviarJson<{ registro: SnapshotRegistro }>(
    `/api/v1/registros/${id}`,
    "DELETE",
    undefined,
    signal,
  );

  return data.registro;
}

export async function subirCarga(
  archivo: File,
  modo: "append" | "replace",
  signal?: AbortSignal,
): Promise<ReporteCarga> {
  const form = new FormData();
  form.append("archivo", archivo, archivo.name);

  const query = new URLSearchParams({ modo });
  if (modo === "replace") query.set("confirmar", "true");

  const headers: Record<string, string> = { ...cabeceraSesion() };

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}/api/v1/cargas?${query.toString()}`, {
      method: "POST",
      body: form,
      signal,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, null);
  }

  const payload = (await respuesta
    .json()
    .catch(() => null)) as (ErrorApiPayload & { data?: ReporteCarga }) | null;

  if (!respuesta.ok || !payload?.data) {
    throw new ApiError(respuesta.status, payload);
  }

  return payload.data;
}

export async function crearRegistroManual(
  entrada: RegistroManualEntrada,
  signal?: AbortSignal,
): Promise<RegistroManualCreado> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Accept: "application/json",
    ...cabeceraSesion(),
  };

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}/api/v1/registros`, {
      method: "POST",
      body: JSON.stringify(entrada),
      signal,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, null);
  }

  const payload = (await respuesta
    .json()
    .catch(() => null)) as (ErrorApiPayload & {
    data?: RegistroManualCreado;
  }) | null;

  if (!respuesta.ok || !payload?.data) {
    throw new ApiError(respuesta.status, payload);
  }

  return payload.data;
}

export async function descargarCsv(
  params: Parametros,
  nombre = "registros.csv",
): Promise<void> {
  let respuesta: Response;

  try {
    respuesta = await fetch(construirUrl("/api/v1/registros.csv", params), {
      headers: cabeceraSesion(),
    });
  } catch {
    throw new ApiError(0, null);
  }

  if (!respuesta.ok) {
    revisarSesion(respuesta);
    const payload = (await respuesta
      .json()
      .catch(() => null)) as ErrorApiPayload | null;
    throw new ApiError(respuesta.status, payload);
  }

  const blob = await respuesta.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
