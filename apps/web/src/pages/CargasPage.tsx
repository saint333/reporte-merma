import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { guardarTokenAdmin, leerTokenAdmin, subirCarga } from "../lib/api";
import { dateLabel, dateTimeLabel, integer, money } from "../lib/formatters";
import { cargasQuery, saludQuery } from "../lib/queries";
import type { ReporteCarga } from "../lib/types";

type Modo = "append" | "replace";

function Dato({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
}) {
  return (
    <div className="border-border bg-header/40 rounded-md border p-3">
      <p className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase">
        {etiqueta}
      </p>
      <p className="text-ink mt-1 text-sm font-semibold">{valor}</p>
      {detalle && <p className="text-muted mt-0.5 text-[11px]">{detalle}</p>}
    </div>
  );
}

function EstadoCarga({ estado }: { estado: string }) {
  const clase =
    estado === "completada"
      ? "bg-green/10 text-green ring-green/25"
      : estado === "fallida"
        ? "bg-red/10 text-red ring-red/25"
        : estado === "revertida"
          ? "bg-amber/10 text-amber ring-amber/25"
          : "bg-cyan/10 text-cyan ring-cyan/25";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase ring-1 ${clase}`}
    >
      {estado}
    </span>
  );
}

export default function CargasPage() {
  const queryClient = useQueryClient();
  const cargas = useQuery(cargasQuery);
  const salud = useQuery(saludQuery);
  const requiereToken = salud.data?.carga_requiere_token ?? false;

  const [archivo, setArchivo] = useState<File | null>(null);
  const [modo, setModo] = useState<Modo>("append");
  const [token, setToken] = useState(() => leerTokenAdmin());
  const [confirmo, setConfirmo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; codigo?: string } | null>(
    null,
  );
  const [reporte, setReporte] = useState<ReporteCarga | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!archivo) {
      setError({ mensaje: "Selecciona el archivo .xlsx del reporte de mermas." });
      return;
    }
    const clave = token.trim();
    if (requiereToken && clave.length < 16) {
      setError({
        mensaje:
          "La clave de administración debe tener al menos 16 caracteres (ADMIN_TOKEN de la API).",
      });
      return;
    }
    if (modo === "replace" && !confirmo) {
      setError({
        mensaje:
          "Marca la confirmación para reemplazar los hechos de la carga anterior de este mismo archivo.",
      });
      return;
    }

    setEnviando(true);
    setError(null);
    setReporte(null);

    try {
      const resultado = await subirCarga(archivo, modo, requiereToken ? clave : "");
      if (requiereToken) guardarTokenAdmin(clave);
      setReporte(resultado);
      setArchivo(null);
      setConfirmo(false);
      formulario.current?.reset();
      await queryClient.invalidateQueries();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Datos"
        titulo="Cargas"
        descripcion="Sube el Excel del reporte y la API reemplaza o agrega los datos sin pasar por tu máquina"
        acciones={
          requiereToken ? (
            <Badge tono="media">Requiere clave de administración</Badge>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Subir el reporte de mermas"
          subtitle="Mismo ETL que la CLI: valida hojas, catálogos, motivos y duplicados antes de escribir."
        >
          <form ref={formulario} onSubmit={(evento) => void enviar(evento)}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="archivo"
                  className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase"
                >
                  Archivo
                </label>
                <input
                  id="archivo"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(evento) => {
                    setArchivo(evento.target.files?.[0] ?? null);
                    setReporte(null);
                    setError(null);
                  }}
                  className="border-border bg-header text-ink focus-visible:ring-cyan focus-visible:ring-offset-page mt-1 w-full cursor-pointer rounded-md border px-3 py-2 text-xs file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-cyan/10 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-cyan focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
                <p className="text-muted mt-1 text-[11px]">
                  {archivo
                    ? `${archivo.name} · ${(archivo.size / 1024).toFixed(0)} KB`
                    : "Hasta 20 MB. Debe incluir REGISTRO_MERMAS, MAESTRO_MATERIALES y CATALOGO_MOTIVOS."}
                </p>
              </div>

              <fieldset>
                <legend className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase">
                  Modo
                </legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <label className="border-border bg-header/40 has-[:checked]:border-cyan/50 has-[:checked]:bg-cyan/5 flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                    <input
                      type="radio"
                      name="modo"
                      value="append"
                      checked={modo === "append"}
                      onChange={() => setModo("append")}
                      className="accent-cyan mt-0.5"
                    />
                    <span>
                      <span className="text-ink block text-xs font-semibold">
                        Agregar
                      </span>
                      <span className="text-muted block text-[11px]">
                        Suma filas nuevas y omite las que ya existen.
                      </span>
                    </span>
                  </label>
                  <label className="border-border bg-header/40 has-[:checked]:border-cyan/50 has-[:checked]:bg-cyan/5 flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                    <input
                      type="radio"
                      name="modo"
                      value="replace"
                      checked={modo === "replace"}
                      onChange={() => setModo("replace")}
                      className="accent-cyan mt-0.5"
                    />
                    <span>
                      <span className="text-ink block text-xs font-semibold">
                        Reemplazar
                      </span>
                      <span className="text-muted block text-[11px]">
                        Borra los hechos de la carga anterior de este archivo.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {modo === "replace" && (
                <label className="border-amber/30 bg-amber/5 flex items-start gap-2 rounded-md border p-2.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={confirmo}
                    onChange={(evento) => setConfirmo(evento.target.checked)}
                    className="accent-amber mt-0.5"
                  />
                  <span className="text-amber">
                    Entiendo que se eliminan los eventos de la carga previa de
                    este archivo y se vuelven a insertar.
                  </span>
                </label>
              )}

              {requiereToken && (
                <div>
                  <label
                    htmlFor="token"
                    className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase"
                  >
                    Clave de administración
                  </label>
                  <input
                    id="token"
                    type="password"
                    autoComplete="off"
                    value={token}
                    onChange={(evento) => setToken(evento.target.value)}
                    placeholder="ADMIN_TOKEN de la API"
                    className="border-border bg-header text-ink placeholder:text-muted/70 focus-visible:ring-cyan focus-visible:ring-offset-page mt-1 w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  />
                  <p className="text-muted mt-1 text-[11px]">
                    Esta API tiene ADMIN_TOKEN definido. Se guarda solo en esta
                    pestaña (sessionStorage); nunca viaja en el bundle.
                  </p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="border-red/30 bg-red/5 rounded-md border p-3"
                >
                  <p className="text-[12px] font-medium text-red-300">
                    {error.mensaje}
                  </p>
                  {error.codigo && (
                    <p className="text-muted mt-1 font-mono text-[10px]">
                      {error.codigo}
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="bg-cyan focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Procesando archivo…" : "Cargar datos"}
              </button>
              {enviando && (
                <p className="text-muted text-[11px]">
                  Validando y escribiendo en Postgres. En el plan free de Render
                  el primer intento puede tardar por el arranque en frío.
                </p>
              )}
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          {reporte ? (
            <Card
              title={
                reporte.ya_cargado
                  ? "El archivo ya estaba cargado"
                  : "Carga completada"
              }
              subtitle={
                reporte.ya_cargado
                  ? "El hash coincide con una carga vigente: no se insertó nada."
                  : `${reporte.archivo} procesado en ${(reporte.duracion_ms / 1000).toFixed(1)} s`
              }
            >
              <div className="grid grid-cols-2 gap-2">
                <Dato
                  etiqueta="Insertadas"
                  valor={integer(reporte.insertadas)}
                  detalle={`${integer(reporte.leidas)} leídas`}
                />
                <Dato
                  etiqueta="Costo"
                  valor={money(reporte.costo_total)}
                  detalle="merma del archivo"
                />
                <Dato
                  etiqueta="Omitidas"
                  valor={integer(reporte.omitidas_por_existir)}
                  detalle="ya en la base"
                />
                <Dato
                  etiqueta="Errores"
                  valor={integer(reporte.errores)}
                  detalle="filas descartadas"
                />
              </div>

              <p className="text-muted mt-3 text-[11px]">
                {reporte.desde && reporte.hasta
                  ? `Rango ${dateLabel(reporte.desde)} – ${dateLabel(reporte.hasta)}`
                  : "El archivo no aportó fechas válidas"}
                {` · ${integer(reporte.posibles_duplicados.length)} grupos duplicados`}
              </p>

              {reporte.motivos_no_catalogados.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-medium tracking-[0.12em] text-amber uppercase">
                    Motivos no catalogados
                  </p>
                  <ul className="mt-1 space-y-1">
                    {reporte.motivos_no_catalogados.slice(0, 5).map((motivo) => (
                      <li key={motivo.motivo} className="text-[11px] text-amber">
                        {motivo.motivo} · {money(motivo.costo)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reporte.detalle_errores.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-medium tracking-[0.12em] text-red-300 uppercase">
                    Primeras filas con error
                  </p>
                  <ul className="mt-1 space-y-1">
                    {reporte.detalle_errores.slice(0, 5).map((fallo) => (
                      <li key={`${fallo.fila}-${fallo.codigo}`} className="text-[11px] text-red-300">
                        Fila {fallo.fila}: {fallo.mensaje}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Link
                to="/"
                className="text-cyan mt-4 inline-block text-xs font-semibold underline underline-offset-4"
              >
                Ver el dashboard actualizado
              </Link>
            </Card>
          ) : (
            <Card title="Qué hace la carga">
              <ul className="text-muted space-y-2 text-[11px] leading-relaxed">
                <li>
                  Valida las tres hojas, el catálogo de motivos y el maestro de
                  materiales antes de escribir.
                </li>
                <li>
                  Registra el archivo, su hash y los contadores en{" "}
                  <span className="font-mono text-[10px]">merma.carga</span> para
                  que el historial quede auditable.
                </li>
                <li>
                  Invalida la caché de KPIs, series y Pareto para que el
                  dashboard muestre los datos nuevos de inmediato.
                </li>
                <li>
                  Rechaza el archivo completo si alguna hoja falta o un valor
                  unitario es inválido.
                </li>
              </ul>
            </Card>
          )}
        </div>
      </div>

      {cargas.isPending && cargas.failureCount > 0 && <ColdStartNotice />}

      <Card
        title="Historial de cargas"
        subtitle="Últimas 20 cargas del Excel registradas, por fecha de ejecución"
      >
        {cargas.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((indice) => (
              <Skeleton key={indice} className="h-10 w-full" />
            ))}
          </div>
        ) : cargas.error ? (
          <ErrorState
            error={cargas.error}
            onRetry={() => void cargas.refetch()}
            compact
          />
        ) : !cargas.data?.length ? (
          <p className="text-muted text-xs">
            Todavía no hay cargas registradas. Sube el primer archivo con el
            formulario de arriba.
          </p>
        ) : (
          <div className="border-border overflow-x-auto rounded-md border">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead>
                <tr className="bg-header/80 text-muted border-border border-b text-[10px] tracking-[0.08em] uppercase">
                  <th className="px-3 py-2.5 font-medium">Fecha</th>
                  <th className="px-3 py-2.5 font-medium">Archivo</th>
                  <th className="px-3 py-2.5 font-medium">Modo</th>
                  <th className="px-3 py-2.5 text-right font-medium">Insertadas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Costo</th>
                  <th className="px-3 py-2.5 font-medium">Rango</th>
                  <th className="px-3 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cargas.data.map((carga) => (
                  <tr
                    key={carga.id}
                    className="border-border/60 hover:bg-header/40 border-b transition-colors last:border-0"
                  >
                    <td className="text-ink px-3 py-2.5 whitespace-nowrap">
                      {dateTimeLabel(carga.creada_en)}
                    </td>
                    <td className="text-muted max-w-[220px] truncate px-3 py-2.5">
                      {carga.archivo}
                    </td>
                    <td className="text-muted px-3 py-2.5">{carga.modo ?? "—"}</td>
                    <td className="text-ink px-3 py-2.5 text-right">
                      {integer(carga.filas_insertadas)}
                    </td>
                    <td className="text-ink px-3 py-2.5 text-right whitespace-nowrap">
                      {money(carga.costo_total ?? "0")}
                    </td>
                    <td className="text-muted px-3 py-2.5 whitespace-nowrap">
                      {carga.desde && carga.hasta
                        ? `${dateLabel(carga.desde)} – ${dateLabel(carga.hasta)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <EstadoCarga estado={carga.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
