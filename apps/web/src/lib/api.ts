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
