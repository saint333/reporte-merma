import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { FamiliaDonut } from "../components/charts/FamiliaDonut";
import { ChartCard } from "../components/charts/ChartCard";
import { MonthlyBars } from "../components/charts/MonthlyBars";
import { MotivoBars } from "../components/charts/MotivoBars";
import { ProgramaBars } from "../components/charts/ProgramaBars";
import { WeeklyLine } from "../components/charts/WeeklyLine";
import { AlertList } from "../components/feedback/AlertList";
import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { KpiStrip } from "../components/kpi/KpiStrip";
import { GestionMatrix } from "../components/tables/GestionMatrix";
import { ParetoDrawer } from "../components/tables/ParetoDrawer";
import { ParetoTable } from "../components/tables/ParetoTable";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { dateLabel, integer, percent } from "../lib/formatters";
import { useFiltros } from "../lib/filters";
import {
  alertasQuery,
  corteQuery,
  kpisQuery,
  paretoQuery,
  proyeccionQuery,
  serieMensualQuery,
  serieSemanalQuery,
} from "../lib/queries";
import type { FilaPareto } from "../lib/types";

export default function DashboardPage() {
  const { filtros, limpiar } = useFiltros();
  const [sku, setSku] = useState<FilaPareto | null>(null);

  const kpis = useQuery(kpisQuery(filtros));
  const proyeccion = useQuery(proyeccionQuery(filtros));
  const mensual = useQuery(serieMensualQuery(filtros));
  const semanal = useQuery(serieSemanalQuery(filtros));
  const motivos = useQuery(corteQuery("motivos", filtros));
  const familias = useQuery(corteQuery("familias", filtros));
  const programas = useQuery(corteQuery("programas", filtros));
  const gestion = useQuery(corteQuery("gestion", filtros));
  const pareto = useQuery(paretoQuery(filtros));
  const alertas = useQuery(alertasQuery(filtros));

  const vacio = kpis.data?.eventos === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-ink text-lg font-semibold tracking-tight">
            Panel gerencial
          </h1>
          <p className="text-muted mt-0.5 text-xs">
            {dateLabel(filtros.desde)} — {dateLabel(filtros.hasta)} · merma de
            materiales
          </p>
        </div>
        {kpis.data && (
          <Badge tono="cyan">
            {integer(kpis.data.eventos)} eventos en el corte
          </Badge>
        )}
      </div>

      {kpis.isPending && kpis.failureCount > 0 && <ColdStartNotice />}

      <KpiStrip
        kpis={kpis.data}
        proyeccion={proyeccion.data}
        cargando={kpis.isPending}
        error={kpis.error}
        onRetry={() => void kpis.refetch()}
      />

      {vacio ? (
        <EmptyState
          mensaje="No hay registros para estos filtros."
          onClear={limpiar}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <ChartCard
              titulo="Evolución mensual"
              subtitulo="Costo de merma por mes del rango seleccionado"
              className="xl:col-span-8"
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

            <Card
              title="Alertas de calidad"
              subtitle="Prioriza lo que requiere acción esta semana"
              className="xl:col-span-4"
              action={
                alertas.data ? (
                  <Badge tono="media">{alertas.data.length} activas</Badge>
                ) : undefined
              }
            >
              <AlertList
                alertas={alertas.data}
                filtros={filtros}
                cargando={alertas.isPending}
                error={alertas.error}
                failureCount={alertas.failureCount}
                onRetry={() => void alertas.refetch()}
              />
            </Card>
          </div>

          <ChartCard
            titulo="Tendencia semanal"
            subtitulo={
              semanal.data
                ? `Promedio ajustado ${semanal.data.resumen.promedio_ajustado} · umbral ${semanal.data.resumen.umbral}`
                : "Costo por semana ISO, promedio ajustado y semanas atípicas"
            }
            altura={300}
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

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard
              titulo="Merma por motivo"
              subtitulo="Top motivos, color según gestionabilidad"
              altura={360}
            >
              {motivos.isPending ? (
                <Skeleton className="h-full w-full" />
              ) : motivos.error ? (
                <ErrorState
                  error={motivos.error}
                  onRetry={() => void motivos.refetch()}
                  compact
                />
              ) : (
                <MotivoBars filas={motivos.data?.data ?? []} />
              )}
            </ChartCard>

            <ChartCard
              titulo="Concentración por familia"
              subtitulo="Participación del costo total del corte"
              altura={360}
            >
              {familias.isPending ? (
                <Skeleton className="h-full w-full" />
              ) : familias.error ? (
                <ErrorState
                  error={familias.error}
                  onRetry={() => void familias.refetch()}
                  compact
                />
              ) : (
                <FamiliaDonut
                  filas={familias.data?.data ?? []}
                  total={familias.data?.total.costo ?? "0"}
                />
              )}
            </ChartCard>

            <ChartCard
              titulo="Impacto por programa"
              subtitulo="Costo y peso relativo de cada programa"
              altura={360}
            >
              {programas.isPending ? (
                <Skeleton className="h-full w-full" />
              ) : programas.error ? (
                <ErrorState
                  error={programas.error}
                  onRetry={() => void programas.refetch()}
                  compact
                />
              ) : (
                <ProgramaBars filas={programas.data?.data ?? []} />
              )}
            </ChartCard>
          </div>

          <Card
            title="Pareto de SKUs"
            subtitle="Selecciona una fila para ver sus eventos"
            action={
              pareto.data ? (
                <div className="flex gap-1.5">
                  <Badge tono="cyan">{pareto.data.resumen.skus} SKUs</Badge>
                  <Badge tono="A">{pareto.data.resumen.clase_a} A</Badge>
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
            ) : !pareto.data?.data.length ? (
              <EmptyState mensaje="No hay SKUs con merma en este rango." />
            ) : (
              <>
                <div className="text-muted mb-3 text-[11px]">
                  Top 15 acumula{" "}
                  <span className="text-ink font-semibold">
                    {pareto.data.resumen.participacion_top
                      ? percent(
                          Number(pareto.data.resumen.participacion_top),
                          2,
                        )
                      : "—"}
                  </span>{" "}
                  del costo · {pareto.data.resumen.costo_top} en valor
                </div>
                <ParetoTable
                  filas={pareto.data.data}
                  onSeleccionar={setSku}
                />
              </>
            )}
          </Card>

          <Card
            title="Matriz de gestionabilidad"
            subtitle="Qué se puede controlar y qué decisión tomar"
          >
            {gestion.isPending ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((indice) => (
                  <Skeleton key={indice} className="h-10 w-full" />
                ))}
              </div>
            ) : gestion.error ? (
              <ErrorState
                error={gestion.error}
                onRetry={() => void gestion.refetch()}
                compact
              />
            ) : (
              <GestionMatrix filas={gestion.data?.data ?? []} />
            )}
          </Card>
        </>
      )}

      <ParetoDrawer fila={sku} filtros={filtros} onClose={() => setSku(null)} />
    </div>
  );
}
