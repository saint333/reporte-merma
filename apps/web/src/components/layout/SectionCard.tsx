import type { ReactNode } from "react";
import { Card } from "primereact/card";

import { cx } from "../../lib/cx";

export function SectionCard({
  titulo,
  subtitulo,
  accion,
  children,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cx(className)}
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
      {children}
    </Card>
  );
}
