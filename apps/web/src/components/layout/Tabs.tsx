import { NavLink } from "react-router-dom";

import { cx } from "../../lib/cx";

const TABS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/registros", label: "Registros" },
  { to: "/analisis", label: "Análisis" },
  { to: "/cargas", label: "Cargas" },
];

export function Tabs() {
  return (
    <nav aria-label="Secciones" className="flex gap-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            cx(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-header focus-visible:outline-none",
              isActive
                ? "bg-cyan/10 text-cyan ring-1 ring-cyan/25"
                : "text-muted hover:text-ink hover:bg-white/5",
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
