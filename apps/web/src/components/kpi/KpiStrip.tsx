import {
  decimal,
  integer,
  money,
  percent,
} from "../../lib/formatters";
import type { Kpis, Proyeccion } from "../../lib/types";
import { ErrorState } from "../feedback/ErrorState";
import { KpiCard } from "./KpiCard";

export function KpiStrip({
  kpis,
  proyeccion,
  cargando,
  error,
  onRetry,
}: {
  kpis?: Kpis;
  proyeccion?: Proyeccion;
  cargando: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (error) {
    return <ErrorState error={error} onRetry={onRetry} compact />;
  }

  const cierre = proyeccion?.escenarios.find(
    (escenario) => escenario.id === "meta",
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        etiqueta="Merma total"
        valor={kpis ? money(kpis.merma_total) : "—"}
        detalle={
          kpis ? (
            <>
              {integer(kpis.eventos)} eventos · {money(kpis.ticket_promedio)}{" "}
              ticket
            </>
          ) : undefined
        }
        tono="cyan"
        cargando={cargando}
        icono={<i className="pi pi-dollar text-lg" />}
        tooltip="Costo total de merma en el rango seleccionado"
      />
      <KpiCard
        etiqueta="Controlable"
        valor={kpis ? money(kpis.merma_controlable) : "—"}
        detalle={
          kpis ? `${percent(kpis.controlable_pct, 1)} del total` : undefined
        }
        tono="orange"
        cargando={cargando}
        icono={<i className="pi pi-shield text-lg" />}
        tooltip="Merma que el área puede controlar directamente"
      />
      <KpiCard
        etiqueta="Volumen"
        valor={kpis ? `${decimal(kpis.pallets_equiv, 2)} pallets` : "—"}
        detalle={
          kpis
            ? `${integer(kpis.skus_con_merma)} de ${integer(
                kpis.skus_total,
              )} SKUs con merma`
            : undefined
        }
        tono="purple"
        cargando={cargando}
        icono={<i className="pi pi-box text-lg" />}
        tooltip="Equivalente en pallets de la merma del rango"
      />
      <KpiCard
        etiqueta="Cierre meta"
        valor={cierre ? money(cierre.cierre) : "—"}
        detalle={
          cierre ? (
            <>
              Ahorro {money(cierre.ahorro)} vs tendencial
            </>
          ) : (
            "Proyección global"
          )
        }
        tono="green"
        cargando={cargando && !proyeccion}
        icono={<i className="pi pi-flag text-lg" />}
        tooltip="Costo proyectado si se cumple la meta de reducción"
      />
    </div>
  );
}
