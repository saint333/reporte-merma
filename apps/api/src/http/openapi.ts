const propiedadesBase = {
  desde: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "Fecha inicial (YYYY-MM-DD).",
  },
  hasta: {
    type: "string",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    description: "Fecha final (YYYY-MM-DD).",
  },
  mes: {
    type: "string",
    description: "Mes o meses separados por coma (YYYY-MM).",
  },
  programa: {
    type: "string",
    description: "Programa o programas separados por coma.",
  },
  familia: {
    type: "string",
    description: "Familia o familias separadas por coma.",
  },
  gestion: {
    type: "string",
    description: "Gestionabilidad o gestionabilidades separadas por coma.",
  },
};

export const queryBase = {
  type: "object",
  required: ["desde", "hasta"],
  properties: propiedadesBase,
  additionalProperties: true,
};

export const querySerieSemanal = {
  ...queryBase,
  properties: {
    ...propiedadesBase,
    incluir_wow: {
      type: "string",
      enum: ["true", "false"],
      default: "true",
      description: "Incluye los campos de variación semana a semana.",
    },
  },
};

export const queryPareto = {
  ...queryBase,
  properties: {
    ...propiedadesBase,
    limite: {
      type: "integer",
      minimum: 1,
      maximum: 108,
      default: 15,
      description: "Cantidad de SKUs del Top.",
    },
  },
};

export const queryProyeccion = {
  ...queryBase,
  properties: {
    ...propiedadesBase,
    meta_reduccion: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Sobrescribe la meta de reducción controlable.",
    },
    semanas_restantes: {
      type: "integer",
      minimum: 1,
      maximum: 52,
      description: "Sobrescribe el horizonte de proyección.",
    },
    umbral_atipico: {
      type: "number",
      exclusiveMinimum: 0,
      description: "Sobrescribe el umbral de semana atípica.",
    },
  },
};

export const queryRegistros = {
  ...queryBase,
  properties: {
    ...propiedadesBase,
    page: { type: "integer", minimum: 1, default: 1 },
    per_page: { type: "integer", minimum: 1, maximum: 500, default: 50 },
    sort: {
      type: "string",
      enum: ["fecha", "costo_total", "cantidad", "semana_iso"],
      default: "fecha",
    },
    order: { type: "string", enum: ["asc", "desc"], default: "desc" },
    q: {
      type: "string",
      description: "Busca en descripción, código o motivo.",
    },
    motivo: {
      type: "string",
      description: "Código exacto del motivo.",
    },
    codigo: {
      type: "string",
      pattern: "^\\d+$",
      description: "Código exacto de material.",
    },
  },
};

export const paramsDimension = {
  type: "object",
  required: ["dimension"],
  properties: {
    dimension: {
      type: "string",
      enum: ["motivos", "familias", "programas", "gestion"],
    },
  },
};
