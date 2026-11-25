import { money, percent } from "../../lib/formatters";

type FilaTooltip = {
  costo?: string | number;
  eventos?: number;
  participacion?: string | number;
  clase_abc?: string;
  [clave: string]: unknown;
};

type Props = {
  active?: boolean;
  payload?: { payload?: FilaTooltip; value?: string | number; name?: string }[];
  label?: string | number;
  formatearEtiqueta?: (valor: string | number) => string;
};

export function MermaTooltip({
  active,
  payload,
  label,
  formatearEtiqueta,
}: Props) {
  if (!active || !payload?.length) return null;

  const fila = payload[0]?.payload ?? {};
  const etiqueta = formatearEtiqueta
    ? formatearEtiqueta(label ?? "")
    : String(label ?? "");

  return (
    <div className="bg-header border-border rounded-md border px-3 py-2 text-xs shadow-xl">
      <p className="text-ink font-semibold">{etiqueta}</p>
      <p className="text-cyan mt-1 tabular-nums">{money(fila.costo ?? 0)}</p>
      {typeof fila.eventos === "number" && (
        <p className="text-muted mt-0.5">{fila.eventos} eventos</p>
      )}
      {fila.participacion !== undefined && (
        <p className="text-muted mt-0.5">
          {percent(Number(fila.participacion), 2)} del total
        </p>
      )}
    </div>
  );
}

export function PieTooltip({ active, payload }: Props) {
  if (!active || !payload?.length) return null;

  const fila = payload[0];
  const datos = fila?.payload ?? {};

  return (
    <div className="bg-header border-border rounded-md border px-3 py-2 text-xs shadow-xl">
      <p className="text-ink font-semibold">{String(fila?.name ?? "")}</p>
      <p className="text-cyan mt-1 tabular-nums">{money(fila?.value ?? 0)}</p>
      {datos.participacion !== undefined && (
        <p className="text-muted mt-0.5">
          {percent(Number(datos.participacion), 2)} del total
        </p>
      )}
    </div>
  );
}
