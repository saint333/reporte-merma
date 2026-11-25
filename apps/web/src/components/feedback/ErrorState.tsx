import { ApiError } from "../../lib/api";

export function mensajeDeError(error: unknown): {
  mensaje: string;
  codigo?: string;
} {
  if (error instanceof ApiError) {
    return {
      mensaje:
        error.status === 0
          ? "No pudimos conectar con la API. Revisa tu red y vuelve a intentarlo."
          : error.message,
      codigo: error.codigo ?? `HTTP ${error.status}`,
    };
  }

  return {
    mensaje: "Ocurrió un error inesperado al cargar los datos.",
  };
}

export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { mensaje, codigo } = mensajeDeError(error);

  return (
    <div
      role="alert"
      className={
        compact
          ? "border-border bg-header/60 rounded-md border p-3 text-sm"
          : "border-border bg-header/60 rounded-card border p-6 text-center"
      }
    >
      <p className="text-ink font-medium">{mensaje}</p>
      {codigo && (
        <p className="text-muted mt-1 font-mono text-[11px]">{codigo}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="border-border bg-surface text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
