import { useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import {
  FileUpload,
  type FileUploadSelectEvent,
} from "primereact/fileupload";
import { Checkbox } from "primereact/checkbox";
import { Message } from "primereact/message";
import { RadioButton } from "primereact/radiobutton";
import { Tag } from "primereact/tag";
import { Link } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { subirCarga } from "../lib/api";
import { dateLabel, dateTimeLabel, integer, money } from "../lib/formatters";
import { cargasQuery } from "../lib/queries";
import type { CargaHistorial, ReporteCarga } from "../lib/types";

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
  const severidad =
    estado === "completada"
      ? "success"
      : estado === "fallida"
        ? "danger"
        : estado === "revertida"
          ? "warning"
          : "info";

  return <Tag value={estado} severity={severidad} />;
}

export default function CargasPage() {
  const queryClient = useQueryClient();
  const cargas = useQuery(cargasQuery);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [modo, setModo] = useState<Modo>("append");
  const [confirmo, setConfirmo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; codigo?: string } | null>(
    null,
  );
  const [reporte, setReporte] = useState<ReporteCarga | null>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const archivoRef = useRef<FileUpload>(null);
  const cargaPrevia = archivo
    ? (cargas.data ?? []).find((carga) => carga.archivo === archivo.name)
    : undefined;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!archivo) {
      setError({ mensaje: "Selecciona el archivo .xlsx del reporte de mermas." });
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
      const resultado = await subirCarga(archivo, modo);
      setReporte(resultado);
      setArchivo(null);
      setConfirmo(false);
      formulario.current?.reset();
      archivoRef.current?.clear();
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
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Subir el reporte de mermas"
          subTitle="Mismo ETL que la CLI: valida hojas, catálogos, motivos y duplicados antes de escribir."
        >
          <form ref={formulario} onSubmit={(evento) => void enviar(evento)}>
            <div className="space-y-4">
              <div>
                <span className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase">
                  Archivo
                </span>
                <FileUpload
                  ref={archivoRef}
                  mode="basic"
                  auto={false}
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  maxFileSize={20 * 1024 * 1024}
                  chooseLabel="Seleccionar Excel"
                  chooseOptions={{ icon: "pi pi-file-excel" }}
                  invalidFileSizeMessageSummary="Archivo demasiado grande"
                  invalidFileSizeMessageDetail="El máximo es 20 MB."
                  onSelect={(evento: FileUploadSelectEvent) => {
                    setArchivo(evento.files[0] ?? null);
                    setReporte(null);
                    setError(null);
                  }}
                  onClear={() => {
                    setArchivo(null);
                    setReporte(null);
                  }}
                  className="mt-1"
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
                  <label className="border-border bg-header/40 has-checked:border-cyan/50 has-checked:bg-cyan/5 flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                    <RadioButton
                      inputId="modo-append"
                      name="modo"
                      value="append"
                      checked={modo === "append"}
                      onChange={() => setModo("append")}
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
                  <label className="border-border bg-header/40 has-checked:border-cyan/50 has-checked:bg-cyan/5 flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                    <RadioButton
                      inputId="modo-replace"
                      name="modo"
                      value="replace"
                      checked={modo === "replace"}
                      onChange={() => setModo("replace")}
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
                  <Checkbox
                    inputId="confirmo"
                    checked={confirmo}
                    onChange={(evento) => setConfirmo(Boolean(evento.checked))}
                  />
                  <span className="text-amber">
                    Entiendo que se eliminan los eventos de la carga previa de
                    este archivo y se vuelven a insertar.
                    {cargaPrevia && (
                      <>
                        {" "}Se eliminarán {integer(cargaPrevia.filas_insertadas)}{" "}
                        filas de la carga del {dateTimeLabel(cargaPrevia.creada_en)}.
                      </>
                    )}
                  </span>
                </label>
              )}

              

              {error && (
                <Message
                  severity="error"
                  content={
                    <>
                      <p className="text-[12px] font-medium">{error.mensaje}</p>
                      {error.codigo && (
                        <p className="mt-1 font-mono text-[10px] opacity-80">
                          {error.codigo}
                        </p>
                      )}
                    </>
                  }
                />
              )}

              <Button
                type="submit"
                label={enviando ? "Procesando archivo…" : "Cargar datos"}
                icon="pi pi-cloud-upload"
                loading={enviando}
                disabled={enviando}
              />
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
              subTitle={
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
        subTitle="Últimas 20 cargas del Excel registradas, por fecha de ejecución"
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
        ) : (
          <DataTable
            value={cargas.data ?? []}
            dataKey="id"
            size="small"
            stripedRows
            scrollable
            className="text-xs"
            emptyMessage="Todavía no hay cargas del Excel registradas."
          >
            <Column
              header="Fecha"
              body={(carga: CargaHistorial) => dateTimeLabel(carga.creada_en)}
              style={{ minWidth: "9rem" }}
            />
            <Column
              header="Archivo"
              body={(carga: CargaHistorial) => (
                <span className="block max-w-55 truncate">
                  {carga.archivo}
                </span>
              )}
              style={{ minWidth: "12rem" }}
            />
            <Column
              header="Modo"
              body={(carga: CargaHistorial) => carga.modo ?? "—"}
            />
            <Column
              header="Insertadas"
              body={(carga: CargaHistorial) => integer(carga.filas_insertadas)}
              align="right"
            />
            <Column
              header="Costo"
              body={(carga: CargaHistorial) => money(carga.costo_total ?? "0")}
              align="right"
            />
            <Column
              header="Rango"
              body={(carga: CargaHistorial) =>
                carga.desde && carga.hasta
                  ? `${dateLabel(carga.desde)} – ${dateLabel(carga.hasta)}`
                  : "—"
              }
              style={{ minWidth: "12rem" }}
            />
            <Column
              header="Estado"
              body={(carga: CargaHistorial) => (
                <EstadoCarga estado={carga.estado} />
              )}
            />
          </DataTable>
        )}
      </Card>
    </div>
  );
}
