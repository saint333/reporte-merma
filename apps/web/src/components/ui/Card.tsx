import type { ReactNode } from "react";

import { cx } from "../../lib/cx";

type Props = {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({
  title,
  eyebrow,
  subtitle,
  action,
  children,
  className,
}: Props) {
  return (
    <section
      className={cx(
        "bg-surface border-border rounded-card shadow-card border p-4 lg:p-5",
        className,
      )}
    >
      {(title || eyebrow || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-muted text-[11px] font-medium tracking-[0.12em] uppercase">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-ink mt-1 text-sm font-semibold">{title}</h2>
            )}
            {subtitle && (
              <p className="text-muted mt-1 text-xs leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
