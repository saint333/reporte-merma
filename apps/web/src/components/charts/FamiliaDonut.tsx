import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { money, percent } from "../../lib/formatters";
import { FAMILIA_COLORES } from "../../lib/theme";
import type { FilaCorte } from "../../lib/types";
import { ChartTable } from "./ChartTable";
import { PieTooltip } from "./ChartTooltip";

export function FamiliaDonut({
  filas,
  total,
}: {
  filas: FilaCorte[];
  total: string;
}) {
  const datos = filas.map((fila) => ({
    ...fila,
    name: fila.clave,
    value: Number(fila.costo),
  }));

  return (
    <>
      <div className="flex h-full flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-56 w-full sm:h-full sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={datos}
                dataKey="value"
                nameKey="name"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {datos.map((fila, indice) => (
                  <Cell
                    key={fila.clave}
                    fill={FAMILIA_COLORES[indice % FAMILIA_COLORES.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-muted text-[10px] tracking-[0.12em] uppercase">
              Total
            </span>
            <span className="text-ink text-sm font-semibold tabular-nums">
              {money(total)}
            </span>
          </div>
        </div>
        <ul className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5 sm:w-1/2 sm:grid-cols-1">
          {filas.map((fila, indice) => (
            <li
              key={fila.clave}
              className="flex items-center justify-between gap-2 text-[11px]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      FAMILIA_COLORES[indice % FAMILIA_COLORES.length],
                  }}
                />
                <span className="text-muted truncate">{fila.clave}</span>
              </span>
              <span className="text-ink shrink-0 tabular-nums">
                {percent(Number(fila.participacion), 1)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ChartTable
        titulo="Concentración de la merma por familia"
        columnas={[
          { clave: "clave", etiqueta: "Familia" },
          { clave: "costo", etiqueta: "Costo", formato: (v) => money(String(v)) },
          {
            clave: "participacion",
            etiqueta: "Participación",
            formato: (v) => percent(Number(v), 2),
          },
        ]}
        filas={filas}
      />
    </>
  );
}
