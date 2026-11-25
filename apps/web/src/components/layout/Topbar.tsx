import { useQuery } from "@tanstack/react-query";

import { dateTimeLabel, integer } from "../../lib/formatters";
import { useFiltros } from "../../lib/filters";
import { metaQuery, saludQuery } from "../../lib/queries";
import { Tabs } from "./Tabs";

const TITULO = import.meta.env.VITE_APP_TITLE ?? "Control de Mermas";

export function Topbar() {
  const { filtros, aplicarVista } = useFiltros();
  const meta = useQuery(metaQuery);
  const salud = useQuery(saludQuery);

  const vista =
    meta.data?.vistas.find(
      (opcion) =>
        opcion.desde === filtros.desde && opcion.hasta === filtros.hasta,
    )?.id ?? "custom";

  const estado = salud.isPending
    ? { texto: "Conectando", clase: "bg-amber/10 text-amber ring-amber/25" }
    : salud.isError
      ? { texto: "Sin conexión", clase: "bg-red/10 text-red ring-red/25" }
      : { texto: "LIVE", clase: "bg-green/10 text-green ring-green/25" };

  return (
    <header className="border-border bg-header/85 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="bg-cyan size-2 rounded-full shadow-[0_0_10px_#22D3EE]" />
            <p className="text-ink text-[11px] font-semibold tracking-[0.16em] uppercase">
              {TITULO}
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ring-1 ${estado.clase}`}
            >
              {estado.texto}
            </span>
          </div>
          <p className="text-muted mt-1 text-[11px]">
            Lambayeque · Campaña 2026
            {meta.data?.ultima_carga
              ? ` · Última carga ${dateTimeLabel(
                  meta.data.ultima_carga.creada_en,
                )}`
              : ""}
            {meta.data
              ? ` · ${integer(meta.data.totales.registros)} eventos · ${integer(
                  meta.data.totales.materiales,
                )} SKUs`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[10px] tracking-[0.08em] text-muted uppercase">
            Corte
            <select
              value={vista}
              onChange={(evento) => {
                const seleccion = meta.data?.vistas.find(
                  (opcion) => opcion.id === evento.target.value,
                );
                if (seleccion) {
                  aplicarVista(seleccion.desde, seleccion.hasta);
                }
              }}
              disabled={!meta.data}
              className="border-border bg-surface text-ink focus-visible:ring-cyan focus-visible:ring-offset-header rounded-md border px-2 py-1 text-xs font-medium normal-case focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
            >
              {vista === "custom" && (
                <option value="custom" disabled>
                  Personalizado
                </option>
              )}
              {meta.data?.vistas.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.nombre}
                </option>
              ))}
            </select>
          </label>
          <Tabs />
        </div>
      </div>
    </header>
  );
}
