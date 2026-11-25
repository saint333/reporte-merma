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
        className={`px-2 py-2 font-medium ${
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
      className={`px-2 py-2 font-medium ${
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
}: {
  filas: Registro[];
  sort: Sort;
  order: Order;
  onSort: (campo: Sort) => void;
}) {
  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-header text-muted text-[10px] tracking-[0.08em] uppercase">
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
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={fila.id}
                className="border-border/70 hover:bg-header/40 border-b"
              >
                <td className="text-ink px-2 py-2 whitespace-nowrap">
                  {dateLabel(fila.fecha)}
                </td>
                <td className="text-muted px-2 py-2 tabular-nums">
                  S{fila.semana_iso}
                </td>
                <td className="text-muted px-2 py-2 font-mono text-[11px]">
                  {fila.codigo_material}
                </td>
                <td className="text-ink max-w-[220px] truncate px-2 py-2">
                  {fila.descripcion}
                  {fila.es_duplicado && (
                    <Badge tono="alta" className="ml-2">
                      dup
                    </Badge>
                  )}
                </td>
                <td className="text-muted px-2 py-2">{fila.familia}</td>
                <td className="text-muted px-2 py-2">{fila.programa}</td>
                <td className="text-muted px-2 py-2 text-right tabular-nums">
                  {integer(fila.cantidad)} {fila.um}
                </td>
                <td className="text-muted px-2 py-2">{fila.motivo}</td>
                <td className="text-muted px-2 py-2">{fila.gestion}</td>
                <td className="text-ink px-2 py-2 text-right tabular-nums">
                  {money(fila.costo_total)}
                </td>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
