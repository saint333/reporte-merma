import type { ReactNode } from "react";

export type IconoNombre =
  | "panel"
  | "registros"
  | "analisis"
  | "cargas"
  | "menu"
  | "cerrar"
  | "descargar"
  | "buscar";

const TRAZOS: Record<IconoNombre, ReactNode> = {
  panel: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
    </>
  ),
  registros: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M3 14.75h18M9.5 9.5V20" />
    </>
  ),
  analisis: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7.5 14.5l3.5-4 3 2.8 4.2-5.4" />
    </>
  ),
  cargas: (
    <>
      <path d="M12 15.5V4m0 0L7.8 8.2M12 4l4.2 4.2" />
      <path d="M4.5 15.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  descargar: (
    <>
      <path d="M12 4v11m0 0 4.2-4.2M12 15l-4.2-4.2" />
      <path d="M4.5 17.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" />
    </>
  ),
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  buscar: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
};

export function Icono({
  nombre,
  className,
}: {
  nombre: IconoNombre;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
