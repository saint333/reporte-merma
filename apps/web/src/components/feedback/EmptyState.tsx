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
        <button
          type="button"
          onClick={onClear}
          className="text-cyan focus-visible:ring-cyan focus-visible:ring-offset-page mt-2 text-xs font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
