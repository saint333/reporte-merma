export const COLORES = {
  page: "#0D1526",
  cyan: "#22D3EE",
  orange: "#FB923C",
  purple: "#A78BFA",
  green: "#34D399",
  amber: "#FBBF24",
  red: "#F43F5E",
  muted: "#94A3B8",
  emerald: "#6EE7B7",
} as const;

export const GESTION_COLOR: Record<string, string> = {
  Controlable: COLORES.orange,
  "Estándar Técnico": COLORES.cyan,
  "Por Auditar": COLORES.amber,
  "Recuperable Proveedor": COLORES.emerald,
};

export const FAMILIA_COLORES = [
  COLORES.cyan,
  COLORES.purple,
  COLORES.orange,
  COLORES.green,
  COLORES.amber,
  COLORES.emerald,
  COLORES.red,
  "#818CF8",
];

export function colorGestion(gestion: string | null | undefined): string {
  return (gestion && GESTION_COLOR[gestion]) || COLORES.muted;
}

export function colorClase(clase: string): string {
  if (clase.startsWith("A")) return COLORES.red;
  if (clase.startsWith("B")) return COLORES.amber;
  return COLORES.muted;
}
