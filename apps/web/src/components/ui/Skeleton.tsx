import { Skeleton as PrimeSkeleton } from "primereact/skeleton";

import { cx } from "../../lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <PrimeSkeleton
      className={cx("rounded-md!", className ?? "h-4 w-full")}
    />
  );
}
