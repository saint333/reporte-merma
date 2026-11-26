import { useMemo, useState } from "react";
import { AutoComplete } from "primereact/autocomplete";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";

import { money4 } from "../../lib/formatters";
import type { Catalogos, CatalogoMaterial } from "../../lib/types";
import { CLASE_ETIQUETA } from "../ui/estilos";

export type ValoresRegistro = {
  fecha: string;
  codigoMaterial: string;
  cantidad: string;
  motivo: string;
};

type GrupoMaterial = {
  label: string;
  items: { label: string; value: string }[];
};

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

function aFecha(iso: string): Date | null {
  if (!iso) return null;

  const [anio = 0, mes = 0, dia = 0] = iso.split("-").map(Number);
  if (!anio || !mes || !dia) return null;

  return new Date(anio, mes - 1, dia);
}

function aISO(fecha: Date | null): string {
  if (!fecha) return "";

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

export function CamposRegistro({
  catalogos,
  valores,
  onCambio,
  deshabilitado = false,
}: {
  catalogos: Catalogos;
  valores: ValoresRegistro;
  onCambio: (parcial: Partial<ValoresRegistro>) => void;
  deshabilitado?: boolean;
}) {
  const [sugerenciasMotivo, setSugerenciasMotivo] = useState<string[]>([]);

  const opcionesMaterial = useMemo<GrupoMaterial[]>(
    () =>
      agruparPorFamilia(catalogos.materiales).map(([familia, materiales]) => ({
        label: familia,
        items: materiales.map((fila) => ({
          label: `${fila.codigo} · ${fila.descripcion}`,
          value: String(fila.codigo),
        })),
      })),
    [catalogos.materiales],
  );

  const material =
    catalogos.materiales.find(
      (fila) => fila.codigo === Number(valores.codigoMaterial),
    ) ?? null;
  const motivoElegido =
    catalogos.motivos.find(
      (fila) => fila.codigo === valores.motivo.trim().toUpperCase(),
    ) ?? null;

  const cantidadNumero =
    valores.cantidad.trim() && Number.isFinite(Number(valores.cantidad))
      ? Number(valores.cantidad)
      : null;
  const costoEstimado =
    material && cantidadNumero !== null && cantidadNumero > 0
      ? (cantidadNumero * Number(material.valor_unitario)).toFixed(4)
      : null;

  function buscarMotivos(evento: { query: string }) {
    const consulta = evento.query.trim().toUpperCase();

    setSugerenciasMotivo(
      catalogos.motivos
        .map((fila) => fila.codigo)
        .filter((codigo) => !consulta || codigo.includes(consulta))
        .slice(0, 12),
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha" className={CLASE_ETIQUETA}>
            Fecha
          </label>
          <Calendar
            inputId="fecha"
            aria-describedby="ayuda-fecha"
            value={aFecha(valores.fecha)}
            onChange={(evento) =>
              onCambio({
                fecha: aISO((evento.value as Date | null) ?? null),
              })
            }
            dateFormat="dd/mm/yy"
            showIcon
            disabled={deshabilitado}
            placeholder="dd/mm/aaaa"
            className="mt-1 w-full"
            inputClassName="w-full"
          />
          <p id="ayuda-fecha" className="text-muted mt-1 text-[11px]"> se guarda con una observación.
          </p>
        </div>

        <div>
          <label htmlFor="cantidad" className={CLASE_ETIQUETA}>
            Cantidad
          </label>
          <InputNumber
            inputId="cantidad"
            aria-describedby="ayuda-cantidad"
            value={cantidadNumero}
            onValueChange={(evento) =>
              onCambio({
                cantidad: evento.value !== null ? String(evento.value) : "",
              })
            }
            mode="decimal"
            min={0.0001}
            step={0.0001}
            maxFractionDigits={4}
            useGrouping={false}
            disabled={deshabilitado}
            placeholder="0.0000"
            className="mt-1 w-full"
            inputClassName="w-full"
          />
          <p id="ayuda-cantidad" className="text-muted mt-1 text-[11px]">
            {material
              ? `En ${material.um}`
              : "Selecciona el material para ver la unidad."}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="material" className={CLASE_ETIQUETA}>
            Material
          </label>
          <Dropdown
            inputId="material"
            aria-describedby="ayuda-material"
            value={valores.codigoMaterial}
            options={opcionesMaterial}
            optionGroupLabel="label"
            optionGroupChildren="items"
            optionLabel="label"
            optionValue="value"
            onChange={(evento) =>
              onCambio({ codigoMaterial: evento.value ?? "" })
            }
            filter
            showClear
            disabled={deshabilitado}
            placeholder="Selecciona un material…"
            className="mt-1 w-full"
          />
          {material && (
            <p id="ayuda-material" className="text-muted mt-1 text-[11px]"> · {material.programa} · valor unitario{" "}
              {money4(material.valor_unitario)}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="motivo" className={CLASE_ETIQUETA}>
            Motivo
          </label>
          <AutoComplete
            inputId="motivo"
            aria-describedby="ayuda-motivo"
            value={valores.motivo}
            suggestions={sugerenciasMotivo}
            completeMethod={buscarMotivos}
            onChange={(evento) =>
              onCambio({
                motivo: typeof evento.value === "string" ? evento.value : "",
              })
            }
            onFocus={() => buscarMotivos({ query: "" })}
            dropdown
            forceSelection={false}
            disabled={deshabilitado}
            placeholder="Escribe o elige un motivo del catálogo"
            className="mt-1 w-full"
            inputClassName="w-full"
          />
          {motivoElegido ? (
            <p id="ayuda-motivo" className="text-muted mt-1 text-[11px]">
              {motivoElegido.categoria} · {motivoElegido.area_responsable}
            </p>
          ) : valores.motivo.trim() ? (
            <p id="ayuda-motivo" className="text-muted mt-1 text-[11px]">
              Se resolverá por catálogo o alias; si no existe, se guardará como
              SIN CLASIFICAR con una observación.
            </p>
          ) : (
            <p id="ayuda-motivo" className="text-muted mt-1 text-[11px]">
              Elige un motivo del catálogo o escríbelo tal como llega.
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
          Cantidad × valor unitario del maestro, redondeado a 4 decimales igual
          que el ETL.
        </p>
      </div>
    </>
  );
}
