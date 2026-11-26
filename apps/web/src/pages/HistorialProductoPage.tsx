import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ColdStartNotice } from "../components/feedback/ColdStartNotice";
import { ErrorState } from "../components/feedback/ErrorState";
import { PageHeader } from "../components/layout/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import {
  dateLabel,
  dateTimeLabel,
  decimal,
  integer,
  money4,
} from "../lib/formatters";
import { historialProductoQuery } from "../lib/queries";
import type { CambioHistorial, SnapshotRegistro } from "../lib/types";

type ClaveDiff =
  | "fecha"
  | "material"
  | "cantidad"
  | "motivo"
  | "costo_total";

const CAMPOS_DIFF: { clave: ClaveDiff; etiqueta: string }[] = [
  { clave: "fecha", etiqueta: "Fecha" },
  { clave: "material", etiqueta: "Material" },
  { clave: "cantidad", etiqueta: "Cantidad" },
  { clave: "motivo", etiqueta: "Motivo" },
  { clave: "costo_total", etiqueta: "Costo" },
];

const TONOS = {
  crear: "cyan",
  editar: "media",
  eliminar: "alta",
} as const;

function valorCampo(
  clave: ClaveDiff,
  snapshot: SnapshotRegistro,
): string {
  switch (clave) {
    case "fecha":
      return dateLabel(snapshot.fecha);
    case "material":
      return `${snapshot.codigo_material} · ${snapshot.descripcion}`;
    case "cantidad":
      return `${decimal(snapshot.cantidad, 4)} ${snapshot.um}`;
    case "motivo":
      return snapshot.motivo;
    case "costo_total":
      return money4(snapshot.costo_total);
  }
}

function Cambio({ cambio }: { cambio: CambioHistorial }) {
  const antes = cambio.datos_anteriores;
  const despues = cambio.datos_nuevos;

  return (
    <li className="border-border bg-header/30 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tono={TONOS[cambio.accion]}>{cambio.accion}</Badge>
          <span className="text-muted font-mono text-[10px]">
            evento #{cambio.fact_id}
          </span>
        </div>
        <time
          dateTime={cambio.cambiado_en}
          className="text-muted text-[11px] whitespace-nowrap"
        >
          {dateTimeLabel(cambio.cambiado_en)}
        </time>
      </div>

      {cambio.accion === "crear" && despues && (
        <p className="text-ink mt-2 text-[11px] leading-relaxed">
          {dateLabel(despues.fecha)} · {decimal(despues.cantidad, 4)}{" "}
          {despues.um} de {despues.descripcion} por {despues.motivo} ·{" "}
          <span className="font-semibold">{money4(despues.costo_total)}</span>
        </p>
      )}

      {cambio.accion === "eliminar" && antes && (
        <p className="mt-2 text-[11px] leading-relaxed text-red-300">
          Eliminado: {dateLabel(antes.fecha)} · {decimal(antes.cantidad, 4)}{" "}
          {antes.um} de {antes.descripcion} por {antes.motivo} ·{" "}
          {money4(antes.costo_total)}
        </p>
      )}

      {cambio.accion === "editar" && antes && despues && (
        <ul className="mt-2 space-y-1">
          {CAMPOS_DIFF.map(({ clave, etiqueta }) => {
            const anterior = valorCampo(clave, antes);
            const nuevo = valorCampo(clave, despues);
            if (anterior === nuevo) return null;

            return (
              <li key={clave} className="text-muted text-[11px]">
                <span className="text-ink font-medium">{etiqueta}:</span>{" "}
                <span className="text-red-300 line-through decoration-red-300/50">
                  {anterior}
                </span>{" "}
                → <span className="text-green">{nuevo}</span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function HistorialProductoPage() {
  const { codigo } = useParams();
  const codigoProducto = Number(codigo);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [codigoProducto]);

  const historial = useQuery(historialProductoQuery(codigoProducto, page));

  if (!Number.isInteger(codigoProducto) || codigoProducto <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Historial"
          titulo="Historial del producto"
          descripcion="El código del producto no es válido."
        />
        <ErrorState error={new Error("El código del producto no es válido.")} />
      </div>
    );
  }

  const material = historial.data?.meta.material;
  const total = historial.data?.page.total ?? 0;
  const paginas = historial.data?.page.pages ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Historial"
        titulo={material?.descripcion ?? "Historial del producto"}
        descripcion={
          material
            ? `SKU ${material.codigo} · ${material.familia} · ${material.programa} · ${material.um}`
            : "Altas, ediciones y eliminaciones de cada evento del producto."
        }
        acciones={
          <>
            <Badge tono="cyan">{integer(total)} cambios</Badge>
            <Link
              to={`/registros?q=${codigoProducto}`}
              className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Ver registros
            </Link>
          </>
        }
      />

      {historial.isPending && historial.failureCount > 0 && <ColdStartNotice />}

      <Card
        title="Cambios registrados"
        subtitle="De la más reciente a la más antigua. Los eventos cargados desde el Excel aparecen con su alta inicial."
        action={
          historial.data ? (
            <span className="text-muted text-[11px]">
              Página {page} de {Math.max(1, paginas)}
            </span>
          ) : undefined
        }
      >
        {historial.isPending ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((indice) => (
              <Skeleton key={indice} className="h-20 w-full" />
            ))}
          </div>
        ) : historial.error ? (
          <ErrorState
            error={historial.error}
            onRetry={() => void historial.refetch()}
            compact
          />
        ) : !historial.data?.data.length ? (
          <p className="text-muted text-xs">
            Este producto todavía no tiene cambios registrados.
          </p>
        ) : (
          <ul className="space-y-2">
            {historial.data.data.map((cambio) => (
              <Cambio key={cambio.id} cambio={cambio} />
            ))}
          </ul>
        )}

        {historial.data && total > 0 && (
          <div className="border-border mt-4 flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-muted text-[11px]">
              {integer(total)} cambios registrados
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((actual) => Math.max(1, actual - 1))}
                disabled={page <= 1}
                className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((actual) => actual + 1)}
                disabled={page >= paginas}
                className="border-border text-ink hover:border-cyan/50 focus-visible:ring-cyan focus-visible:ring-offset-page rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
