import { FiltroInvalido } from "./errores.js";

export function leerEnteroPositivo(valor: string, etiqueta: string): number {
  const numero = Number(valor);

  if (!Number.isInteger(numero) || numero <= 0) {
    throw new FiltroInvalido(`${etiqueta} debe ser un entero positivo.`);
  }

  return numero;
}
