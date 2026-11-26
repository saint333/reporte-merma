import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import { PageHeader } from "../components/layout/PageHeader";
import { Icono } from "../components/layout/Iconos";
import { RegistrosTable } from "../components/tables/RegistrosTable";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import {
  descargarCsv,
  eliminarRegistro,
  guardarTokenAdmin,
  leerTokenAdmin,
} from "../lib/api";
import { dateLabel, decimal, integer, money4 } from "../lib/formatters";
import { paramsFiltros, useFiltros } from "../lib/filters";
import { registrosQuery, saludQuery } from "../lib/queries";
import type { Registro } from "../lib/types";

const ORDENES = ["fecha", "costo_total", "cantidad", "semana_iso"] as const;
type Sort = (typeof ORDENES)[number];
type Order = "asc" | "desc";

function leerSort(valor: string | null): Sort {
  return ORDENES.includes(valor as Sort) ? (valor as Sort) : "fecha";
}

function leerPagina(valor: string | null): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : 1;
}

export default function RegistrosPage() {
  const queryClient = useQueryClient();
  const { filtros } = useFiltros();
  const salud = useQuery(saludQuery);
  const requiereToken = salud.data?.carga_requiere_token ?? false;
  const [searchParams, setSearchParams] = useSearchParams();
  const qUrl = searchParams.get("q") ?? "";
  const [busqueda, setBusqueda] = useState(qUrl);
  const [exportando, setExportando] = useState(false);
  const [errorCsv, setErrorCsv] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<Registro | null>(null);
  const [tokenEliminar, setTokenEliminar] = useState(() => leerTokenAdmin());
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const page = leerPagina(searchParams.get("page"));
  const perPage = [25, 50, 100].includes(Number(searchParams.get("per_page")))
    ? Number(searchParams.get("per_page"))
    : 50;
  const sort = leerSort(searchParams.get("sort"));
  const order: Order = searchParams.get("order") === "asc" ? "asc" : "desc";

  useEffect(() => {
    setBusqueda(qUrl);
  }, [qUrl]);

  useEffect(() => {
    if (busqueda === qUrl) return;

    const temporizador = window.setTimeout(() => {
      const siguiente = new URLSearchParams(searchParams);
      if (busqueda.trim()) siguiente.set("q", busqueda.trim());
      else siguiente.delete("q");
      siguiente.delete("page");
      setSearchParams(siguiente, { replace: true });
    }, 350);

    return () => window.clearTimeout(temporizador);
  }, [busqueda, qUrl, searchParams, setSearchParams]);

  const registros = useQuery(
    registrosQuery({
      ...filtros,
      page,
      per_page: perPage,
      sort,
      order,
      q: qUrl || undefined,
    }),
  );

  function cambiarParametro(clave: string, valor: string) {
    const siguiente = new URLSearchParams(searchParams);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    siguiente.delete("page");
    setSearchParams(siguiente);
  }

  function ordenar(campo: Sort) {
    const siguiente = new URLSearchParams(searchParams);
    if (sort === campo) {
      siguiente.set("order", order === "asc" ? "desc" : "asc");
    } else {
      siguiente.set("sort", campo);
      siguiente.set("order", "desc");
    }
    siguiente.delete("page");
    setSearchParams(siguiente);
  }

  function cambiarPagina(nueva: number) {
    const siguiente = new URLSearchParams(searchParams);
    if (nueva <= 1) siguiente.delete("page");
    else siguiente.set("page", String(nueva));
    setSearchParams(siguiente);
  }

  function limpiarTodo() {
    const siguiente = new URLSearchParams(searchParams);
    for (const clave of ["mes", "programa", "familia", "gestion", "q", "page"]) {
      siguiente.delete(clave);
    }
    setBusqueda("");
    setSearchParams(siguiente);
  }

  function pedirEliminar(fila: Registro) {
    setPorEliminar(fila);
    setErrorEliminar(null);
    setAviso(null);
  }

  async function confirmarEliminar() {
    if (!porEliminar) return;

    const clave = tokenEliminar.trim();
    if (requiereToken && clave.length < 16) {
      setErrorEliminar(
        "La clave de administración debe tener al menos 16 caracteres (ADMIN_TOKEN de la API).",
      );
      return;
    }

    setEliminando(true);
    setErrorEliminar(null);

    try {
      await eliminarRegistro(
        porEliminar.id,
        requiereToken ? clave : "",
      );
      if (requiereToken) guardarTokenAdmin(clave);
      setAviso(
        `Registro #${porEliminar.id} eliminado. El antes/después quedó en el historial del producto.`,
      );
      setPorEliminar(null);
      await queryClient.invalidateQueries();
    } catch (fallo) {
      setErrorEliminar(mensajeDeError(fallo).mensaje);
    } finally {
      setEliminando(false);
    }
  }

  async function exportar() {
    setExportando(true);
    setErrorCsv(null);
    try {
      await descargarCsv({
        ...paramsFiltros(filtros),
        q: qUrl,
      });
    } catch (error) {
      setErrorCsv(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el CSV.",
      );
    } finally {
      setExportando(false);
    }
  }

  const total = registros.data?.page.total ?? 0;
  const paginas = registros.data?.page.pages ?? 0;
  const desde = total === 0 ? 0 : (page - 1) * perPage + 1;
  const hasta = Math.min(page * perPage, total);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Datos"
        titulo="Registros"
        descripcion="Explora los eventos de merma, ordena por impacto y descarga el detalle del corte"
        acciones={
          <>
            {registros.data && (
              <Badge tono="cyan">{integer(total)} registros</Badge>
            )}
            <Link
              to="/registros/nuevo"
              className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Icono nombre="agregar" className="size-3.5" />
              Agregar registro
            </Link>
            <button
              type="button"
              onClick={() => void exportar()}
              disabled={exportando || total === 0}
              className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icono nombre="descargar" className="size-3.5" />
              {exportando ? "Generando…" : "Descargar CSV"}
            </button>
          </>
        }
      />

      {aviso && (
        <div
          role="status"
          className="border-green/30 bg-green/10 text-green rounded-md border p-3 text-[11px]"
        >
          {aviso}
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <form
            className="flex-1"
            onSubmit={(evento) => {
              evento.preventDefault();
              const siguiente = new URLSearchParams(searchParams);
              if (busqueda.trim()) siguiente.set("q", busqueda.trim());
              else siguiente.delete("q");
              siguiente.delete("page");
              setSearchParams(siguiente);
            }}
          >
            <label
              htmlFor="busqueda"
              className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase"
            >
              Buscar
            </label>
            <div className="mt-1 flex gap-2">
              <div className="relative flex-1">
                <Icono
                  nombre="buscar"
                  className="text-muted pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
                />
                <input
                  id="busqueda"
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Código, descripción, motivo, área…"
                  className="border-border bg-header text-ink placeholder:text-muted/70 focus-visible:ring-cyan focus-visible:ring-offset-page w-full rounded-md border py-2 pr-3 pl-9 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
              </div>
              <button
                type="submit"
                className="border-border bg-surface text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Buscar
              </button>
            </div>
          </form>

          <div className="flex items-center gap-2">
            <label className="text-muted flex items-center gap-2 text-[10px] tracking-[0.08em] uppercase">
              Filas
              <select
                value={perPage}
                onChange={(evento) =>
                  cambiarParametro("per_page", evento.target.value)
                }
                className="border-border bg-surface text-ink focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-2 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {[25, 50, 100].map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {errorCsv && (
          <p role="alert" className="mt-2 text-[11px] text-red-300">
            {errorCsv}
          </p>
        )}
      </Card>

      {registros.isPending && registros.failureCount > 0 && (
        <ColdStartNotice />
      )}

      <Card
        title="Detalle de movimientos"
        action={
          registros.data ? (
            <span aria-live="polite" className="text-muted text-[11px]">
              {integer(total)} registros · mostrando {integer(desde)}–
              {integer(hasta)}
            </span>
          ) : undefined
        }
      >
        {registros.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((indice) => (
              <Skeleton key={indice} className="h-10 w-full" />
            ))}
          </div>
        ) : registros.error ? (
          <ErrorState
            error={registros.error}
            onRetry={() => void registros.refetch()}
            compact
          />
        ) : !registros.data?.data.length ? (
          <EmptyState
            mensaje="No encontramos registros con esos filtros."
            onClear={limpiarTodo}
          />
        ) : (
          <div
            className={
              registros.isPlaceholderData ? "opacity-60 transition" : ""
            }
          >
            <RegistrosTable
              filas={registros.data.data}
              sort={sort}
              order={order}
              onSort={ordenar}
              acciones={{ onEliminar: pedirEliminar }}
            />
          </div>
        )}

        {registros.data && total > 0 && (
          <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-muted text-[11px]">
              Página {page} de {Math.max(1, paginas)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cambiarPagina(page - 1)}
                disabled={page <= 1}
                className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => cambiarPagina(page + 1)}
                disabled={page >= paginas}
                className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>

      {porEliminar && (
        <div
          className="bg-page/70 fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm"
          onClick={() => {
            if (!eliminando) setPorEliminar(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-eliminar"
            onClick={(evento) => evento.stopPropagation()}
            className="bg-surface border-border rounded-card shadow-card w-full max-w-md border p-5"
          >
            <p className="text-cyan text-[10px] font-semibold tracking-[0.18em] uppercase">
              Confirmar
            </p>
            <h2
              id="titulo-eliminar"
              className="text-ink mt-1 text-sm font-semibold"
            >
              Eliminar registro #{porEliminar.id}
            </h2>
            <p className="text-muted mt-2 text-xs leading-relaxed">
              Se quitará de los KPIs, series y gráficas. El evento y su detalle
              quedarán en el historial del producto.
            </p>

            <div className="border-border bg-header/40 mt-3 rounded-md border p-3">
              <p className="text-ink text-[11px] font-medium">
                {porEliminar.descripcion}
              </p>
              <p className="text-muted mt-1 text-[11px]">
                {dateLabel(porEliminar.fecha)} ·{" "}
                {decimal(porEliminar.cantidad, 4)} {porEliminar.um} ·{" "}
                {porEliminar.motivo}
              </p>
              <p className="text-ink mt-1 text-xs font-semibold tabular-nums">
                {money4(porEliminar.costo_total)}
              </p>
            </div>

            {requiereToken && (
              <div className="mt-3">
                <label
                  htmlFor="token-eliminar"
                  className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase"
                >
                  Clave de administración
                </label>
                <input
                  id="token-eliminar"
                  type="password"
                  autoComplete="off"
                  value={tokenEliminar}
                  onChange={(evento) => setTokenEliminar(evento.target.value)}
                  placeholder="ADMIN_TOKEN de la API"
                  className="border-border bg-header text-ink placeholder:text-muted/70 focus-visible:ring-cyan focus-visible:ring-offset-page mt-1 w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
              </div>
            )}

            {errorEliminar && (
              <p role="alert" className="mt-3 text-[11px] text-red-300">
                {errorEliminar}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPorEliminar(null)}
                disabled={eliminando}
                className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-3 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarEliminar()}
                disabled={eliminando}
                className="focus-visible:ring-red focus-visible:ring-offset-page rounded-md bg-red-500/15 px-3 py-1.5 text-[11px] font-semibold text-red-200 ring-1 ring-red-500/30 transition hover:bg-red-500/25 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                {eliminando ? "Eliminando…" : "Eliminar registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
