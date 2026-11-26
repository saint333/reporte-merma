import { useState, type ReactNode } from "react";

import { cx } from "../../lib/cx";
import { Skeleton } from "primereact/skeleton";
import { Tooltip } from "primereact/tooltip";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { COLORES } from "../../lib/theme";

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
  tooltip,
  sparkline,
  tendencia,
}: {
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  tono?: Tono;
  cargando?: boolean;
  icono?: ReactNode;
  tooltip?: string;
  sparkline?: number[];
  tendencia?: number | null;
}) {
  const [iconoEl, setIconoEl] = useState<HTMLSpanElement | null>(null);

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
        {icono && (
          <span ref={setIconoEl} className="text-muted/70">
            {icono}
          </span>
        )}
        {icono && tooltip && (
          <Tooltip target={iconoEl ?? undefined} content={tooltip} position="top" />
        )}
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
          {tendencia !== undefined && tendencia !== null && (
            <p
              className={cx(
                "mt-1 text-xs font-semibold tabular-nums",
                tendencia > 0 ? "text-red" : "text-green",
              )}
            >
              {tendencia > 0 ? "▲" : "▼"}{" "}
              {Math.abs(tendencia * 100).toFixed(1)}% vs. semana anterior
            </p>
          )}
          {detalle && (
            <div className="text-muted mt-1 text-xs leading-relaxed">
              {detalle}
            </div>
          )}
          {sparkline && sparkline.length > 1 && (
            <div className="mt-3 h-10 w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={sparkline.map((valor, indice) => ({ indice, valor }))}
                  margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
                >
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke={COLORES.cyan}
                    fill={COLORES.cyan}
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
