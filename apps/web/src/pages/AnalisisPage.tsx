import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ChartCard } from "../components/charts/ChartCard";
import { MonthlyBars } from "../components/charts/MonthlyBars";
import { WeeklyLine } from "../components/charts/WeeklyLine";
import { ErrorState } from "../components/feedback/ErrorState";
import { ParetoDrawer } from "../components/tables/ParetoDrawer";
import { ParetoTable } from "../components/tables/ParetoTable";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { money, percent } from "../lib/formatters";
import { useFiltros } from "../lib/filters";
import {
  paretoQuery,
  proyeccionQuery,
  serieMensualQuery,
  serieSemanalQuery,
} from "../lib/queries";
import { cx } from "../lib/cx";
import type { FilaPareto } from "../lib/types";

export default function AnalisisPage() {
  const { filtros } = useFiltros();
  const [sku, setSku] = useState<FilaPareto | null>(null);

  const proyeccion = useQuery(proyeccionQuery(filtros));
  const pareto = useQuery(paretoQuery(filtros, 108));
  const mensual = useQuery(serieMensualQuery(filtros));
  const semanal = useQuery(serieSemanalQuery(filtros));

  const parametros = proyeccion.data?.parametros;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-ink text-lg font-semibold tracking-tight">
          Análisis y proyección
        </h1>
        <p className="text-muted mt-0.5 text-xs">
          Escenarios de cierre, tendencia y concentración de la merma
        </p>
      </div>

      <Card
        title="Proyección de cierre"
        subtitle="Tres escenarios sobre las semanas restantes de la campaña"
      >
        {proyeccion.isPending ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((indice) => (
              <Skeleton key={indice} className="h-32 w-full" />
            ))}
          </div>
        ) : proyeccion.error ? (
          <ErrorState
            error={proyeccion.error}
            onRetry={() => void proyeccion.refetch()}
            compact
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {proyeccion.data?.escenarios.map((escenario) => (
                <div
                  key={escenario.id}
                  className={cx(
                    "border-border rounded-md border p-4",
                    escenario.id === "meta"
                      ? "bg-green/5 border-green/30"
                      : "bg-header/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted text-[10px] font-medium tracking-[0.1em] uppercase">
                      {escenario.nombre}
                    </p>
                    {escenario.id === "meta" && (
                      <Badge tono="cyan">objetivo</Badge>
                    )}
                  </div>
                  <p
                    className={cx(
                      "mt-2 text-2xl font-semibold tabular-nums",
                      escenario.id === "meta" ? "text-green" : "text-ink",
                    )}
                  >
                    {money(escenario.cierre)}
                  </p>
                  <dl className="text-muted mt-3 space-y-1 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt>Tasa semanal</dt>
                      <dd className="text-ink tabular-nums">
                        {money(escenario.tasa)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Próximas 6 semanas</dt>
                      <dd className="text-ink tabular-nums">
                        {money(escenario.proyeccion_6s)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Ahorro vs tendencial</dt>
                      <dd className="text-ink tabular-nums">
                        {money(escenario.ahorro)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>

            {parametros && (
              <p className="text-muted border-border mt-4 border-t pt-3 text-[11px] leading-relaxed">
                Acumulado {money(parametros.acumulado)} en{" "}
                {parametros.semanas_observadas} semanas · promedio ajustado{" "}
                {money(parametros.promedio_ajustado)} ·{" "}
                {parametros.semanas_restantes} semanas restantes ·{" "}
                {percent(Number(parametros.proporcion_controlable), 1)} del
                costo es controlable · meta de reducción{" "}
                {percent(parametros.meta_reduccion, 0)}
                {parametros.semanas_excluidas.length > 0
                  ? ` · semanas atípicas excluidas: ${parametros.semanas_excluidas
                      .map((semana) => `S${semana}`)
                      .join(", ")}`
                  : ""}
                .
              </p>
            )}
          </>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          titulo="Evolución mensual"
          subtitulo="Costo y participación por mes"
        >
          {mensual.isPending ? (
            <Skeleton className="h-full w-full" />
          ) : mensual.error ? (
            <ErrorState
              error={mensual.error}
              onRetry={() => void mensual.refetch()}
              compact
            />
          ) : (
            <MonthlyBars filas={mensual.data?.data ?? []} />
          )}
        </ChartCard>

        <ChartCard
          titulo="Tendencia semanal"
          subtitulo="Promedio ajustado y semanas atípicas"
        >
          {semanal.isPending ? (
            <Skeleton className="h-full w-full" />
          ) : semanal.error ? (
            <ErrorState
              error={semanal.error}
              onRetry={() => void semanal.refetch()}
              compact
            />
          ) : (
            <WeeklyLine
              filas={semanal.data?.data ?? []}
              resumen={
                semanal.data?.resumen ?? {
                  semanas: 0,
                  promedio: "0",
                  promedio_ajustado: "0",
                  umbral: "0",
                }
              }
            />
          )}
        </ChartCard>
      </div>

      <Card
        title="Pareto completo"
        subtitle="Todas las SKUs con merma en el rango; haz clic para ver eventos"
        action={
          pareto.data ? (
            <div className="flex gap-1.5">
              <Badge tono="A">{pareto.data.resumen.clase_a} A</Badge>
              <Badge tono="B">{pareto.data.resumen.clase_b} B</Badge>
              <Badge tono="C">{pareto.data.resumen.clase_c} C</Badge>
            </div>
          ) : undefined
        }
      >
        {pareto.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((indice) => (
              <Skeleton key={indice} className="h-9 w-full" />
            ))}
          </div>
        ) : pareto.error ? (
          <ErrorState
            error={pareto.error}
            onRetry={() => void pareto.refetch()}
            compact
          />
        ) : (
          <ParetoTable filas={pareto.data?.data ?? []} onSeleccionar={setSku} />
        )}
      </Card>

      <ParetoDrawer fila={sku} filtros={filtros} onClose={() => setSku(null)} />
    </div>
  );
}
