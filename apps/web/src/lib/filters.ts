import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import type { Filtros } from "./types";

export const CAMPANIA = {
  id: "campania-28s",
  desde: "2026-05-08",
  hasta: "2026-11-11",
} as const;

const DIMENSIONES = ["mes", "programa", "familia", "gestion"] as const;
export type Dimension = (typeof DIMENSIONES)[number];

export function useFiltros() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filtros: Filtros = {
    desde: searchParams.get("desde") ?? CAMPANIA.desde,
    hasta: searchParams.get("hasta") ?? CAMPANIA.hasta,
    mes: searchParams.get("mes") ?? undefined,
    programa: searchParams.get("programa") ?? undefined,
    familia: searchParams.get("familia") ?? undefined,
    gestion: searchParams.get("gestion") ?? undefined,
  };

  useEffect(() => {
    if (searchParams.has("desde") && searchParams.has("hasta")) return;

    const siguiente = new URLSearchParams(searchParams);
    siguiente.set("desde", filtros.desde);
    siguiente.set("hasta", filtros.hasta);
    setSearchParams(siguiente, { replace: true });
  }, [searchParams, setSearchParams, filtros.desde, filtros.hasta]);

  function actualizar(mutacion: (siguiente: URLSearchParams) => void) {
    const siguiente = new URLSearchParams(searchParams);
    mutacion(siguiente);
    setSearchParams(siguiente);
  }

  function setFiltro(dimension: Dimension, valor: string) {
    actualizar((siguiente) => {
      siguiente.delete("page");
      if (valor) siguiente.set(dimension, valor);
      else siguiente.delete(dimension);
    });
  }

  function aplicarVista(desde: string, hasta: string) {
    actualizar((siguiente) => {
      siguiente.set("desde", desde);
      siguiente.set("hasta", hasta);
      siguiente.delete("page");
    });
  }

  function limpiar() {
    actualizar((siguiente) => {
      for (const dimension of DIMENSIONES) siguiente.delete(dimension);
      siguiente.delete("page");
    });
  }

  const hayFiltros = DIMENSIONES.some((dimension) => Boolean(filtros[dimension]));

  return {
    filtros,
    setFiltro,
    aplicarVista,
    limpiar,
    hayFiltros,
  };
}

export function paramsFiltros(filtros: Filtros): Record<string, string> {
  return {
    desde: filtros.desde,
    hasta: filtros.hasta,
    mes: filtros.mes ?? "",
    programa: filtros.programa ?? "",
    familia: filtros.familia ?? "",
    gestion: filtros.gestion ?? "",
  };
}
