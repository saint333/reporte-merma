import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  compactMoney,
  integer,
  money,
  percent,
} from "../../lib/formatters";
import { COLORES, colorClase } from "../../lib/theme";
import type { FilaPareto } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { MermaTooltip } from "./ChartTooltip";
import { CURSOR_BARRAS, EJE_TICK_COMPACTO, GRILLA } from "./estilos";

/** Corte de la clase A; debe coincidir con `clase_abc` que calcula la API. */
const CORTE_A = 0.8;

export function ParetoCurva({ filas }: { filas: FilaPareto[] }) {
  const datos = filas.map((fila) => ({
    rank: fila.rank,
    codigo: fila.codigo,
    clase_abc: fila.clase_abc,
    costo: Number(fila.costo),
    eventos: fila.eventos,
    participacion: fila.participacion,
    acumulado: Number(fila.acumulado),
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={datos}
          margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid {...GRILLA} vertical={false} />
          <XAxis
            dataKey="rank"
            tick={EJE_TICK_COMPACTO}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            yAxisId="costo"
            tickFormatter={compactMoney}
            tick={EJE_TICK_COMPACTO}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <YAxis
            yAxisId="acumulado"
            orientation="right"
            domain={[0, 1]}
            tickFormatter={(valor) => percent(Number(valor), 0)}
            tick={EJE_TICK_COMPACTO}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={CURSOR_BARRAS}
            content={
              <MermaTooltip
                formatearEtiqueta={(valor) => `#${valor}`}
              />
            }
          />
          <ReferenceLine
            yAxisId="acumulado"
            y={CORTE_A}
            stroke={COLORES.red}
            strokeDasharray="4 4"
            label={{
              value: "80 %",
              position: "insideTopRight",
              fill: COLORES.red,
              fontSize: 10,
            }}
          />
          <Bar
            yAxisId="costo"
            dataKey="costo"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          >
            {datos.map((fila) => (
              <Cell key={fila.codigo} fill={colorClase(fila.clase_abc)} />
            ))}
          </Bar>
          <Line
            yAxisId="acumulado"
            type="monotone"
            dataKey="acumulado"
            stroke={COLORES.cyan}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: COLORES.cyan, stroke: COLORES.page }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ChartTable
        titulo="Curva ABC de la merma por SKU"
        columnas={[
          { clave: "rank", etiqueta: "Posición" },
          { clave: "codigo", etiqueta: "Código" },
          { clave: "costo", etiqueta: "Costo", formato: (v) => money(String(v)) },
          { clave: "eventos", etiqueta: "Eventos", formato: (v) => integer(Number(v)) },
          {
            clave: "acumulado",
            etiqueta: "Acumulado",
            formato: (v) => percent(Number(v), 2),
          },
          { clave: "clase_abc", etiqueta: "Clase" },
        ]}
        filas={datos}
      />
    </>
  );
}
