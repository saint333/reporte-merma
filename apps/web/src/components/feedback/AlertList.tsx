import { Link } from "react-router-dom";

import { money } from "../../lib/formatters";
import type { Alerta, Filtros } from "../../lib/types";
import { Badge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { ColdStartNotice } from "./ColdStartNotice";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

function enlaceAlerta(filtro: string, filtros: Filtros): string {
  const [ruta, query = ""] = filtro.split("?");
  const params = new URLSearchParams(query);
  params.set("desde", filtros.desde);
  params.set("hasta", filtros.hasta);

  if (filtros.mes) params.set("mes", filtros.mes);
  if (filtros.programa) params.set("programa", filtros.programa);
  if (filtros.familia) params.set("familia", filtros.familia);
  if (filtros.gestion) params.set("gestion", filtros.gestion);

  return `${ruta}?${params.toString()}`;
}

function IconoAlerta() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.6 2.4 17.3a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function AlertList({
  alertas,
  filtros,
  cargando,
  error,
  onRetry,
  failureCount = 0,
}: {
  alertas?: Alerta[];
  filtros: Filtros;
  cargando: boolean;
  error?: unknown;
  onRetry?: () => void;
  failureCount?: number;
}) {
  if (cargando) {
    return failureCount > 0 ? (
      <ColdStartNotice />
    ) : (
      <div className="space-y-2">
        {[0, 1, 2].map((indice) => (
          <Skeleton key={indice} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} compact />;
  }

  if (!alertas?.length) {
    return <EmptyState mensaje="No hay alertas para este rango." />;
  }

  return (
    <ul className="space-y-2">
      {alertas.map((alerta) => (
        <li
          key={alerta.id}
          className="border-border bg-header/50 rounded-md border p-3"
        >
          <div className="flex items-start gap-2">
            <span
              className={
                alerta.severidad === "alta"
                  ? "text-red mt-0.5"
                  : "text-amber mt-0.5"
              }
            >
              <IconoAlerta />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-ink text-xs font-semibold">
                  {alerta.titulo}
                </p>
                <Badge tono={alerta.severidad}>{alerta.severidad}</Badge>
              </div>
              <p className="text-muted mt-1 text-[11px] leading-relaxed">
                {alerta.detalle}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-ink text-[11px] tabular-nums">
                  {money(alerta.valor)}
                </span>
                {alerta.accion && (
                  <Link
                    to={enlaceAlerta(alerta.accion.filtro, filtros)}
                    className="text-cyan text-[11px] font-semibold underline underline-offset-4"
                  >
                    {alerta.accion.texto}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
