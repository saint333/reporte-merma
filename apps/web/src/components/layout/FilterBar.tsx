import { useIsFetching, useQuery } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";

import { integer } from "../../lib/formatters";
import { useFiltros } from "../../lib/filters";
import { kpisQuery, metaQuery } from "../../lib/queries";

function Selector({
  etiqueta,
  valor,
  opciones,
  onChange,
  deshabilitado,
}: {
  etiqueta: string;
  valor: string;
  opciones: string[];
  onChange: (valor: string) => void;
  deshabilitado?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase">
        {etiqueta}
      </span>
      <Dropdown
        value={valor}
        options={opciones}
        onChange={(evento) => onChange(evento.value ?? "")}
        disabled={deshabilitado}
        placeholder="Todos"
        showClear
        aria-label={etiqueta}
        className="w-full"
      />
    </label>
  );
}

export function FilterBar() {
  const { filtros, setFiltro, limpiar, hayFiltros } = useFiltros();
  const meta = useQuery(metaQuery);
  const kpis = useQuery(kpisQuery(filtros));
  const actualizando = useIsFetching() > 0;

  return (
    <div className="border-border bg-surface/70 rounded-card shadow-card border p-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Selector
          etiqueta="Mes"
          valor={filtros.mes ?? ""}
          opciones={meta.data?.meses ?? []}
          onChange={(valor) => setFiltro("mes", valor)}
          deshabilitado={meta.isPending}
        />
        <Selector
          etiqueta="Programa"
          valor={filtros.programa ?? ""}
          opciones={meta.data?.programas ?? []}
          onChange={(valor) => setFiltro("programa", valor)}
          deshabilitado={meta.isPending}
        />
        <Selector
          etiqueta="Familia"
          valor={filtros.familia ?? ""}
          opciones={meta.data?.familias ?? []}
          onChange={(valor) => setFiltro("familia", valor)}
          deshabilitado={meta.isPending}
        />
        <Selector
          etiqueta="Gestión"
          valor={filtros.gestion ?? ""}
          opciones={meta.data?.gestiones ?? []}
          onChange={(valor) => setFiltro("gestion", valor)}
          deshabilitado={meta.isPending}
        />

        <div className="col-span-2 flex items-end justify-between gap-2 md:col-span-4 xl:col-span-1 xl:justify-end">
          <span
            aria-live="polite"
            className="text-muted flex items-center gap-1.5 text-[10px]"
          >
            {actualizando && (
              <span className="border-cyan size-2 animate-spin rounded-full border border-t-transparent" />
            )}
            {actualizando
              ? "Actualizando"
              : kpis.data
                ? `${integer(kpis.data.eventos)} eventos`
                : "Datos al día"}
          </span>
          <Button
            type="button"
            label="Limpiar filtros"
            icon="pi pi-filter-slash"
            size="small"
            outlined
            severity="secondary"
            disabled={!hayFiltros}
            onClick={limpiar}
          />
        </div>
      </div>
      {meta.isError && (
        <p className="mt-2 text-[11px] text-amber-200">
          No se pudieron cargar las opciones de filtro.{" "}
          <Button
            type="button"
            label="Reintentar"
            text
            size="small"
            className="p-0! text-[11px]!"
            onClick={() => void meta.refetch()}
          />
        </p>
      )}
    </div>
  );
}
