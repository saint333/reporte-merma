import { queryOptions } from "@tanstack/react-query";

import { getJson } from "./api";
import { paramsFiltros } from "./filters";
import type {
  Alerta,
  Envelope,
  FilaCorte,
  FilaPareto,
  Filtros,
  Kpis,
  MetaData,
  Pagina,
  Proyeccion,
  Registro,
  ResumenPareto,
  ResumenSemanal,
  Salud,
  SerieMensual,
  SerieSemanal,
} from "./types";

const COMUN = {
  staleTime: 60_000,
  retry: 2,
  refetchOnWindowFocus: false,
} as const;

type Total = { eventos: number; costo: string };

export type RespuestaMensual = Envelope<SerieMensual[]> & {
  meta: { total: Total };
};

export type RespuestaSemanal = Envelope<SerieSemanal[]> & {
  resumen: ResumenSemanal;
  meta: { total: Total };
};

export type RespuestaCorte = {
  data: FilaCorte[];
  total: Total;
};

export type RespuestaPareto = {
  data: FilaPareto[];
  resumen: ResumenPareto;
};

export type RespuestaRegistros = {
  data: Registro[];
  page: Pagina;
};

export type QueryRegistros = Filtros & {
  page: number;
  per_page: number;
  sort: "fecha" | "costo_total" | "cantidad" | "semana_iso";
  order: "asc" | "desc";
  q?: string;
  motivo?: string;
  codigo?: string;
};

export const saludQuery = queryOptions({
  queryKey: ["salud"],
  queryFn: ({ signal }) => getJson<Salud>("/api/v1/salud", {}, signal),
  ...COMUN,
});

export const metaQuery = queryOptions({
  queryKey: ["meta"],
  queryFn: ({ signal }) =>
    getJson<Envelope<MetaData>>("/api/v1/meta", {}, signal).then(
      (respuesta) => respuesta.data,
    ),
  ...COMUN,
});

export function kpisQuery(filtros: Filtros) {
  return queryOptions({
    queryKey: ["kpis", filtros],
    queryFn: ({ signal }) =>
      getJson<Envelope<Kpis>>(
        "/api/v1/kpis",
        paramsFiltros(filtros),
        signal,
      ).then((respuesta) => respuesta.data),
    ...COMUN,
  });
}

export function serieMensualQuery(filtros: Filtros) {
  return queryOptions({
    queryKey: ["serie-mensual", filtros],
    queryFn: ({ signal }) =>
      getJson<RespuestaMensual>(
        "/api/v1/series/mensual",
        paramsFiltros(filtros),
        signal,
      ),
    ...COMUN,
  });
}

export function serieSemanalQuery(filtros: Filtros) {
  return queryOptions({
    queryKey: ["serie-semanal", filtros],
    queryFn: ({ signal }) =>
      getJson<RespuestaSemanal>(
        "/api/v1/series/semanal",
        paramsFiltros(filtros),
        signal,
      ),
    ...COMUN,
  });
}

export function corteQuery(
  dimension: "motivos" | "familias" | "programas" | "gestion",
  filtros: Filtros,
) {
  return queryOptions({
    queryKey: ["corte", dimension, filtros],
    queryFn: ({ signal }) =>
      getJson<RespuestaCorte>(
        `/api/v1/cortes/${dimension}`,
        paramsFiltros(filtros),
        signal,
      ),
    ...COMUN,
  });
}

export function paretoQuery(filtros: Filtros, limite = 15) {
  return queryOptions({
    queryKey: ["pareto", filtros, limite],
    queryFn: ({ signal }) =>
      getJson<RespuestaPareto>(
        "/api/v1/pareto",
        { ...paramsFiltros(filtros), limite },
        signal,
      ),
    ...COMUN,
  });
}

export function proyeccionQuery(filtros: Filtros) {
  return queryOptions({
    queryKey: ["proyeccion", filtros],
    queryFn: ({ signal }) =>
      getJson<Envelope<Proyeccion>>(
        "/api/v1/proyeccion",
        paramsFiltros(filtros),
        signal,
      ).then((respuesta) => respuesta.data),
    ...COMUN,
  });
}

export function alertasQuery(filtros: Filtros) {
  return queryOptions({
    queryKey: ["alertas", filtros],
    queryFn: ({ signal }) =>
      getJson<Envelope<Alerta[]>>(
        "/api/v1/alertas",
        paramsFiltros(filtros),
        signal,
      ).then((respuesta) => respuesta.data),
    ...COMUN,
  });
}

export function registrosQuery(query: QueryRegistros) {
  return queryOptions({
    queryKey: ["registros", query],
    queryFn: ({ signal }) =>
      getJson<RespuestaRegistros>(
        "/api/v1/registros",
        {
          ...paramsFiltros(query),
          page: query.page,
          per_page: query.per_page,
          sort: query.sort,
          order: query.order,
          q: query.q ?? "",
          motivo: query.motivo ?? "",
          codigo: query.codigo ?? "",
        },
        signal,
      ),
    ...COMUN,
  });
}

export function registrosSkuQuery(
  filtros: Filtros,
  codigo: number | null,
) {
  return queryOptions({
    queryKey: ["registros-sku", filtros, codigo],
    queryFn: ({ signal }) =>
      getJson<RespuestaRegistros>(
        "/api/v1/registros",
        {
          ...paramsFiltros(filtros),
          codigo,
          per_page: 100,
          sort: "fecha",
          order: "desc",
        },
        signal,
      ),
    enabled: codigo !== null,
    ...COMUN,
  });
}
