import { cx } from "../../lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "animate-pulse rounded-md bg-white/[0.06]",
        className ?? "h-4 w-full",
      )}
    />
  );
}
