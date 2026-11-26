export function Dato({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="border-border bg-header/40 rounded-md border p-3">
      <p className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase">
        {etiqueta}
      </p>
      <p className="text-ink mt-1 text-sm font-semibold">{valor}</p>
      {detalle && <p className="text-muted mt-0.5 text-[11px]">{detalle}</p>}
    </div>
  );
}
