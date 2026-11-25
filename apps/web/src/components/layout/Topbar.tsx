import { useQuery } from "@tanstack/react-query";

import { dateTimeLabel } from "../../lib/formatters";
import { useFiltros } from "../../lib/filters";
import { metaQuery } from "../../lib/queries";
import { Icono } from "./Iconos";

const TITULO = import.meta.env.VITE_APP_TITLE ?? "Control de Mermas";

export function Topbar({
  onAbrirMenu,
  menuAbierto,
}: {
  onAbrirMenu: () => void;
  menuAbierto: boolean;
}) {
  const { filtros, aplicarVista } = useFiltros();
  const meta = useQuery(metaQuery);

  const vista =
    meta.data?.vistas.find(
      (opcion) =>
        opcion.desde === filtros.desde && opcion.hasta === filtros.hasta,
    )?.id ?? "custom";

  return (
    <header className="border-border bg-header/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onAbrirMenu}
            aria-label="Abrir menú"
            aria-controls="menu-lateral"
            aria-expanded={menuAbierto}
            className="border-border text-muted hover:border-cyan/40 hover:text-ink focus-visible:ring-cyan grid size-9 shrink-0 place-items-center rounded-md border transition focus-visible:ring-2 focus-visible:outline-none lg:hidden"
          >
            <Icono nombre="menu" className="size-4" />
          </button>

          <div className="min-w-0">
            <p className="text-ink truncate text-[13px] font-semibold tracking-tight lg:hidden">
              {TITULO}
            </p>
            <p className="text-muted hidden text-[10px] font-semibold tracking-[0.16em] uppercase lg:block">
              Reporte gerencial
            </p>
            <p className="text-muted mt-0.5 truncate text-[11px]">
              Lambayeque · Campaña 2026
              {meta.data?.ultima_carga
                ? ` · Última carga ${dateTimeLabel(
                    meta.data.ultima_carga.creada_en,
                  )}`
                : ""}
            </p>
          </div>
        </div>

        <label className="flex shrink-0 items-center gap-2 text-[10px] tracking-[0.08em] text-muted uppercase">
          <span className="hidden sm:block">Corte</span>
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
            className="border-border bg-surface text-ink focus-visible:ring-cyan focus-visible:ring-offset-header max-w-[46vw] rounded-md border px-2 py-1.5 text-xs font-medium normal-case focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 sm:max-w-none"
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
      </div>
    </header>
  );
}
