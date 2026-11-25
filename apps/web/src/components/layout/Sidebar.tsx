import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";

import { cx } from "../../lib/cx";
import { dateTimeLabel, integer } from "../../lib/formatters";
import { metaQuery, saludQuery } from "../../lib/queries";
import { Icono, type IconoNombre } from "./Iconos";

const TITULO = import.meta.env.VITE_APP_TITLE ?? "Control de Mermas";

type Item = {
  to: string;
  label: string;
  icono: IconoNombre;
  end?: boolean;
};

const SECCIONES: { etiqueta: string; items: Item[] }[] = [
  {
    etiqueta: "General",
    items: [{ to: "/", label: "Dashboard", icono: "panel", end: true }],
  },
  {
    etiqueta: "Datos",
    items: [
      { to: "/registros", label: "Registros", icono: "registros", end: true },
      { to: "/registros/nuevo", label: "Nuevo registro", icono: "agregar" },
      { to: "/cargas", label: "Cargas", icono: "cargas" },
    ],
  },
  {
    etiqueta: "Estudios",
    items: [{ to: "/analisis", label: "Análisis", icono: "analisis" }],
  },
];

export function Sidebar({
  abierto,
  onCerrar,
}: {
  abierto: boolean;
  onCerrar: () => void;
}) {
  const meta = useQuery(metaQuery);
  const salud = useQuery(saludQuery);

  const estado = salud.isPending
    ? {
        texto: "Conectando",
        detalle: "Verificando la API",
        punto: "bg-amber",
        pulso: "animate-pulse",
      }
    : salud.isError
      ? {
          texto: "Sin conexión",
          detalle: "Revisa el servicio",
          punto: "bg-red",
          pulso: "",
        }
      : {
          texto: "Sistema operativo",
          detalle: "API conectada",
          punto: "bg-green",
          pulso: "",
        };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCerrar}
        className={cx(
          "bg-page/70 fixed inset-0 z-30 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          abierto ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="menu-lateral"
        className={cx(
          "border-border bg-header/95 fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r backdrop-blur-xl transition-transform duration-200 ease-out lg:visible lg:translate-x-0 lg:bg-header/70",
          abierto ? "translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <div className="border-border flex items-center gap-3 border-b px-4 py-4">
          <span
            aria-hidden="true"
            className="bg-cyan/10 ring-cyan/25 grid size-10 shrink-0 place-items-center rounded-xl ring-1"
          >
            <span className="flex items-end gap-[3px]">
              <span className="bg-cyan/60 h-2 w-1 rounded-full" />
              <span className="bg-cyan/80 h-3.5 w-1 rounded-full" />
              <span className="bg-cyan h-5 w-1 rounded-full" />
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-[13px] font-semibold tracking-tight">
              {TITULO}
            </p>
            <p className="text-muted mt-0.5 truncate text-[10px] font-medium tracking-[0.12em] uppercase">
              Lambayeque · 2026
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar menú"
            className="text-muted hover:bg-white/5 hover:text-ink focus-visible:ring-cyan grid size-8 shrink-0 place-items-center rounded-md transition focus-visible:ring-2 focus-visible:outline-none lg:hidden"
          >
            <Icono nombre="cerrar" className="size-4" />
          </button>
        </div>

        <nav
          aria-label="Secciones"
          className="flex-1 space-y-6 overflow-y-auto px-3 py-5"
        >
          {SECCIONES.map((seccion) => (
            <div key={seccion.etiqueta}>
              <p className="text-muted/70 px-3 pb-2 text-[9px] font-semibold tracking-[0.18em] uppercase">
                {seccion.etiqueta}
              </p>
              <ul className="space-y-1">
                {seccion.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cx(
                          "group focus-visible:ring-cyan relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                          isActive
                            ? "bg-cyan/10 text-cyan"
                            : "text-muted hover:bg-white/5 hover:text-ink",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden="true"
                            className={cx(
                              "bg-cyan absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-full transition-opacity",
                              isActive ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <Icono
                            nombre={item.icono}
                            className="size-[18px] shrink-0"
                          />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-border space-y-2 border-t px-3 py-3">
          <div className="border-border bg-page/40 flex items-start gap-2.5 rounded-md border px-3 py-2">
            <span
              aria-hidden="true"
              className={cx(
                "mt-1 size-2 shrink-0 rounded-full",
                estado.punto,
                estado.pulso,
              )}
            />
            <div className="min-w-0">
              <p className="text-ink truncate text-[11px] font-semibold">
                {estado.texto}
              </p>
              <p className="text-muted truncate text-[10px]">{estado.detalle}</p>
            </div>
          </div>

          <div className="border-border/70 rounded-md border px-3 py-2">
            <p className="text-muted text-[9px] font-semibold tracking-[0.14em] uppercase">
              Última carga
            </p>
            <p className="text-ink mt-1 truncate text-[11px] font-medium">
              {meta.data?.ultima_carga
                ? dateTimeLabel(meta.data.ultima_carga.creada_en)
                : meta.isPending
                  ? "Consultando"
                  : "Sin cargas"}
            </p>
            {meta.data && (
              <p className="text-muted mt-0.5 truncate text-[10px] tabular-nums">
                {integer(meta.data.totales.registros)} eventos ·{" "}
                {integer(meta.data.totales.materiales)} SKUs
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
