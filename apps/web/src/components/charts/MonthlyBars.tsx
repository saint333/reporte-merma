import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactMoney, money, monthLabel } from "../../lib/formatters";
import { COLORES } from "../../lib/theme";
import type { SerieMensual } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { MermaTooltip } from "./ChartTooltip";

export function MonthlyBars({ filas }: { filas: SerieMensual[] }) {
  const datos = filas.map((fila) => ({
    ...fila,
    costo: Number(fila.costo),
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            stroke="#1E293B"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="mes"
            tickFormatter={(valor) => monthLabel(String(valor))}
            tick={{ fill: COLORES.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={compactMoney}
            tick={{ fill: COLORES.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,.06)" }}
            content={
              <MermaTooltip
                formatearEtiqueta={(valor) => monthLabel(String(valor))}
              />
            }
          />
          <Bar
            dataKey="costo"
            fill={COLORES.cyan}
            radius={[3, 3, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
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
