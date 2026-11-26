import { COLORES } from "../../lib/theme";

/** Estilo único de ejes: mismos colores, sin líneas ni marcas. */
export const EJE_TICK = { fill: COLORES.muted, fontSize: 11 } as const;
export const EJE_TICK_COMPACTO = { fill: COLORES.muted, fontSize: 10 } as const;

/** Grilla horizontal suave, igual en todos los gráficos cartesianos. */
export const GRILLA = {
  stroke: "#1E293B",
  strokeDasharray: "3 3",
} as const;

export const CURSOR_BARRAS = { fill: "rgba(148,163,184,.06)" } as const;
export const CURSOR_LINEA = { stroke: "rgba(148,163,184,.25)" } as const;

export const MARGEN_VERTICAL = {
  top: 4,
  right: 16,
  left: 0,
  bottom: 0,
} as const;
