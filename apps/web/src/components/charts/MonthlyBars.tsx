import { useState } from "react";
import { SelectButton } from "primereact/selectbutton";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactMoney, integer, money, monthLabel } from "../../lib/formatters";
import { COLORES } from "../../lib/theme";
import type { SerieMensual } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { MermaTooltip } from "./ChartTooltip";
import { CURSOR_BARRAS, EJE_TICK, GRILLA } from "./estilos";

type Metrica = "costo" | "eventos";

const OPCIONES: { label: string; value: Metrica }[] = [
  { label: "Costo", value: "costo" },
  { label: "Eventos", value: "eventos" },
];

export function MonthlyBars({ filas }: { filas: SerieMensual[] }) {
  const [metrica, setMetrica] = useState<Metrica>("costo");

  const datos = filas.map((fila) => ({
    ...fila,
    costo: Number(fila.costo),
  }));

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="mb-2 flex justify-end">
          <SelectButton
            value={metrica}
            onChange={(evento) => {
              if (evento.value) setMetrica(evento.value as Metrica);
            }}
            options={OPCIONES}
            aria-label="Métrica del gráfico mensual"
            className="text-[11px]"
          />
        </div>

        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datos}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="monthlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORES.cyan} stopOpacity={0.95} />
                  <stop
                    offset="100%"
                    stopColor={COLORES.cyan}
                    stopOpacity={0.35}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRILLA} vertical={false} />
              <XAxis
                dataKey="mes"
                tickFormatter={(valor) => monthLabel(String(valor))}
                tick={EJE_TICK}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={
                  metrica === "costo"
                    ? compactMoney
                    : (valor) => integer(Number(valor))
                }
                tick={EJE_TICK}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                cursor={CURSOR_BARRAS}
                content={
                  <MermaTooltip
                    formatearEtiqueta={(valor) => monthLabel(String(valor))}
                  />
                }
              />
              <Bar
                dataKey={metrica}
                fill="url(#monthlyFill)"
                radius={[3, 3, 0, 0]}
                maxBarSize={44}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ChartTable
        titulo="Evolución mensual de la merma"
        columnas={[
          { clave: "mes", etiqueta: "Mes", formato: (v) => String(v) },
          { clave: "costo", etiqueta: "Costo", formato: (v) => money(String(v)) },
          { clave: "eventos", etiqueta: "Eventos" },
          {
            clave: "participacion",
            etiqueta: "Participación",
            formato: (v) => `${(Number(v) * 100).toFixed(2)}%`,
          },
        ]}
        filas={filas}
      />
    </>
  );
}
