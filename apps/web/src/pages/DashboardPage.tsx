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
import { PageHeader } from "../components/layout/PageHeader";
import { GestionMatrix } from "../components/tables/GestionMatrix";
import { ParetoDrawer } from "../components/tables/ParetoDrawer";
import { ParetoTable } from "../components/tables/ParetoTable";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
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
      <PageHeader
        eyebrow="General"
        titulo="Panel gerencial"
        descripcion={`Corte ${dateLabel(filtros.desde)} — ${dateLabel(filtros.hasta)} · merma de materiales, control y proyección`}
        acciones={
          kpis.data ? (
            <Tag
              value={`${integer(kpis.data.eventos)} eventos en el corte`}
              severity="info"
              className="tag-app"
            />
          ) : undefined
        }
      />

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
              className="xl:col-span-4"
              header={
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-ink text-sm font-semibold">
                      Alertas de calidad
                    </h2>
                    <p className="text-muted mt-1 text-xs leading-relaxed">
                      Prioriza lo que requiere acción esta semana
                    </p>
                  </div>
                  <div className="shrink-0">
                    {alertas.data ? (
                      <Tag
                        value={`${alertas.data.length} activas`}
                        severity="warning"
                        className="tag-app"
                      />
                    ) : undefined}
                  </div>
                </div>
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
            header={
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-ink text-sm font-semibold">
                    Pareto de SKUs
                  </h2>
                  <p className="text-muted mt-1 text-xs leading-relaxed">
                    Selecciona una fila para ver sus eventos
                  </p>
                </div>
                <div className="shrink-0">
                  {pareto.data ? (
                    <div className="flex gap-1.5">
                      <Tag
                        value={`${pareto.data.resumen.skus} SKUs`}
                        severity="info"
                        className="tag-app"
                      />
                      <Tag
                        value={`${pareto.data.resumen.clase_a} A`}
                        severity="danger"
                        className="tag-app"
                      />
                    </div>
                  ) : undefined}
                </div>
              </div>
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
            subTitle="Qué se puede controlar y qué decisión tomar"
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
