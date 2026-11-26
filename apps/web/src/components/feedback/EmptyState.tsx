import { Button } from "primereact/button";

export function EmptyState({
  mensaje = "No hay datos para estos filtros.",
  onClear,
}: {
  mensaje?: string;
  onClear?: () => void;
}) {
  return (
    <div className="border-border bg-header/40 rounded-card border border-dashed p-8 text-center">
      <p className="text-ink text-sm font-medium">{mensaje}</p>
      {onClear && (
        <Button
          type="button"
          label="Limpiar filtros"
          text
          size="small"
          className="mt-2"
          onClick={onClear}
        />
      )}
    </div>
  );
}
