import type { ReactNode } from "react";

import { cx } from "../../lib/cx";
import { Skeleton } from "primereact/skeleton";

type Tono = "cyan" | "orange" | "purple" | "green" | "amber" | "red";

const TEXTO: Record<Tono, string> = {
  cyan: "text-cyan",
  orange: "text-orange",
  purple: "text-purple",
  green: "text-green",
  amber: "text-amber",
  red: "text-red",
};

const BORDE: Record<Tono, string> = {
  cyan: "before:bg-cyan",
  orange: "before:bg-orange",
  purple: "before:bg-purple",
  green: "before:bg-green",
  amber: "before:bg-amber",
  red: "before:bg-red",
};

export function KpiCard({
  etiqueta,
  valor,
  detalle,
  tono = "cyan",
  cargando = false,
  icono,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: Tono;
  cargando?: boolean;
  icono?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "bg-surface border-border rounded-card shadow-card relative overflow-hidden border p-4 before:absolute before:inset-y-0 before:left-0 before:w-0.5",
        BORDE[tono],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted text-[11px] font-medium tracking-[0.12em] uppercase">
          {etiqueta}
        </p>
        {icono && <span className="text-muted/70">{icono}</span>}
      </div>

      {cargando ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
      ) : (
        <>
          <p
            className={cx(
              "mt-2 text-2xl font-semibold tracking-tight tabular-nums lg:text-[32px]",
              TEXTO[tono],
            )}
          >
            {valor}
          </p>
          {detalle && (
            <div className="text-muted mt-1 text-xs leading-relaxed">
              {detalle}
            </div>
          )}
        </>
      )}
    </div>
  );
}
