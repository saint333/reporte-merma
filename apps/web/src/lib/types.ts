export type Filtros = {
  desde: string;
  hasta: string;
  mes?: string;
  programa?: string;
  familia?: string;
  gestion?: string;
};

export type FiltrosEcho = {
  desde: string;
  hasta: string;
  mes: string | null;
  programa: string | null;
  familia: string | null;
  gestion: string | null;
};

export type ApiMeta = {
  generado_en: string;
  moneda: string;
  filtros: FiltrosEcho | null;
};

export type Envelope<T> = {
  data: T;
  meta: ApiMeta & Record<string, unknown>;
};

export type MetaData = {
  rango: { min: string | null; max: string | null; dias: number };
  meses: string[];
  programas: string[];
  familias: string[];
  gestiones: string[];
  vistas: { id: string; nombre: string; desde: string; hasta: string }[];
  totales: { registros: number; materiales: number; motivos: number };
  ultima_carga: {
    id: number;
    archivo: string;
    creada_en: string;
  } | null;
};

export type Kpis = {
  merma_total: string;
  eventos: number;
  ticket_promedio: string;
  merma_controlable: string;
  controlable_pct: number;
  pallets_equiv: string;
  skus_con_merma: number;
  skus_total: number;
  semana_pico: { semana_iso: number; costo: string } | null;
  variacion_ultima_semana: number | null;
};

export type SerieMensual = {
  mes: string;
  eventos: number;
  costo: string;
  participacion: string;
};

export type SerieSemanal = {
  semana_iso: number;
  inicio: string;
  eventos: number;
  costo: string;
  wow_costo?: string | null;
  wow_pct?: number | null;
  es_atipica: boolean;
};

export type ResumenSemanal = {
  semanas: number;
  promedio: string;
  promedio_ajustado: string;
  umbral: string;
};

export type FilaCorte = {
  clave: string;
  etiqueta: string;
  gestion: string | null;
  eventos: number;
  costo: string;
  participacion: string;
  orden: number;
  pallets_equiv?: string;
};

export type FilaPareto = {
  rank: number;
  codigo: number;
  descripcion: string;
  familia: string;
  programa: string;
  eventos: number;
  cantidad: string;
  costo: string;
  participacion: string;
  acumulado: string;
  clase_abc: string;
  prioridad: string;
};

export type ResumenPareto = {
  skus: number;
  clase_a: number;
  clase_b: number;
  clase_c: number;
  costo_top: string;
  participacion_top: string;
};

export type Proyeccion = {
  parametros: {
    acumulado: string;
    semanas_observadas: number;
    promedio_global: string;
    promedio_ajustado: string;
    semanas_excluidas: number[];
    semanas_restantes: number;
    meta_reduccion: number;
    proporcion_controlable: string;
  };
  escenarios: {
    id: string;
    nombre: string;
    tasa: string;
    proyeccion_6s: string;
    cierre: string;
    ahorro: string;
  }[];
};

export type Alerta = {
  id: string;
  severidad: "alta" | "media" | "baja";
  icono: string;
  titulo: string;
  detalle: string;
  valor: string;
  eventos: number;
  accion?: { texto: string; filtro: string };
};

export type Registro = {
  id: number;
  fecha: string;
  semana_iso: number;
  mes: string;
  codigo_material: number;
  descripcion: string;
  familia: string;
  programa: string;
  cantidad: string;
  um: string;
  motivo: string;
  gestion: string;
  area_responsable: string;
  costo_total: string;
  es_duplicado: boolean;
  origen_fila: number | null;
};

export type Pagina = {
  page: number;
  per_page: number;
  total: number;
  pages: number;
};

export type Salud = {
  estado: string;
  db: string;
  version: string;
  carga_requiere_token: boolean;
  ultima_carga: string | null;
};

export type ReporteCarga = {
  archivo: string;
  hash: string;
  modo: "append" | "replace";
  leidas: number;
  insertadas: number;
  omitidas_por_existir: number;
  duplicadas: number;
  errores: number;
  observaciones: number;
  filas_observadas: number;
  desde: string | null;
  hasta: string | null;
  costo_total: string;
  por_estado: { ok: number; observada: number; error: number };
  motivos_alias: { motivo: string; filas: number[]; costo: string }[];
  motivos_no_catalogados: { motivo: string; filas: number[]; costo: string }[];
  posibles_duplicados: {
    fecha: string;
    codigo: number;
    cantidad: string;
    filas: number[];
    costo_extra: string;
  }[];
  detalle_errores: { fila: number; codigo: string; mensaje: string }[];
  detalle_observaciones: { fila: number; codigo: string; mensaje: string }[];
  duracion_ms: number;
  ya_cargado?: boolean;
};

export type CatalogoMaterial = {
  codigo: number;
  descripcion: string;
  um: string;
  familia: string;
  programa: string;
  valor_unitario: string;
};

export type CatalogoMotivo = {
  codigo: string;
  categoria: string;
  area_responsable: string;
  gestionabilidad: string;
  accion_correctiva: string | null;
};

export type Catalogos = {
  materiales: CatalogoMaterial[];
  motivos: CatalogoMotivo[];
};

export type RegistroManualEntrada = {
  fecha: string;
  codigo_material: number;
  cantidad: string;
  motivo: string;
};

export type RegistroManualCreado = {
  carga_id: number;
  registro: Registro;
};

export type CargaHistorial = {
  id: number;
  archivo: string;
  filas_leidas: number;
  filas_insertadas: number;
  filas_duplicadas: number;
  filas_observadas: number;
  desde: string | null;
  hasta: string | null;
  estado: string;
  costo_total: string | null;
  modo: string | null;
  creada_en: string;
};
