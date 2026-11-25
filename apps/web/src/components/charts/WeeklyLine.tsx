import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  compactMoney,
  money,
  weekLabel,
} from "../../lib/formatters";
import { COLORES } from "../../lib/theme";
import type { ResumenSemanal, SerieSemanal } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { MermaTooltip } from "./ChartTooltip";

type Punto = {
  cx?: number;
  cy?: number;
  payload?: SerieSemanal;
};

export function WeeklyLine({
  filas,
  resumen,
}: {
  filas: SerieSemanal[];
  resumen: ResumenSemanal;
}) {
  const datos = filas.map((fila) => ({
    ...fila,
    costo: Number(fila.costo),
  }));

  const pico = datos.reduce<typeof datos[number] | null>(
    (mayor, fila) => (!mayor || fila.costo > mayor.costo ? fila : mayor),
    null,
  );

  const renderPunto = (props: Punto) => (
    <circle
      cx={props.cx}
      cy={props.cy}
      r={3}
      fill={props.payload?.es_atipica ? COLORES.orange : COLORES.cyan}
      stroke={COLORES.page}
      strokeWidth={1}
    />
  );

  return (
    <>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={datos}
          margin={{ top: 22, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="#1E293B"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="semana_iso"
            tickFormatter={(valor) => weekLabel(Number(valor))}
            tick={{ fill: COLORES.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={compactMoney}
            tick={{ fill: COLORES.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "rgba(148,163,184,.25)" }}
            content={
              <MermaTooltip
                formatearEtiqueta={(valor) => weekLabel(Number(valor))}
              />
            }
          />
          <ReferenceLine
            y={Number(resumen.promedio_ajustado)}
            stroke={COLORES.muted}
            strokeDasharray="4 4"
            label={{
              value: "Prom. ajustado",
              position: "insideBottomRight",
              fill: COLORES.muted,
              fontSize: 10,
            }}
          />
          {pico && (
            <ReferenceDot
              x={pico.semana_iso}
              y={pico.costo}
              r={4}
              fill={COLORES.red}
              stroke={COLORES.page}
              strokeWidth={1}
              label={{
                value: `Pico S${pico.semana_iso}`,
                position: "top",
                fill: COLORES.red,
                fontSize: 10,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="costo"
            stroke={COLORES.cyan}
            strokeWidth={2}
            dot={renderPunto}
            activeDot={{ r: 5, fill: COLORES.cyan, stroke: COLORES.page }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <ChartTable
        titulo="Tendencia semanal de la merma"
        columnas={[
          {
            clave: "semana_iso",
            etiqueta: "Semana",
            formato: (v) => weekLabel(Number(v)),
          },
          { clave: "inicio", etiqueta: "Inicio" },
          { clave: "costo", etiqueta: "Costo", formato: (v) => money(String(v)) },
          { clave: "eventos", etiqueta: "Eventos" },
          {
            clave: "es_atipica",
            etiqueta: "Atípica",
            formato: (v) => (v ? "Sí" : "No"),
          },
        ]}
        filas={filas}
      />
    </>
  );
}
