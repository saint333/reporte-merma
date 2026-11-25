import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState, mensajeDeError } from "../components/feedback/ErrorState";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import {
  crearRegistroManual,
  guardarTokenAdmin,
  leerTokenAdmin,
} from "../lib/api";
import { dateLabel, decimal, money4 } from "../lib/formatters";
import { catalogosQuery, saludQuery } from "../lib/queries";
import type { CatalogoMaterial, RegistroManualCreado } from "../lib/types";

const CAMPANA_DESDE = "2026-01-01";

function hoyLima(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
  }).format(new Date());
}

function agruparPorFamilia(
  materiales: CatalogoMaterial[],
): [string, CatalogoMaterial[]][] {
  const grupos = new Map<string, CatalogoMaterial[]>();

  for (const material of materiales) {
    const grupo = grupos.get(material.familia) ?? [];
    grupo.push(material);
    grupos.set(material.familia, grupo);
  }

  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const CLASE_INPUT =
  "border-border bg-header text-ink placeholder:text-muted/70 focus-visible:ring-cyan focus-visible:ring-offset-page mt-1 w-full rounded-md border px-3 py-2 text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

const CLASE_ETIQUETA =
  "text-muted text-[10px] font-medium tracking-[0.12em] uppercase";

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

export default function NuevoRegistroPage() {
  const queryClient = useQueryClient();
  const catalogos = useQuery(catalogosQuery);
  const salud = useQuery(saludQuery);
  const requiereToken = salud.data?.carga_requiere_token ?? false;

  const [fecha, setFecha] = useState(hoyLima);
  const [codigo, setCodigo] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [token, setToken] = useState(() => leerTokenAdmin());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; codigo?: string } | null>(
    null,
  );
  const [creado, setCreado] = useState<RegistroManualCreado | null>(null);

  const grupos = useMemo(
    () => agruparPorFamilia(catalogos.data?.materiales ?? []),
    [catalogos.data],
  );
  const material =
    catalogos.data?.materiales.find((fila) => fila.codigo === Number(codigo)) ??
    null;
  const motivoElegido =
    catalogos.data?.motivos.find((fila) => fila.codigo === motivo) ?? null;

  const numeroCantidad = Number(cantidad);
  const costoEstimado =
    material && Number.isFinite(numeroCantidad) && numeroCantidad > 0
      ? (numeroCantidad * Number(material.valor_unitario)).toFixed(4)
      : null;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!fecha) {
      setError({ mensaje: "Selecciona la fecha del evento." });
      return;
    }
    if (!codigo) {
      setError({ mensaje: "Selecciona el material del maestro." });
      return;
    }
    if (!Number.isFinite(numeroCantidad) || numeroCantidad <= 0) {
      setError({ mensaje: "La cantidad debe ser un número mayor que cero." });
      return;
    }
    if (!motivo) {
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
          fecha,
          codigo_material: Number(codigo),
          cantidad,
          motivo,
        },
        requiereToken ? clave : "",
      );

      if (requiereToken) guardarTokenAdmin(clave);
      setCreado(resultado);
      setCantidad("");
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
          subtitle="El material y el motivo salen del maestro y del catálogo vigentes; no se puede escribir un código libre."
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fecha" className={CLASE_ETIQUETA}>
                    Fecha
                  </label>
                  <input
                    id="fecha"
                    type="date"
                    required
                    min={CAMPANA_DESDE}
                    max={hoyLima()}
                    value={fecha}
                    onChange={(evento) => {
                      setFecha(evento.target.value);
                      setCreado(null);
                    }}
                    className={CLASE_INPUT}
                  />
                </div>

                <div>
                  <label htmlFor="cantidad" className={CLASE_ETIQUETA}>
                    Cantidad
                  </label>
                  <input
                    id="cantidad"
                    type="number"
                    required
                    inputMode="decimal"
                    min="0.0001"
                    step="0.0001"
                    value={cantidad}
                    onChange={(evento) => {
                      setCantidad(evento.target.value);
                      setCreado(null);
                    }}
                    placeholder="0.0000"
                    className={CLASE_INPUT}
                  />
                  <p className="text-muted mt-1 text-[11px]">
                    {material ? `En ${material.um}` : "Selecciona el material para ver la unidad."}
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="material" className={CLASE_ETIQUETA}>
                    Material
                  </label>
                  <select
                    id="material"
                    required
                    value={codigo}
                    onChange={(evento) => {
                      setCodigo(evento.target.value);
                      setCreado(null);
                    }}
                    className={CLASE_INPUT}
                  >
                    <option value="">Selecciona un material…</option>
                    {grupos.map(([familia, materiales]) => (
                      <optgroup key={familia} label={familia}>
                        {materiales.map((fila) => (
                          <option key={fila.codigo} value={fila.codigo}>
                            {fila.codigo} · {fila.descripcion}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {material && (
                    <p className="text-muted mt-1 text-[11px]">
                      {material.familia} · {material.programa} · valor unitario{" "}
                      {money4(material.valor_unitario)}
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="motivo" className={CLASE_ETIQUETA}>
                    Motivo
                  </label>
                  <select
                    id="motivo"
                    required
                    value={motivo}
                    onChange={(evento) => {
                      setMotivo(evento.target.value);
                      setCreado(null);
                    }}
                    className={CLASE_INPUT}
                  >
                    <option value="">Selecciona un motivo…</option>
                    {catalogos.data?.motivos.map((fila) => (
                      <option key={fila.codigo} value={fila.codigo}>
                        {fila.codigo} · {fila.gestionabilidad}
                      </option>
                    ))}
                  </select>
                  {motivoElegido && (
                    <p className="text-muted mt-1 text-[11px]">
                      {motivoElegido.categoria} · {motivoElegido.area_responsable}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-border bg-header/40 mt-4 rounded-md border p-3">
                <p className="text-muted text-[10px] font-medium tracking-[0.12em] uppercase">
                  Costo estimado
                </p>
                <p className="text-ink mt-1 text-lg font-semibold tabular-nums">
                  {costoEstimado ? money4(costoEstimado) : "—"}
                </p>
                <p className="text-muted mt-0.5 text-[11px]">
                  Cantidad × valor unitario del maestro, redondeado a 4 decimales
                  igual que el ETL.
                </p>
              </div>

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
                    Se guarda solo en esta pestaña (sessionStorage); nunca viaja
                    en el bundle.
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

              <button
                type="submit"
                disabled={enviando || catalogos.isPending}
                className="bg-cyan focus-visible:ring-cyan focus-visible:ring-offset-page mt-4 rounded-md px-4 py-2 text-xs font-bold text-slate-900 transition hover:bg-cyan/90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? "Guardando registro…" : "Guardar registro"}
              </button>
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

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCreado(null)}
                  className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-3 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Registrar otro
                </button>
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
                  Cada alta queda en{" "}
                  <span className="font-mono text-[10px]">merma.carga</span> como
                  “Registro manual” para conservar la trazabilidad.
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
