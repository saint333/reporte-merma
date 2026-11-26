import type { ReactNode } from "react";

import { cx } from "../../lib/cx";
import { SectionCard } from "../layout/SectionCard";

/**
 * Alturas por breakpoint en clases estáticas: Tailwind no puede generar
 * utilidades a partir de valores calculados en tiempo de ejecución.
 */
const ALTURAS = {
  normal: "h-[220px] md:h-[300px]",
  alta: "h-[260px] md:h-[360px]",
} as const;

export type AlturaGrafico = keyof typeof ALTURAS;

export function ChartCard({
  titulo,
  subtitulo,
  accion,
  children,
  altura = "normal",
  className,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  altura?: AlturaGrafico;
  className?: string;
}) {
  return (
    <SectionCard
      titulo={titulo}
      subtitulo={subtitulo}
      accion={accion}
      className={className}
    >
      <figure>
        <figcaption className="sr-only">
          {titulo}
          {subtitulo ? `. ${subtitulo}` : ""}
        </figcaption>
        <div className={cx("w-full", ALTURAS[altura])}>{children}</div>
      </figure>
    </SectionCard>
  );
}
