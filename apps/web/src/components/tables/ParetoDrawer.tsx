import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "primereact/button";

import { dateLabel, money } from "../../lib/formatters";
import { registrosSkuQuery } from "../../lib/queries";
import type { FilaPareto, Filtros } from "../../lib/types";
import { Skeleton } from "../ui/Skeleton";
import { ErrorState } from "../feedback/ErrorState";

export function ParetoDrawer({
  fila,
  filtros,
  onClose,
}: {
  fila: FilaPareto | null;
  filtros: Filtros;
  onClose: () => void;
}) {
  const registros = useQuery(
    registrosSkuQuery(filtros, fila?.codigo ?? null),
  );

  useEffect(() => {
    if (!fila) return;

    function cerrarConEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") onClose();
    }

    window.addEventListener("keydown", cerrarConEscape);
    return () => window.removeEventListener("keydown", cerrarConEscape);
  }, [fila, onClose]);

  if (!fila) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-drawer"
        onClick={(evento) => evento.stopPropagation()}
        className="bg-surface border-border flex h-full w-full max-w-md flex-col border-l shadow-2xl"
      >
        <header className="border-border flex items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <p className="text-muted text-[10px] tracking-[0.12em] uppercase">
              SKU {fila.codigo}
            </p>
            <h2
              id="titulo-drawer"
              className="text-ink mt-1 text-sm font-semibold"
            >
              {fila.descripcion}
            </h2>
            <p className="text-muted mt-1 text-[11px]">
              {fila.familia} · {fila.programa} · {fila.eventos} eventos
            </p>
          </div>
          <Button
            type="button"
            label="Cerrar"
            icon="pi pi-times"
            size="small"
            outlined
            severity="secondary"
            aria-label="Cerrar detalle"
            onClick={onClose}
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {registros.isPending && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((indice) => (
                <Skeleton key={indice} className="h-14 w-full" />
              ))}
            </div>
          )}

          {registros.error && (
            <ErrorState
              error={registros.error}
              onRetry={() => void registros.refetch()}
              compact
            />
          )}

          {registros.data && (
            <ul className="space-y-2">
              {registros.data.data.map((registro) => (
                <li
                  key={registro.id}
                  className="border-border bg-header/40 rounded-md border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-muted text-[10px]">
                      {dateLabel(registro.fecha)} · S{registro.semana_iso}
                    </p>
                    <p className="text-ink text-xs font-semibold tabular-nums">
                      {money(registro.costo_total)}
                    </p>
                  </div>
                  <p className="text-ink mt-1 text-xs">{registro.motivo}</p>
                  <p className="text-muted mt-0.5 text-[10px]">
                    {registro.gestion} · {registro.cantidad} {registro.um}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
