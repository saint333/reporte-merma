import {
  Area,
  AreaChart,
  CartesianGrid,
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
import { CURSOR_LINEA, EJE_TICK, GRILLA } from "./estilos";

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
        <AreaChart
          data={datos}
          margin={{ top: 22, right: 16, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORES.cyan} stopOpacity={0.28} />
              <stop offset="100%" stopColor={COLORES.cyan} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRILLA} vertical={false} />
          <XAxis
            dataKey="semana_iso"
            tickFormatter={(valor) => weekLabel(Number(valor))}
            tick={EJE_TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tickFormatter={compactMoney}
            tick={EJE_TICK}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            cursor={CURSOR_LINEA}
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
          <Area
            type="monotone"
            dataKey="costo"
            stroke={COLORES.cyan}
            strokeWidth={2}
            fill="url(#weeklyFill)"
            dot={renderPunto}
            activeDot={{ r: 5, fill: COLORES.cyan, stroke: COLORES.page }}
            isAnimationActive={false}
          />
        </AreaChart>
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
