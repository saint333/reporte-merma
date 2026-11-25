import { Decimal } from "decimal.js";

export const GESTIONES = new Set([
  "Controlable",
  "Estándar Técnico",
  "Por Auditar",
  "Recuperable Proveedor",
]);

export const UMBRAL_CANTIDAD = new Decimal("10000000");
export const CAMPANIA = { desde: "2026-01-01", hasta: "2026-12-31" } as const;

export type Material = {
  codigo: number;
  descripcion: string;
  um: string;
  valorUnitario: string;
  codSubgrupo: string | null;
  grupoMaterial: string;
  programa: string;
  unidadesPorPallet: number;
};

export type Motivo = {
  codigo: string;
  categoria: string;
  areaResponsable: string;
  gestionabilidad: string;
  accionCorrectiva: string | null;
};

export type Observacion = {
  codigo: string;
  mensaje: string;
};

export type Revision = {
  estado: "ok" | "observada" | "error";
  motivoCodigo: string | null;
  observaciones: Observacion[];
};

export function normalizar(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function resolverMotivo(
  motivoOriginal: string,
  catalogo: Set<string>,
  alias: Map<string, string>,
): { codigo: string; esAlias: boolean; huerfano: boolean } {
  const clave = normalizar(motivoOriginal);

  if (catalogo.has(clave)) {
    return { codigo: clave, esAlias: false, huerfano: false };
  }

  const destino = alias.get(clave);
  if (destino) {
    return { codigo: destino, esAlias: true, huerfano: false };
  }

  return { codigo: "SIN CLASIFICAR", esAlias: false, huerfano: true };
}

export function validarFila(entrada: {
  fecha: string;
  codigo: number;
  cantidad: Decimal;
  motivoOriginal: string;
  material: Material | undefined;
  catalogo: Set<string>;
  alias: Map<string, string>;
  esDuplicado: boolean;
}): Revision {
  const { fecha, codigo, cantidad, motivoOriginal, material, catalogo, alias, esDuplicado } =
    entrada;

  if (!Number.isInteger(codigo) || !material) {
    return {
      estado: "error",
      motivoCodigo: null,
      observaciones: [
        {
          codigo: "MATERIAL_NO_REGISTRADO",
          mensaje: `El código ${codigo} no existe en el maestro`,
        },
      ],
    };
  }

  if (!cantidad.isFinite() || cantidad.lte(0)) {
    return {
      estado: "error",
      motivoCodigo: null,
      observaciones: [
        {
          codigo: "CANTIDAD_INVALIDA",
          mensaje: `La cantidad ${cantidad.toString()} debe ser mayor que cero`,
        },
      ],
    };
  }

  const observaciones: Observacion[] = [];
  const motivo = resolverMotivo(motivoOriginal, catalogo, alias);

  if (fecha < CAMPANIA.desde || fecha > CAMPANIA.hasta) {
    observaciones.push({
      codigo: "FECHA_FUERA_DE_CAMPANIA",
      mensaje: `La fecha ${fecha} está fuera de la campaña ${CAMPANIA.desde}..${CAMPANIA.hasta}`,
    });
  }

  if (cantidad.gt(UMBRAL_CANTIDAD)) {
    observaciones.push({
      codigo: "CANTIDAD_ATIPICA",
      mensaje: `La cantidad ${cantidad.toString()} supera ${UMBRAL_CANTIDAD.toString()}`,
    });
  }

  if (motivo.esAlias) {
    observaciones.push({
      codigo: "MOTIVO_ALIAS",
      mensaje: `"${motivoOriginal}" se resuelve como ${motivo.codigo}`,
    });
  }

  if (motivo.huerfano) {
    observaciones.push({
      codigo: "MOTIVO_NO_CATALOGADO",
      mensaje: `"${motivoOriginal}" no existe en el catálogo ni en los alias; se guarda como SIN CLASIFICAR`,
    });
  }

  if (esDuplicado) {
    observaciones.push({
      codigo: "POSIBLE_DUPLICADO",
      mensaje: "Mismo fecha, código, cantidad y motivo que una fila anterior",
    });
  }

  if (material.unidadesPorPallet === 1) {
    observaciones.push({
      codigo: "PALLET_SINGULAR",
      mensaje: "El material tiene 1 unidad por pallet; el indicador de pallets es referencial",
    });
  }

  return {
    estado: observaciones.length > 0 ? "observada" : "ok",
    motivoCodigo: motivo.codigo,
    observaciones,
  };
}
