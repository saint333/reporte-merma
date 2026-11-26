import { useMemo } from "react";

import { money4 } from "../../lib/formatters";
import type { Catalogos, CatalogoMaterial } from "../../lib/types";
import { CLASE_ETIQUETA, CLASE_INPUT } from "../ui/estilos";

export type ValoresRegistro = {
  fecha: string;
  codigoMaterial: string;
  cantidad: string;
  motivo: string;
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
  const grupos = useMemo(
    () => agruparPorFamilia(catalogos.materiales),
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

  const numeroCantidad = Number(valores.cantidad);
  const costoEstimado =
    material && Number.isFinite(numeroCantidad) && numeroCantidad > 0
      ? (numeroCantidad * Number(material.valor_unitario)).toFixed(4)
      : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fecha" className={CLASE_ETIQUETA}>
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            required
            disabled={deshabilitado}
            value={valores.fecha}
            onChange={(evento) => onCambio({ fecha: evento.target.value })}
            className={CLASE_INPUT}
          />
          <p className="text-muted mt-1 text-[11px]">
            Fuera de la campaña 2026 se guarda con una observación.
          </p>
        </div>

        <div>
          <label htmlFor="cantidad" className={CLASE_ETIQUETA}>
            Cantidad
          </label>
          <input
            id="cantidad"
            type="number"
            required
            disabled={deshabilitado}
            inputMode="decimal"
            min="0.0001"
            step="0.0001"
            value={valores.cantidad}
            onChange={(evento) => onCambio({ cantidad: evento.target.value })}
            placeholder="0.0000"
            className={CLASE_INPUT}
          />
          <p className="text-muted mt-1 text-[11px]">
            {material
              ? `En ${material.um}`
              : "Selecciona el material para ver la unidad."}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="material" className={CLASE_ETIQUETA}>
            Material
          </label>
          <select
            id="material"
            required
            disabled={deshabilitado}
            value={valores.codigoMaterial}
            onChange={(evento) => onCambio({ codigoMaterial: evento.target.value })}
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
          <input
            id="motivo"
            type="text"
            required
            disabled={deshabilitado}
            list="motivos-disponibles"
            autoComplete="off"
            value={valores.motivo}
            onChange={(evento) => onCambio({ motivo: evento.target.value })}
            placeholder="Escribe o elige un motivo del catálogo"
            className={CLASE_INPUT}
          />
          <datalist id="motivos-disponibles">
            {catalogos.motivos.map((fila) => (
              <option key={fila.codigo} value={fila.codigo}>
                {fila.gestionabilidad}
              </option>
            ))}
          </datalist>
          {motivoElegido ? (
            <p className="text-muted mt-1 text-[11px]">
              {motivoElegido.categoria} · {motivoElegido.area_responsable}
            </p>
          ) : valores.motivo.trim() ? (
            <p className="text-muted mt-1 text-[11px]">
              Se resolverá por catálogo o alias; si no existe, se guardará como
              SIN CLASIFICAR con una observación.
            </p>
          ) : (
            <p className="text-muted mt-1 text-[11px]">
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
