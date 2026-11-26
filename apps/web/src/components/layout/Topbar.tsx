import { useQuery } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";

import { cerrarSesion } from "../../lib/api";
import { dateTimeLabel } from "../../lib/formatters";
import { useFiltros } from "../../lib/filters";
import { metaQuery } from "../../lib/queries";
import { leerSesion } from "../../lib/sesion";

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
  const navigate = useNavigate();
  const usuario = leerSesion()?.usuario;

  function salir() {
    cerrarSesion();
    navigate("/login", { replace: true });
  }

  const vista =
    meta.data?.vistas.find(
      (opcion) =>
        opcion.desde === filtros.desde && opcion.hasta === filtros.hasta,
    )?.id ?? "custom";

  const opciones = [
    ...(vista === "custom"
      ? [{ id: "custom", nombre: "Personalizado" }]
      : []),
    ...(meta.data?.vistas ?? []),
  ];

  return (
    <header className="border-border bg-header/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            type="button"
            icon="pi pi-bars"
            text
            rounded
            severity="secondary"
            onClick={onAbrirMenu}
            aria-label="Abrir menú"
            aria-controls="menu-lateral"
            aria-expanded={menuAbierto}
            className="lg:hidden!"
          />

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

        <div className="flex shrink-0 items-center gap-2">
        <label className="flex shrink-0 items-center gap-2 text-[10px] tracking-[0.08em] text-muted uppercase">
          <span className="hidden sm:block">Corte</span>
          <Dropdown
            value={vista}
            options={opciones}
            optionLabel="nombre"
            optionValue="id"
            onChange={(evento) => {
              const seleccion = meta.data?.vistas.find(
                (opcion) => opcion.id === evento.value,
              );
              if (seleccion) {
                aplicarVista(seleccion.desde, seleccion.hasta);
              }
            }}
            disabled={!meta.data}
            aria-label="Corte"
            className="max-w-[46vw] text-xs sm:max-w-none"
            style={{ minWidth: "10rem" }}
          />
        </label>
        <Button
            type="button"
            icon="pi pi-sign-out"
            text
            rounded
            severity="secondary"
            onClick={salir}
            aria-label={usuario ? `Cerrar sesión de ${usuario}` : "Cerrar sesión"}
            title="Cerrar sesión"
          />
        </div>
      </div>
    </header>
  );
}
