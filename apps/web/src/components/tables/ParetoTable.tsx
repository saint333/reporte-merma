import { useRef, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";

import { cx } from "../../lib/cx";
import { integer, money, percent } from "../../lib/formatters";
import type { FilaPareto } from "../../lib/types";

function severidadAbc(clase: string) {
  if (clase.startsWith("A")) return "danger" as const;
  if (clase.startsWith("B")) return "warning" as const;
  return undefined;
}

function EtiquetaAbc({ clase }: { clase: string }) {
  const severidad = severidadAbc(clase);

  return (
    <Tag
      value={clase.slice(0, 1)}
      severity={severidad}
      className={cx(
        "tag-app w-6 justify-center",
        !severidad && "tag-app-neutral",
      )}
    />
  );
}

export function ParetoTable({
  filas,
  onSeleccionar,
}: {
  filas: FilaPareto[];
  onSeleccionar?: (fila: FilaPareto) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const tabla = useRef<DataTable<FilaPareto[]>>(null);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <i
            aria-hidden="true"
            className="pi pi-search text-muted pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs"
          />
          <InputText
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar SKU, familia o programa"
            aria-label="Buscar en el Pareto"
            className="w-full pl-8 text-xs"
          />
        </div>
        <Button
          type="button"
          label="CSV"
          icon="pi pi-download"
          size="small"
          outlined
          severity="secondary"
          aria-label="Exportar el Pareto a CSV"
          onClick={() => tabla.current?.exportCSV()}
        />
      </div>

      <DataTable
        ref={tabla}
        value={filas}
        dataKey="codigo"
        size="small"
        stripedRows
        responsiveLayout="stack"
        breakpoint="768px"
        globalFilter={busqueda}
        globalFilterFields={["codigo", "descripcion", "familia", "programa"]}
        paginator={filas.length > 10}
        rows={10}
        rowsPerPageOptions={[10, 25, 50]}
        paginatorTemplate="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first}–{last} de {totalRecords}"
        emptyMessage="Sin datos para el filtro actual"
        onRowClick={(evento) => onSeleccionar?.(evento.data as FilaPareto)}
        rowClassName={() => cx(onSeleccionar && "cursor-pointer transition-colors")}
        className="text-xs"
      >
      <Column
        field="rank"
        header="#"
        style={{ minWidth: "3.5rem" }}
        body={(fila: FilaPareto) => (
          <span
            className={cx(
              "tabular-nums",
              fila.clase_abc.startsWith("A") && "text-ink font-semibold",
            )}
          >
            {fila.rank}
          </span>
        )}
      />
      <Column
        field="codigo"
        header="Código"
        style={{ minWidth: "6.5rem" }}
        body={(fila: FilaPareto) => (
          <span className="text-muted font-mono text-[11px]">{fila.codigo}</span>
        )}
      />
      <Column
        field="descripcion"
        header="Descripción"
        style={{ minWidth: "14rem" }}
        body={(fila: FilaPareto) => (
          <span className="text-ink block max-w-70 truncate">
            {fila.descripcion}
          </span>
        )}
      />
      <Column
        field="familia"
        header="Familia"
        style={{ minWidth: "7rem" }}
        body={(fila: FilaPareto) => (
          <span className="text-muted">{fila.familia}</span>
        )}
      />
      <Column
        field="eventos"
        header="Eventos"
        align="right"
        alignHeader="right"
        style={{ minWidth: "5.5rem" }}
        body={(fila: FilaPareto) => (
          <span className="text-muted tabular-nums">
            {integer(fila.eventos)}
          </span>
        )}
      />
      <Column
        field="costo"
        header="Costo"
        align="right"
        alignHeader="right"
        style={{ minWidth: "7rem" }}
        body={(fila: FilaPareto) => (
          <span className="text-ink tabular-nums">{money(fila.costo)}</span>
        )}
      />
      <Column
        field="participacion"
        header="% part."
        align="right"
        alignHeader="right"
        style={{ minWidth: "5rem" }}
        body={(fila: FilaPareto) => (
          <span className="text-muted tabular-nums">
            {percent(Number(fila.participacion), 2)}
          </span>
        )}
      />
      <Column
        field="acumulado"
        header="Acumulado"
        style={{ minWidth: "9rem" }}
        body={(fila: FilaPareto) => {
          const valor = Math.min(100, Number(fila.acumulado) * 100);

          return (
            <div className="flex items-center gap-2">
              <ProgressBar
                value={valor}
                showValue={false}
                style={{ height: "6px", width: "80px" }}
              />
              <span className="text-muted text-[11px] tabular-nums">
                {percent(Number(fila.acumulado), 2)}
              </span>
            </div>
          );
        }}
      />
      <Column
        field="clase_abc"
        header="Clase"
        style={{ minWidth: "4.5rem" }}
        body={(fila: FilaPareto) => <EtiquetaAbc clase={fila.clase_abc} />}
      />
      {onSeleccionar && (
        <Column
          header=""
          style={{ minWidth: "3rem" }}
          body={(fila: FilaPareto) => (
            <Button
              type="button"
              icon="pi pi-arrow-right"
              text
              rounded
              size="small"
              severity="info"
              aria-label={`Ver detalle de ${fila.codigo}`}
              onClick={(evento) => {
                evento.stopPropagation();
                onSeleccionar(fila);
              }}
            />
          )}
        />
      )}
      </DataTable>
    </div>
  );
}
