import type { ReactNode } from "react";
import { Card } from "primereact/card";

import { cx } from "../../lib/cx";

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
      className={className}
      header={
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-ink text-sm font-semibold">{titulo}</h2>
            {subtitulo && (
              <p className="text-muted mt-1 text-xs leading-relaxed">
                {subtitulo}
              </p>
            )}
          </div>
          {accion && <div className="shrink-0">{accion}</div>}
        </div>
      }
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
