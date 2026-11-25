import type {
  RegistroManualCreado,
  RegistroManualEntrada,
  ReporteCarga,
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
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, null);
  }

  if (!respuesta.ok) {
    const payload = (await respuesta
      .json()
      .catch(() => null)) as ErrorApiPayload | null;
    throw new ApiError(respuesta.status, payload);
  }

  return (await respuesta.json()) as T;
}

const CLAVE_TOKEN = "merma.admin-token";

export function leerTokenAdmin(): string {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN) ?? "";
  } catch {
    return "";
  }
}

export function guardarTokenAdmin(token: string): void {
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Navegación privada sin almacenamiento: la clave vive solo en memoria.
  }
}

export async function subirCarga(
  archivo: File,
  modo: "append" | "replace",
  token = "",
  signal?: AbortSignal,
): Promise<ReporteCarga> {
  const form = new FormData();
  form.append("archivo", archivo, archivo.name);

  const query = new URLSearchParams({ modo });
  if (modo === "replace") query.set("confirmar", "true");

  // La clave solo se envía si la API la exige (ADMIN_TOKEN configurado).
  const headers: Record<string, string> = {};
  if (token) headers["x-admin-token"] = token;

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
  token = "",
  signal?: AbortSignal,
): Promise<RegistroManualCreado> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["x-admin-token"] = token;

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
    respuesta = await fetch(construirUrl("/api/v1/registros.csv", params));
  } catch {
    throw new ApiError(0, null);
  }

  if (!respuesta.ok) {
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
