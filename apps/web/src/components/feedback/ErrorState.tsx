import { Button } from "primereact/button";

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
        <Button
          type="button"
          label="Reintentar"
          icon="pi pi-refresh"
          size="small"
          outlined
          severity="secondary"
          className="mt-3"
          onClick={onRetry}
        />
      )}
    </div>
  );
}
