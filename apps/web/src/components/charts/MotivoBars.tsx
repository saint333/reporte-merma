import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactMoney, money, percent } from "../../lib/formatters";
import { colorGestion, COLORES } from "../../lib/theme";
import type { FilaCorte } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { MermaTooltip } from "./ChartTooltip";

export function MotivoBars({ filas }: { filas: FilaCorte[] }) {
  const datos = filas.map((fila) => ({
    ...fila,
    costo: Number(fila.costo),
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#1E293B"
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            tickFormatter={compactMoney}
            tick={{ fill: COLORES.muted, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="clave"
            width={142}
            tick={{ fill: COLORES.muted, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,.06)" }}
            content={<MermaTooltip />}
          />
          <Bar
            dataKey="costo"
            radius={[0, 3, 3, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          >
            {datos.map((fila) => (
              <Cell
                key={fila.clave}
                fill={colorGestion(fila.gestion)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartTable
        titulo="Ranking de merma por motivo"
        columnas={[
          { clave: "clave", etiqueta: "Motivo" },
          { clave: "costo", etiqueta: "Costo", formato: (v) => money(String(v)) },
          { clave: "eventos", etiqueta: "Eventos" },
          {
            clave: "participacion",
            etiqueta: "Participación",
            formato: (v) => percent(Number(v), 2),
          },
          { clave: "gestion", etiqueta: "Gestión" },
        ]}
        filas={filas}
      />
    </>
  );
}
