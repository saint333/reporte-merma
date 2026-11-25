import type { ReactNode } from "react";

import { cx } from "../../lib/cx";
import { Card } from "../ui/Card";

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
    <Card
      title={titulo}
      subtitle={subtitulo}
      action={accion}
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
    </Card>
  );
}
