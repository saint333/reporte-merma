import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Password } from "primereact/password";
import { useSearchParams, useNavigate } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import { PageHeader } from "../components/layout/PageHeader";
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
  const navigate = useNavigate();
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
            <Button
              label="Agregar registro"
              icon="pi pi-plus"
              size="small"
              outlined
              severity="secondary"
              onClick={() => navigate("/registros/nuevo")}
            />
            <Button
              label={exportando ? "Generando…" : "Descargar CSV"}
              icon="pi pi-download"
              size="small"
              outlined
              severity="secondary"
              loading={exportando}
              disabled={exportando || total === 0}
              onClick={() => void exportar()}
            />
          </>
        }
      />

      {aviso && <Message severity="success" text={aviso} />}

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
                <i
                  aria-hidden="true"
                  className="pi pi-search text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs"
                />
                <InputText
                  id="busqueda"
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Código, descripción, motivo, área…"
                  className="w-full pl-9!"
                />
              </div>
              <Button
                type="submit"
                label="Buscar"
                icon="pi pi-search"
                size="small"
                outlined
                severity="secondary"
              />
            </div>
          </form>

          <div className="flex items-center gap-2">
            <label className="text-muted flex items-center gap-2 text-[10px] tracking-[0.08em] uppercase">
              Filas
              <Dropdown
                value={perPage}
                options={[25, 50, 100]}
                onChange={(evento) =>
                  cambiarParametro("per_page", String(evento.value))
                }
                aria-label="Filas por página"
                className="text-xs"
                style={{ width: "5.5rem" }}
              />
            </label>
          </div>
        </div>
        {errorCsv && (
          <Message severity="error" text={errorCsv} className="mt-2" />
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
              <Button
                type="button"
                label="Anterior"
                icon="pi pi-chevron-left"
                size="small"
                outlined
                severity="secondary"
                disabled={page <= 1}
                onClick={() => cambiarPagina(page - 1)}
              />
              <Button
                type="button"
                label="Siguiente"
                icon="pi pi-chevron-right"
                iconPos="right"
                size="small"
                outlined
                severity="secondary"
                disabled={page >= paginas}
                onClick={() => cambiarPagina(page + 1)}
              />
            </div>
          </div>
        )}
      </Card>

      <Dialog
        header={`Eliminar registro #${porEliminar?.id ?? ""}`}
        visible={porEliminar !== null}
        onHide={() => {
          if (!eliminando) setPorEliminar(null);
        }}
        modal
        draggable={false}
        resizable={false}
        style={{ width: "30rem", maxWidth: "92vw" }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              label="Cancelar"
              severity="secondary"
              outlined
              size="small"
              disabled={eliminando}
              onClick={() => setPorEliminar(null)}
            />
            <Button
              type="button"
              label={eliminando ? "Eliminando…" : "Eliminar registro"}
              icon="pi pi-trash"
              severity="danger"
              size="small"
              loading={eliminando}
              onClick={() => void confirmarEliminar()}
            />
          </div>
        }
      >
        {porEliminar && (
          <>
            <p className="text-muted text-xs leading-relaxed">
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
                <Password
                  inputId="token-eliminar"
                  value={tokenEliminar}
                  onChange={(evento) => setTokenEliminar(evento.target.value)}
                  placeholder="ADMIN_TOKEN de la API"
                  feedback={false}
                  toggleMask
                  className="mt-1 w-full"
                  inputClassName="w-full"
                />
              </div>
            )}

            {errorEliminar && (
              <Message severity="error" text={errorEliminar} className="mt-3" />
            )}
          </>
        )}
      </Dialog>
    </div>
  );
}
