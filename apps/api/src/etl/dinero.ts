import { Decimal } from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Excel calcula ROUND(cantidad * valor, 4) con ~15 dígitos significativos,
 * no con el producto binario exacto. Normalizar a 15 dígitos reproduce la
 * columna P del libro (y sus totales al cuarto decimal).
 */
export function costoTotal(
  cantidad: Decimal | string,
  valorUnitario: Decimal | string,
): string {
  return new Decimal(cantidad)
    .times(valorUnitario)
    .toSignificantDigits(15)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed(4);
}
