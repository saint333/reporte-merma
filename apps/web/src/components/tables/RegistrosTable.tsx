import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Tag } from "primereact/tag";
import { Link, useNavigate } from "react-router-dom";

import { dateLabel, integer, money } from "../../lib/formatters";
import type { Registro } from "../../lib/types";

type Sort = "fecha" | "costo_total" | "cantidad" | "semana_iso";
type Order = "asc" | "desc";

function CabeceraOrden({
  etiqueta,
  campo,
  sort,
  order,
  onSort,
  alineacion = "left",
}: {
  etiqueta: string;
  campo: Sort;
  sort: Sort;
  order: Order;
  onSort: (campo: Sort) => void;
  alineacion?: "left" | "right";
}) {
  const activo = sort === campo;

  return (
    <button
      type="button"
      onClick={() => onSort(campo)}
      className={`inline-flex items-center gap-1 whitespace-nowrap transition hover:text-cyan! ${
        alineacion === "right" ? "justify-end" : ""
      } ${activo ? "text-cyan!" : ""}`}
    >
      {etiqueta}
      {activo && (
        <i
          aria-hidden="true"
          className={`pi text-[9px] ${
            order === "asc" ? "pi-sort-amount-up-alt" : "pi-sort-amount-down-alt"
          }`}
        />
      )}
    </button>
  );
}

function Acciones({
  fila,
  onEliminar,
}: {
  fila: Registro;
  onEliminar: (fila: Registro) => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        icon="pi pi-pencil"
        text
        rounded
        size="small"
        severity="info"
        aria-label={`Editar registro ${fila.id}`}
        onClick={() => navigate(`/registros/${fila.id}/editar`)}
      />
      <Button
        type="button"
        icon="pi pi-history"
        text
        rounded
        size="small"
        severity="secondary"
        aria-label={`Historial del producto ${fila.codigo_material}`}
        onClick={() => navigate(`/productos/${fila.codigo_material}`)}
      />
      <Button
        type="button"
        icon="pi pi-trash"
        text
        rounded
        size="small"
        severity="danger"
        aria-label={`Eliminar registro ${fila.id}`}
        onClick={() => onEliminar(fila)}
      />
    </div>
  );
}

export function RegistrosTable({
  filas,
  sort,
  order,
  onSort,
  acciones,
}: {
  filas: Registro[];
  sort: Sort;
  order: Order;
  onSort: (campo: Sort) => void;
  acciones?: { onEliminar: (fila: Registro) => void };
}) {
  return (
    <div>
      <div className="hidden md:block">
        <DataTable
          value={filas}
          dataKey="id"
          size="small"
          stripedRows
          scrollable
          className="text-xs"
          emptyMessage="Sin registros"
        >
          <Column
            header={
              <CabeceraOrden
                etiqueta="Fecha"
                campo="fecha"
                sort={sort}
                order={order}
                onSort={onSort}
              />
            }
            body={(fila: Registro) => dateLabel(fila.fecha)}
            style={{ minWidth: "7rem" }}
          />
          <Column
            header={
              <CabeceraOrden
                etiqueta="Sem."
                campo="semana_iso"
                sort={sort}
                order={order}
                onSort={onSort}
              />
            }
            body={(fila: Registro) => `S${fila.semana_iso}`}
            style={{ minWidth: "4.5rem" }}
          />
          <Column
            header="Código"
            body={(fila: Registro) => (
              <span className="font-mono text-[11px]">{fila.codigo_material}</span>
            )}
            style={{ minWidth: "6.5rem" }}
          />
          <Column
            header="Descripción"
            body={(fila: Registro) => (
              <div className="flex max-w-[260px] items-center gap-2">
                <span className="truncate">{fila.descripcion}</span>
                {fila.es_duplicado && (
                  <Tag value="dup" severity="danger" className="tag-app" />
                )}
              </div>
            )}
            style={{ minWidth: "14rem" }}
          />
          <Column
            header="Familia"
            body={(fila: Registro) => fila.familia}
            style={{ minWidth: "7rem" }}
          />
          <Column
            header="Programa"
            body={(fila: Registro) => fila.programa}
            style={{ minWidth: "7rem" }}
          />
          <Column
            header={
              <CabeceraOrden
                etiqueta="Cantidad"
                campo="cantidad"
                sort={sort}
                order={order}
                onSort={onSort}
                alineacion="right"
              />
            }
            body={(fila: Registro) =>
              `${integer(fila.cantidad)} ${fila.um}`
            }
            align="right"
            alignHeader="right"
            style={{ minWidth: "7rem" }}
          />
          <Column
            header="Motivo"
            body={(fila: Registro) => fila.motivo}
            style={{ minWidth: "10rem" }}
          />
          <Column
            header="Gestión"
            body={(fila: Registro) => fila.gestion}
            style={{ minWidth: "8rem" }}
          />
          <Column
            header={
              <CabeceraOrden
                etiqueta="Costo"
                campo="costo_total"
                sort={sort}
                order={order}
                onSort={onSort}
                alineacion="right"
              />
            }
            body={(fila: Registro) => money(fila.costo_total)}
            align="right"
            alignHeader="right"
            style={{ minWidth: "7rem" }}
          />
          {acciones && (
            <Column
              header="Acciones"
              body={(fila: Registro) => (
                <Acciones fila={fila} onEliminar={acciones.onEliminar} />
              )}
              style={{ minWidth: "7rem" }}
            />
          )}
        </DataTable>
      </div>

      <ul className="space-y-2 md:hidden">
        {filas.map((fila) => (
          <li
            key={fila.id}
            className="border-border bg-header/40 rounded-md border p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-muted text-[10px]">
                  {dateLabel(fila.fecha)} · S{fila.semana_iso} ·{" "}
                  {fila.codigo_material}
                </p>
                <p className="text-ink mt-1 text-xs font-medium">
                  {fila.descripcion}
                </p>
              </div>
              <p className="text-ink shrink-0 text-xs font-semibold tabular-nums">
                {money(fila.costo_total)}
              </p>
            </div>
            <div className="text-muted mt-2 grid grid-cols-2 gap-1 text-[11px]">
              <span>{fila.familia}</span>
              <span className="text-right">{fila.programa}</span>
              <span className="truncate">{fila.motivo}</span>
              <span className="text-right">{fila.gestion}</span>
              <span>
                {integer(fila.cantidad)} {fila.um}
              </span>
              {fila.es_duplicado && (
                <span className="text-right">
                  <Tag value="dup" severity="danger" className="tag-app" />
                </span>
              )}
            </div>
            {acciones && (
              <div className="border-border mt-2 flex items-center gap-3 border-t pt-2 text-[11px]">
                <Link
                  to={`/registros/${fila.id}/editar`}
                  className="text-cyan font-semibold underline underline-offset-4"
                >
                  Editar
                </Link>
                <Link
                  to={`/productos/${fila.codigo_material}`}
                  className="text-muted hover:text-ink font-medium underline underline-offset-4"
                >
                  Historial
                </Link>
                <button
                  type="button"
                  onClick={() => acciones.onEliminar(fila)}
                  className="font-semibold text-red-300 underline underline-offset-4 hover:text-red-200"
                >
                  Eliminar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
