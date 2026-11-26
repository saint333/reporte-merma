import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { Link } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import {
  CamposRegistro,
  type ValoresRegistro,
} from "../components/forms/CamposRegistro";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "primereact/card";
import { Dato } from "../components/ui/Dato";
import { Skeleton } from "primereact/skeleton";
import { crearRegistroManual } from "../lib/api";
import { hoyLima } from "../lib/fechas";
import { dateLabel, decimal, money4 } from "../lib/formatters";
import {
  catalogosQuery,
  corteQuery,
  registrosQuery,
} from "../lib/queries";
import type { RegistroManualCreado } from "../lib/types";

export default function NuevoRegistroPage() {
  const queryClient = useQueryClient();
  const catalogos = useQuery(catalogosQuery);
  const hoy = hoyLima();
  const inicioMes = `${hoy.slice(0, 7)}-01`;
  const motivosMes = useQuery(
    corteQuery("motivos", { desde: inicioMes, hasta: hoy }),
  );
  // El corte viene ordenado por costo descendente (API); los motivos del mes
  // con más merma aparecen primero en el desplegable.
  const ordenMotivos = useMemo(
    () => (motivosMes.data?.data ?? []).map((fila) => fila.clave),
    [motivosMes.data],
  );
  const registrosHoy = useQuery(
    registrosQuery({
      desde: hoy,
      hasta: hoy,
      page: 1,
      per_page: 5,
      sort: "fecha",
      order: "desc",
    }),
  );

  const [valores, setValores] = useState<ValoresRegistro>({
    fecha: hoyLima(),
    codigoMaterial: "",
    cantidad: "",
    motivo: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; codigo?: string } | null>(
    null,
  );
  const [creado, setCreado] = useState<RegistroManualCreado | null>(null);

  function cambiar(parcial: Partial<ValoresRegistro>) {
    setValores((actual) => ({ ...actual, ...parcial }));
    setCreado(null);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!valores.fecha) {
      setError({ mensaje: "Selecciona la fecha del evento." });
      return;
    }
    if (!valores.codigoMaterial) {
      setError({ mensaje: "Selecciona el material del maestro." });
      return;
    }
    const numeroCantidad = Number(valores.cantidad);
    if (!Number.isFinite(numeroCantidad) || numeroCantidad <= 0) {
      setError({ mensaje: "La cantidad debe ser un número mayor que cero." });
      return;
    }
    if (!valores.motivo) {
      setError({ mensaje: "Selecciona el motivo de la merma." });
      return;
    }

    setEnviando(true);
    setError(null);
    setCreado(null);

    try {
      const resultado = await crearRegistroManual(
        {
          fecha: valores.fecha,
          codigo_material: Number(valores.codigoMaterial),
          cantidad: valores.cantidad,
          motivo: valores.motivo,
        },
      );

      setCreado(resultado);
      setValores((actual) => ({ ...actual, cantidad: "" }));
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
        titulo="Nuevo registro"
        descripcion="Agrega un evento de merma que no viene en el Excel: el sistema calcula semana, valor unitario y costo con las mismas reglas de la carga."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Datos del evento"
          subTitle="El material sale del maestro; el motivo se elige del catálogo o se escribe tal como llega, y se resuelve como en el Excel."
        >
          {catalogos.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((indice) => (
                <Skeleton key={indice} className="h-14 w-full" />
              ))}
            </div>
          ) : catalogos.error ? (
            <ErrorState
              error={catalogos.error}
              onRetry={() => void catalogos.refetch()}
              compact
            />
          ) : (
            <form onSubmit={(evento) => void enviar(evento)}>
              <CamposRegistro
                catalogos={catalogos.data}
                ordenMotivos={ordenMotivos}
                valores={valores}
                onCambio={cambiar}
                deshabilitado={enviando}
              />

              {error && (
                <Message
                  severity="error"
                  className="mt-4"
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
                label={enviando ? "Guardando registro…" : "Guardar registro"}
                icon="pi pi-save"
                loading={enviando}
                disabled={enviando || catalogos.isPending}
                className="mt-4"
              />
              {enviando && (
                <p className="text-muted mt-2 text-[11px]">
                  Validando contra el catálogo y escribiendo en Postgres.
                </p>
              )}
            </form>
          )}
        </Card>

        <div className="space-y-4">
          {creado ? (
            <Card
              title="Registro guardado"
              subTitle="Ya forma parte del detalle, los KPIs y las gráficas del dashboard."
            >
              <div className="grid grid-cols-2 gap-2">
                <Dato
                  etiqueta="Fecha"
                  valor={dateLabel(creado.registro.fecha)}
                  detalle={`Semana S${creado.registro.semana_iso}`}
                />
                <Dato
                  etiqueta="Costo"
                  valor={money4(creado.registro.costo_total)}
                  detalle="costo total"
                />
                <Dato
                  etiqueta="Material"
                  valor={String(creado.registro.codigo_material)}
                  detalle={creado.registro.descripcion}
                />
                <Dato
                  etiqueta="Cantidad"
                  valor={`${decimal(creado.registro.cantidad, 4)} ${creado.registro.um}`}
                  detalle={creado.registro.motivo}
                />
              </div>

              {creado.observaciones.length > 0 && (
                <div className="mt-3 space-y-2">
                  {creado.observaciones.map((observacion) => (
                    <Message
                      key={observacion.codigo}
                      severity="warn"
                      text={observacion.mensaje}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  label="Registrar otro"
                  icon="pi pi-plus"
                  severity="secondary"
                  outlined
                  size="small"
                  onClick={() => setCreado(null)}
                />
                <Link
                  to={`/registros?desde=${creado.registro.fecha}&hasta=${creado.registro.fecha}&q=${creado.registro.codigo_material}`}
                  className="text-cyan text-xs font-semibold underline underline-offset-4"
                >
                  Ver este registro en Registros
                </Link>
              </div>
            </Card>
          ) : (
            <>
            <Card
              title="Hoy"
              subTitle={`Registros cargados el ${dateLabel(hoy)}`}
            >
              {registrosHoy.isPending ? (
                <Skeleton className="h-20 w-full" />
              ) : registrosHoy.error ? (
                <ErrorState
                  error={registrosHoy.error}
                  onRetry={() => void registrosHoy.refetch()}
                  compact
                />
              ) : registrosHoy.data.data.length === 0 ? (
                <p className="text-muted text-[12px]">
                  Aún no hay registros para hoy.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Dato
                      etiqueta="Eventos"
                      valor={String(registrosHoy.data.page.total)}
                    />
                    <Dato
                      etiqueta="Últimos"
                      valor={String(registrosHoy.data.data.length)}
                      detalle="mostrados abajo"
                    />
                  </div>
                  <ul className="space-y-1 text-[12px]">
                    {registrosHoy.data.data.map((registro) => (
                      <li
                        key={registro.id}
                        className="flex justify-between gap-2"
                      >
                        <span className="truncate">{registro.descripcion}</span>
                        <span className="text-muted shrink-0">
                          {money4(registro.costo_total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
            <Card title="Qué se guarda">
              <details className="group">
                <summary className="text-cyan cursor-pointer text-[11px] font-semibold underline underline-offset-4">
                  Ver detalles técnicos
                </summary>
              <ul className="text-muted mt-3 space-y-2 text-[11px] leading-relaxed">
                <li>
                  La semana ISO y el mes se calculan desde la fecha, igual que en
                  la carga del Excel.
                </li>
                <li>
                  El valor unitario se toma del maestro de materiales; no se
                  digita a mano.
                </li>
                <li>
                  El motivo se resuelve igual que en el Excel: catálogo, alias o
                  SIN CLASIFICAR. Las observaciones se muestran al guardar.
                </li>
                <li>
                  Cada alta queda en{" "}
                  <span className="font-mono text-[10px]">merma.carga</span> como
                  “Registro manual” y en el historial del producto.
                </li>
                <li>
                  Si ya existe un evento con la misma fecha, material, cantidad y
                  motivo, la API lo rechaza como duplicado.
                </li>
                <li>
                  Al guardar se invalida la caché de KPIs, series, cortes y
                  Pareto.
                </li>
              </ul>
              </details>
            </Card>
            </>
          )}
        </div>
      </div>

      {catalogos.isPending && catalogos.failureCount > 0 && <ColdStartNotice />}
    </div>
  );
}
