import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

type Tono = "neutral" | "A" | "B" | "C" | "alta" | "media" | "baja" | "cyan";

const TONOS: Record<Tono, string> = {
  neutral: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25",
  A: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  B: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
  C: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25",
  alta: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  media: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
  baja: "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/25",
  cyan: "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/25",
};

export function Badge({
  children,
  tono = "neutral",
  className,
}: {
  children: ReactNode;
  tono?: Tono;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap",
        TONOS[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function tonoClase(clase: string): Tono {
  if (clase.startsWith("A")) return "A";
  if (clase.startsWith("B")) return "B";
  return "C";
}
