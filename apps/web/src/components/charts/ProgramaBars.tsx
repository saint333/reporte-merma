import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { compactMoney, money, percent } from "../../lib/formatters";
import { COLORES } from "../../lib/theme";
import type { FilaCorte } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { MermaTooltip } from "./ChartTooltip";
import {
  CURSOR_BARRAS,
  EJE_TICK_COMPACTO,
  GRILLA,
  MARGEN_VERTICAL,
} from "./estilos";

const PALETA = [COLORES.purple, COLORES.cyan, COLORES.orange, COLORES.green, COLORES.amber];

export function ProgramaBars({ filas }: { filas: FilaCorte[] }) {
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
          margin={{ ...MARGEN_VERTICAL, right: 24 }}
        >
          <CartesianGrid {...GRILLA} horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={compactMoney}
            tick={EJE_TICK_COMPACTO}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="clave"
            width={110}
            tick={EJE_TICK_COMPACTO}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip cursor={CURSOR_BARRAS} content={<MermaTooltip />} />
          <Bar
            dataKey="costo"
            radius={[0, 3, 3, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="participacion"
              position="right"
              fill={COLORES.muted}
              fontSize={10}
              formatter={(valor: unknown) => percent(Number(valor), 1)}
            />
            {datos.map((fila, indice) => (
              <Cell key={fila.clave} fill={PALETA[indice % PALETA.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <ChartTable
        titulo="Impacto de la merma por programa"
        columnas={[
          { clave: "clave", etiqueta: "Programa" },
          { clave: "costo", etiqueta: "Costo", formato: (v) => money(String(v)) },
          {
            clave: "participacion",
            etiqueta: "Participación",
            formato: (v) => percent(Number(v), 2),
          },
          { clave: "eventos", etiqueta: "Eventos" },
        ]}
        filas={filas}
      />
    </>
  );
}
