import type { ReactNode } from "react";
import { Tag } from "primereact/tag";

import { cx } from "../../lib/cx";

type Tono = "neutral" | "A" | "B" | "C" | "alta" | "media" | "baja" | "cyan";

const SEVERIDAD: Record<
  Tono,
  "success" | "info" | "warning" | "danger" | undefined
> = {
  neutral: undefined,
  A: "danger",
  B: "warning",
  C: undefined,
  alta: "danger",
  media: "warning",
  baja: undefined,
  cyan: "info",
};

const NEUTRAL =
  "bg-slate-500/15! text-slate-300! ring-1! ring-slate-500/25!";

export function Badge({
  children,
  tono = "neutral",
  className,
}: {
  children: ReactNode;
  tono?: Tono;
  className?: string;
}) {
  const esNeutro = tono === "neutral" || tono === "C" || tono === "baja";

  return (
    <Tag
      value={children}
      severity={SEVERIDAD[tono]}
      className={cx(
        "rounded-full! px-2! py-0.5! text-[10px]! font-semibold!",
        esNeutro ? NEUTRAL : undefined,
        className,
      )}
    />
  );
}

export function tonoClase(clase: string): Tono {
  if (clase.startsWith("A")) return "A";
  if (clase.startsWith("B")) return "B";
  return "C";
}
