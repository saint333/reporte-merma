import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";

import { normalizar } from "./reglas.js";

export function hashArchivo(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hashFila(
  fecha: string,
  codigo: number,
  cantidad: string,
  motivoOriginal: string,
): string {
  const crudo = [
    fecha,
    codigo,
    new Decimal(cantidad).toFixed(4),
    normalizar(motivoOriginal),
  ].join("|");

  return createHash("sha256").update(crudo, "utf8").digest("hex");
}
