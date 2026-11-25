import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  titulo,
  descripcion,
  acciones,
}: {
  eyebrow: string;
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <p className="text-cyan text-[10px] font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-ink mt-1 text-xl font-semibold tracking-tight">
          {titulo}
        </h1>
        <p className="text-muted mt-1 max-w-3xl text-xs leading-relaxed">
          {descripcion}
        </p>
      </div>
      {acciones && (
        <div className="flex flex-wrap items-center gap-2">{acciones}</div>
      )}
    </div>
  );
}
