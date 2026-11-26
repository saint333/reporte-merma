import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

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
import { CLASE_ETIQUETA, CLASE_INPUT } from "../components/ui/estilos";
import { Skeleton } from "../components/ui/Skeleton";
import {
  actualizarRegistro,
  guardarTokenAdmin,
  leerTokenAdmin,
} from "../lib/api";
import { dateLabel, decimal, money4 } from "../lib/formatters";
import { catalogosQuery, registroQuery, saludQuery } from "../lib/queries";
import type { Registro, RegistroEditado } from "../lib/types";

function FormularioEdicion({ registro }: { registro: Registro }) {
  const queryClient = useQueryClient();
  const catalogos = useQuery(catalogosQuery);
  const salud = useQuery(saludQuery);
  const requiereToken = salud.data?.carga_requiere_token ?? false;

  const [valores, setValores] = useState<ValoresRegistro>({
    fecha: registro.fecha,
    codigoMaterial: String(registro.codigo_material),
    cantidad: registro.cantidad,
    motivo: registro.motivo,
  });
  const [token, setToken] = useState(() => leerTokenAdmin());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; codigo?: string } | null>(
    null,
  );
  const [guardado, setGuardado] = useState<RegistroEditado | null>(null);

  function cambiar(parcial: Partial<ValoresRegistro>) {
    setValores((actual) => ({ ...actual, ...parcial }));
    setGuardado(null);
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

    try {
      const actualizado = await actualizarRegistro(
        registro.id,
        {
          fecha: valores.fecha,
          codigo_material: Number(valores.codigoMaterial),
          cantidad: valores.cantidad,
          motivo: valores.motivo,
        },
        requiereToken ? clave : "",
      );

      if (requiereToken) guardarTokenAdmin(clave);
      setGuardado(actualizado);
      await queryClient.invalidateQueries();
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setEnviando(false);
    }
  }

  const codigoHistorial =
    guardado?.registro.codigo_material ?? registro.codigo_material;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card
        title="Datos del evento"
        subtitle={`Evento #${registro.id}. Al guardar se recalculan la semana ISO, el valor unitario y el costo total.`}
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
                <input
                  id="token"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(evento) => setToken(evento.target.value)}
                  placeholder="ADMIN_TOKEN de la API"
                  className={CLASE_INPUT}
                />
                <p className="text-muted mt-1 text-[11px]">
                  Se guarda solo en esta pestaña (sessionStorage); nunca viaja en
                  el bundle.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="border-red/30 bg-red/5 mt-4 rounded-md border p-3"
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

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={enviando || catalogos.isPending}
                className="bg-cyan focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Guardando cambios…" : "Guardar cambios"}
              </button>
              <Link
                to="/registros"
                className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-3 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Cancelar
              </Link>
            </div>
            {enviando && (
              <p className="text-muted mt-2 text-[11px]">
                Recalculando el evento y escribiendo la auditoría en Postgres.
              </p>
            )}
          </form>
        )}
      </Card>

      <div className="space-y-4">
        {guardado ? (
          <Card
            title="Cambios guardados"
            subtitle="El evento quedó actualizado y el antes/después se registró en el historial."
          >
            <div className="grid grid-cols-2 gap-2">
              <Dato
                etiqueta="Fecha"
                valor={dateLabel(guardado.registro.fecha)}
                detalle={`Semana S${guardado.registro.semana_iso}`}
              />
              <Dato
                etiqueta="Costo"
                valor={money4(guardado.registro.costo_total)}
                detalle="costo total"
              />
              <Dato
                etiqueta="Material"
                valor={String(guardado.registro.codigo_material)}
                detalle={guardado.registro.descripcion}
              />
              <Dato
                etiqueta="Cantidad"
                valor={`${decimal(guardado.registro.cantidad, 4)} ${guardado.registro.um}`}
                detalle={guardado.registro.motivo}
              />
            </div>

            {guardado.observaciones.length > 0 && (
              <div className="border-amber/30 bg-amber/5 mt-3 rounded-md border p-3">
                <p className="text-[10px] font-medium tracking-[0.12em] text-amber uppercase">
                  Observaciones
                </p>
                <ul className="mt-1 space-y-1">
                  {guardado.observaciones.map((observacion) => (
                    <li
                      key={observacion.codigo}
                      className="text-[11px] text-amber"
                    >
                      {observacion.mensaje}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ) : (
          <Card title="Registro actual">
            <div className="grid grid-cols-2 gap-2">
              <Dato
                etiqueta="Fecha"
                valor={dateLabel(registro.fecha)}
                detalle={`Semana S${registro.semana_iso}`}
              />
              <Dato
                etiqueta="Costo"
                valor={money4(registro.costo_total)}
                detalle="costo total"
              />
              <Dato
                etiqueta="Cantidad"
                valor={`${decimal(registro.cantidad, 4)} ${registro.um}`}
                detalle={registro.motivo}
              />
              <Dato
                etiqueta="Gestión"
                valor={registro.gestion}
                detalle={registro.area_responsable}
              />
            </div>
          </Card>
        )}

        <Card title="Trazabilidad">
          <ul className="text-muted space-y-2 text-[11px] leading-relaxed">
            <li>
              Cada edición guarda el estado anterior y el nuevo en el historial
              del producto.
            </li>
            <li>
              Si cambias el material, el evento aparece en el historial del
              producto de origen y del destino.
            </li>
            <li>
              Si la combinación de fecha, material, cantidad y motivo ya existe,
              la API rechaza el cambio como duplicado.
            </li>
          </ul>
          <Link
            to={`/productos/${codigoHistorial}`}
            className="text-cyan mt-4 inline-block text-xs font-semibold underline underline-offset-4"
          >
            Ver historial del producto
          </Link>
        </Card>
      </div>

      {catalogos.isPending && catalogos.failureCount > 0 && <ColdStartNotice />}
    </div>
  );
}

export default function EditarRegistroPage() {
  const { id } = useParams();
  const registroId = Number(id);
  const registro = useQuery(registroQuery(registroId));

  if (!Number.isInteger(registroId) || registroId <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Datos"
          titulo="Editar registro"
          descripcion="El identificador del evento no es válido."
        />
        <ErrorState error={new Error("El identificador del evento no es válido.")} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Datos"
        titulo="Editar registro"
        descripcion="Corrige la fecha, el material, la cantidad o el motivo; el costo y la semana se recalculan solos."
        acciones={<Badge tono="cyan">Evento #{registroId}</Badge>}
      />

      {registro.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : registro.error ? (
        <ErrorState
          error={registro.error}
          onRetry={() => void registro.refetch()}
        />
      ) : registro.data ? (
        <FormularioEdicion registro={registro.data} />
      ) : null}
    </div>
  );
}
