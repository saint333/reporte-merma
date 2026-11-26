import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { Password } from "primereact/password";
import { Link } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import {
  CamposRegistro,
  type ValoresRegistro,
} from "../components/forms/CamposRegistro";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Dato } from "../components/ui/Dato";
import { CLASE_ETIQUETA } from "../components/ui/estilos";
import { Skeleton } from "../components/ui/Skeleton";
import {
  crearRegistroManual,
  guardarTokenAdmin,
  leerTokenAdmin,
} from "../lib/api";
import { hoyLima } from "../lib/fechas";
import { dateLabel, decimal, money4 } from "../lib/formatters";
import { catalogosQuery, saludQuery } from "../lib/queries";
import type { RegistroManualCreado } from "../lib/types";

export default function NuevoRegistroPage() {
  const queryClient = useQueryClient();
  const catalogos = useQuery(catalogosQuery);
  const salud = useQuery(saludQuery);
  const requiereToken = salud.data?.carga_requiere_token ?? false;

  const [valores, setValores] = useState<ValoresRegistro>({
    fecha: hoyLima(),
    codigoMaterial: "",
    cantidad: "",
    motivo: "",
  });
  const [token, setToken] = useState(() => leerTokenAdmin());
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

    const clave = token.trim();
    if (requiereToken && clave.length < 16) {
      setError({
        mensaje:
          "La clave de administración debe tener al menos 16 caracteres (ADMIN_TOKEN de la API).",
      });
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
        requiereToken ? clave : "",
      );

      if (requiereToken) guardarTokenAdmin(clave);
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
        acciones={
          requiereToken ? (
            <Badge tono="media">Requiere clave de administración</Badge>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Datos del evento"
          subtitle="El material sale del maestro; el motivo se elige del catálogo o se escribe tal como llega, y se resuelve como en el Excel."
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
                valores={valores}
                onCambio={cambiar}
                deshabilitado={enviando}
              />

              {requiereToken && (
                <div className="mt-4">
                  <label htmlFor="token" className={CLASE_ETIQUETA}>
                    Clave de administración
                  </label>
                  <Password
                    inputId="token"
                    value={token}
                    onChange={(evento) => setToken(evento.target.value)}
                    placeholder="ADMIN_TOKEN de la API"
                    feedback={false}
                    toggleMask
                    className="mt-1 w-full"
                    inputClassName="w-full"
                  />
                  <p className="text-muted mt-1 text-[11px]">
                    Se guarda solo en esta pestaña (sessionStorage); nunca viaja
                    en el bundle.
                  </p>
                </div>
              )}

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
              subtitle="Ya forma parte del detalle, los KPIs y las gráficas del dashboard."
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
                  to="/registros"
                  className="text-cyan text-xs font-semibold underline underline-offset-4"
                >
                  Ver el detalle de registros
                </Link>
              </div>
            </Card>
          ) : (
            <Card title="Qué se guarda">
              <ul className="text-muted space-y-2 text-[11px] leading-relaxed">
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
            </Card>
          )}
        </div>
      </div>

      {catalogos.isPending && catalogos.failureCount > 0 && <ColdStartNotice />}
    </div>
  );
}
