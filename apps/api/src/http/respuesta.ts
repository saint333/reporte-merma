import { isoLima } from "./fechas.js";

export function envelope<T>(data: T, meta: Record<string, unknown> = {}) {
  return {
    data,
    meta: {
      generado_en: isoLima(),
      moneda: "USD",
      ...meta,
    },
  };
}
