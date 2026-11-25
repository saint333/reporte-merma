import { integer, money, percent } from "../../lib/formatters";
import type { FilaPareto } from "../../lib/types";
import { Badge, tonoClase } from "../ui/Badge";

function BarraAcumulado({ valor }: { valor: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-border h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className="bg-cyan h-full rounded-full"
          style={{ width: `${Math.min(100, Number(valor) * 100)}%` }}
        />
      </div>
      <span className="text-muted text-[11px] tabular-nums">
        {percent(Number(valor), 2)}
      </span>
    </div>
  );
}

export function ParetoTable({
  filas,
  onSeleccionar,
}: {
  filas: FilaPareto[];
  onSeleccionar?: (fila: FilaPareto) => void;
}) {
  function activar(fila: FilaPareto) {
    onSeleccionar?.(fila);
  }

  return (
    <div>
      <div className="border-border hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-header/80 text-muted border-border border-b text-[10px] tracking-[0.08em] uppercase">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Código</th>
              <th className="px-3 py-2.5 font-medium">Descripción</th>
              <th className="px-3 py-2.5 font-medium">Familia</th>
              <th className="px-3 py-2.5 text-right font-medium">Eventos</th>
              <th className="px-3 py-2.5 text-right font-medium">Costo</th>
              <th className="px-3 py-2.5 text-right font-medium">% part.</th>
              <th className="px-3 py-2.5 font-medium">Acumulado</th>
              <th className="px-3 py-2.5 font-medium">Clase</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={fila.codigo}
                tabIndex={onSeleccionar ? 0 : undefined}
                onClick={() => activar(fila)}
                onKeyDown={(evento) => {
                  if (!onSeleccionar) return;
                  if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    activar(fila);
                  }
                }}
                className={`border-border/60 border-b transition-colors last:border-0 ${
                  onSeleccionar
                    ? "hover:bg-header/60 focus-visible:ring-cyan focus-visible:ring-inset cursor-pointer focus-visible:ring-2 focus-visible:outline-none"
                    : ""
                }`}
              >
                <td
                  className={`px-3 py-2.5 tabular-nums ${
                    fila.clase_abc.startsWith("A")
                      ? "border-l-2 border-l-red"
                      : ""
                  }`}
                >
                  {fila.rank}
                </td>
                <td className="text-muted px-3 py-2.5 font-mono text-[11px]">
                  {fila.codigo}
                </td>
                <td className="text-ink max-w-[280px] truncate px-3 py-2.5">
                  {fila.descripcion}
                </td>
                <td className="text-muted px-3 py-2.5">{fila.familia}</td>
                <td className="text-muted px-3 py-2.5 text-right tabular-nums">
                  {integer(fila.eventos)}
                </td>
                <td className="text-ink px-3 py-2.5 text-right tabular-nums">
                  {money(fila.costo)}
                </td>
                <td className="text-muted px-3 py-2.5 text-right tabular-nums">
                  {percent(Number(fila.participacion), 2)}
                </td>
                <td className="px-3 py-2.5">
                  <BarraAcumulado valor={fila.acumulado} />
                </td>
                <td className="px-3 py-2.5">
                  <Badge
                    tono={tonoClase(fila.clase_abc)}
                    className="w-6 justify-center"
                  >
                    {fila.clase_abc.slice(0, 1)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {filas.map((fila) => (
          <li key={fila.codigo}>
            <button
              type="button"
              onClick={() => activar(fila)}
              className="border-border bg-header/40 w-full rounded-md border p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-muted font-mono text-[10px]">
                    #{fila.rank} · {fila.codigo}
                  </p>
                  <p className="text-ink mt-1 truncate text-xs font-medium">
                    {fila.descripcion}
                  </p>
                </div>
                <Badge
                  tono={tonoClase(fila.clase_abc)}
                  className="w-6 justify-center"
                >
                  {fila.clase_abc.slice(0, 1)}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <span>
                  <span className="text-muted block">Costo</span>
                  <span className="text-ink tabular-nums">
                    {money(fila.costo)}
                  </span>
                </span>
                <span>
                  <span className="text-muted block">Part.</span>
                  <span className="text-ink tabular-nums">
                    {percent(Number(fila.participacion), 2)}
                  </span>
                </span>
                <span>
                  <span className="text-muted block">Acum.</span>
                  <span className="text-ink tabular-nums">
                    {percent(Number(fila.acumulado), 2)}
                  </span>
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
