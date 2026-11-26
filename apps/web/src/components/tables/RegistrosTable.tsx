import { Link } from "react-router-dom";

import { dateLabel, integer, money } from "../../lib/formatters";
import type { Registro } from "../../lib/types";
import { Badge } from "../ui/Badge";

type Sort = "fecha" | "costo_total" | "cantidad" | "semana_iso";
type Order = "asc" | "desc";

function Cabecera({
  etiqueta,
  campo,
  sort,
  order,
  onSort,
  alineacion = "left",
}: {
  etiqueta: string;
  campo?: Sort;
  sort: Sort;
  order: Order;
  onSort: (campo: Sort) => void;
  alineacion?: "left" | "right";
}) {
  if (!campo) {
    return (
      <th
        className={`px-3 py-2.5 font-medium ${
          alineacion === "right" ? "text-right" : ""
        }`}
      >
        {etiqueta}
      </th>
    );
  }

  const activo = sort === campo;
  return (
    <th
      aria-sort={
        activo ? (order === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-3 py-2.5 font-medium ${
        alineacion === "right" ? "text-right" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(campo)}
        className="hover:text-ink inline-flex items-center gap-1 transition"
      >
        {etiqueta}
        {activo && <span aria-hidden="true">{order === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
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
      <div className="border-border hidden overflow-x-auto rounded-md border md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-header/80 text-muted border-border border-b text-[10px] tracking-[0.08em] uppercase">
              <Cabecera
                etiqueta="Fecha"
                campo="fecha"
                sort={sort}
                order={order}
                onSort={onSort}
              />
              <Cabecera
                etiqueta="Sem."
                campo="semana_iso"
                sort={sort}
                order={order}
                onSort={onSort}
              />
              <Cabecera etiqueta="Código" sort={sort} order={order} onSort={onSort} />
              <Cabecera
                etiqueta="Descripción"
                sort={sort}
                order={order}
                onSort={onSort}
              />
              <Cabecera etiqueta="Familia" sort={sort} order={order} onSort={onSort} />
              <Cabecera etiqueta="Programa" sort={sort} order={order} onSort={onSort} />
              <Cabecera
                etiqueta="Cantidad"
                campo="cantidad"
                sort={sort}
                order={order}
                onSort={onSort}
                alineacion="right"
              />
              <Cabecera etiqueta="Motivo" sort={sort} order={order} onSort={onSort} />
              <Cabecera etiqueta="Gestión" sort={sort} order={order} onSort={onSort} />
              <Cabecera
                etiqueta="Costo"
                campo="costo_total"
                sort={sort}
                order={order}
                onSort={onSort}
                alineacion="right"
              />
              {acciones && (
                <Cabecera etiqueta="Acciones" sort={sort} order={order} onSort={onSort} />
              )}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={fila.id}
                className="border-border/60 hover:bg-header/40 border-b transition-colors last:border-0"
              >
                <td className="text-ink px-3 py-2.5 whitespace-nowrap">
                  {dateLabel(fila.fecha)}
                </td>
                <td className="text-muted px-3 py-2.5 tabular-nums">
                  S{fila.semana_iso}
                </td>
                <td className="text-muted px-3 py-2.5 font-mono text-[11px]">
                  {fila.codigo_material}
                </td>
                <td className="text-ink max-w-[260px] truncate px-3 py-2.5">
                  {fila.descripcion}
                  {fila.es_duplicado && (
                    <Badge tono="alta" className="ml-2">
                      dup
                    </Badge>
                  )}
                </td>
                <td className="text-muted px-3 py-2.5">{fila.familia}</td>
                <td className="text-muted px-3 py-2.5">{fila.programa}</td>
                <td className="text-muted px-3 py-2.5 text-right tabular-nums">
                  {integer(fila.cantidad)} {fila.um}
                </td>
                <td className="text-muted px-3 py-2.5">{fila.motivo}</td>
                <td className="text-muted px-3 py-2.5">{fila.gestion}</td>
                <td className="text-ink px-3 py-2.5 text-right tabular-nums">
                  {money(fila.costo_total)}
                </td>
                {acciones && (
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5 whitespace-nowrap text-[11px]">
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
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
                  <Badge tono="alta">dup</Badge>
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
