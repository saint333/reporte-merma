import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import { Skeleton } from "../ui/Skeleton";
import { FilterBar } from "./FilterBar";
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
  return (
    <div className="min-h-screen">
      <a
        href="#contenido"
        className="focus:bg-surface focus:text-ink focus:ring-cyan sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:outline-none"
      >
        Ir al contenido
      </a>

      <Topbar />

      <div className="mx-auto max-w-[1600px] px-4 pt-4 lg:px-6">
        <FilterBar />
      </div>

      <main
        id="contenido"
        className="mx-auto max-w-[1600px] px-4 py-4 lg:px-6"
      >
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="text-muted border-border/70 mx-auto max-w-[1600px] border-t px-4 py-4 text-[10px] lg:px-6">
        Datos de solo lectura · Mermas de materiales · API y base PostgreSQL
      </footer>
    </div>
  );
}
