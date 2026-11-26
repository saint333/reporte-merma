import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import {
  CamposRegistro,
  type ValoresRegistro,
} from "../components/forms/CamposRegistro";
import { PageHeader } from "../components/layout/PageHeader";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dato } from "../components/ui/Dato";
import { Skeleton } from "primereact/skeleton";
import { actualizarRegistro } from "../lib/api";
import { dateLabel, decimal, money4 } from "../lib/formatters";
import { catalogosQuery, registroQuery } from "../lib/queries";
import type { Registro, RegistroEditado } from "../lib/types";

function FormularioEdicion({ registro }: { registro: Registro }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const catalogos = useQuery(catalogosQuery);

  const [valores, setValores] = useState<ValoresRegistro>({
    fecha: registro.fecha,
    codigoMaterial: String(registro.codigo_material),
    cantidad: registro.cantidad,
    motivo: registro.motivo,
  });
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
      );

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
        subTitle={`Evento #${registro.id}. Al guardar se recalculan la semana ISO, el valor unitario y el costo total.`}
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

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                label={enviando ? "Guardando cambios…" : "Guardar cambios"}
                icon="pi pi-save"
                loading={enviando}
                disabled={enviando || catalogos.isPending}
              />
              <Button
                type="button"
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                onClick={() => navigate("/registros")}
              />
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
            subTitle="El evento quedó actualizado y el antes/después se registró en el historial."
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
              <div className="mt-3 space-y-2">
                {guardado.observaciones.map((observacion) => (
                  <Message
                    key={observacion.codigo}
                    severity="warn"
                    text={observacion.mensaje}
                  />
                ))}
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
        acciones={
          <Tag
            value={`Evento #${registroId}`}
            severity="info"
            className="tag-app"
          />
        }
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
