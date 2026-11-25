export function ColdStartNotice() {
  return (
    <div
      role="status"
      className="rounded-card border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"
    >
      <p className="font-semibold">El servidor está despertando…</p>
      <p className="mt-1 text-xs text-amber-200/80">
        Puede tardar hasta 40 segundos. Reintentando automáticamente.
      </p>
    </div>
  );
}
