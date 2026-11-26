import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Skeleton } from "primereact/skeleton";
import { FilterBar } from "./FilterBar";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((indice) => (
          <Skeleton key={indice} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-80 w-full xl:col-span-8" />
        <Skeleton className="h-80 w-full xl:col-span-4" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export function Shell() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;

    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setMenuAbierto(false);
    }

    document.addEventListener("keydown", alPresionar);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  return (
    <div className="flex min-h-screen flex-col lg:pl-[264px]">
      <a
        href="#contenido"
        className="focus:bg-surface focus:text-ink focus:ring-cyan sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:outline-none"
      >
        Ir al contenido
      </a>

      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <Topbar
        onAbrirMenu={() => setMenuAbierto(true)}
        menuAbierto={menuAbierto}
      />

      <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 lg:px-6">
        <FilterBar />
      </div>

      <main
        id="contenido"
        className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 lg:px-6"
      >
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="text-muted border-border/70 mx-auto w-full max-w-[1600px] border-t px-4 py-4 text-[10px] lg:px-6">
        Datos de solo lectura · Mermas de materiales · API y base PostgreSQL
      </footer>
    </div>
  );
}
