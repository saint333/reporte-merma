import type { ReactNode } from "react";

import { cx } from "../../lib/cx";
import { SectionCard } from "../layout/SectionCard";

export function ChartCard({
  titulo,
  subtitulo,
  accion,
  children,
  altura = 280,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  altura?: number;
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
        <div className={cx("w-full")} style={{ height: altura }}>
          {children}
        </div>
      </figure>
    </SectionCard>
  );
}
