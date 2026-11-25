import { DECISIONES } from "../../content/decisiones";
import { integer, money, percent } from "../../lib/formatters";
import type { FilaCorte } from "../../lib/types";

export function GestionMatrix({ filas }: { filas: FilaCorte[] }) {
  return (
    <div>
      <div className="border-border hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-header/80 text-muted border-border border-b text-[10px] tracking-[0.08em] uppercase">
              <th className="px-3 py-2.5 font-medium">Estado</th>
              <th className="px-3 py-2.5 text-right font-medium">Eventos</th>
              <th className="px-3 py-2.5 text-right font-medium">Costo</th>
              <th className="px-3 py-2.5 text-right font-medium">%</th>
              <th className="px-3 py-2.5 font-medium">Decisión</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={fila.clave}
                className="border-border/60 hover:bg-header/40 border-b transition-colors last:border-0"
              >
                <td className="text-ink px-3 py-2.5 font-medium">{fila.clave}</td>
                <td className="text-muted px-3 py-2.5 text-right tabular-nums">
                  {integer(fila.eventos)}
                </td>
                <td className="text-ink px-3 py-2.5 text-right tabular-nums">
                  {money(fila.costo)}
                </td>
                <td className="text-muted px-3 py-2.5 text-right tabular-nums">
                  {percent(Number(fila.participacion), 2)}
                </td>
                <td className="text-muted px-3 py-2.5">
                  {DECISIONES[fila.clave] ?? "Revisar con el área responsable"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {filas.map((fila) => (
          <li
            key={fila.clave}
            className="border-border bg-header/40 rounded-md border p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-ink text-xs font-semibold">{fila.clave}</p>
              <p className="text-ink text-xs tabular-nums">{money(fila.costo)}</p>
            </div>
            <p className="text-muted mt-1 text-[11px]">
              {integer(fila.eventos)} eventos ·{" "}
              {percent(Number(fila.participacion), 2)} del total
            </p>
            <p className="text-muted mt-2 text-[11px] leading-relaxed">
              {DECISIONES[fila.clave] ?? "Revisar con el área responsable"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
