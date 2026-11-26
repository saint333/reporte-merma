import { Decimal } from "decimal.js";
import { z } from "zod";

import { FiltroInvalido } from "./errores.js";
import { hoyLima, sumarDias } from "./fechas.js";

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado YYYY-MM-DD")
  .refine((valor) => {
    const [anio = 0, mes = 1, dia = 1] = valor.split("-").map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return fecha.toISOString().slice(0, 10) === valor;
  }, "La fecha no existe en el calendario");

const csv = z
  .union([z.string(), z.array(z.string())])
  .transform((valor) =>
    (Array.isArray(valor) ? valor : [valor])
      .flatMap((parte) => parte.split(","))
      .map((parte) => parte.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(1)).min(1));

const meses = csv.pipe(
  z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato esperado YYYY-MM")),
);

export const baseFiltros = z.strictObject({
  desde: fecha,
  hasta: fecha,
  mes: meses.optional(),
  programa: csv.optional(),
  familia: csv.optional(),
  gestion: csv.optional(),
});

export function validarRango<T extends { desde: string; hasta: string }>(
  esquema: z.ZodType<T>,
) {
  return esquema
    .refine((filtros) => filtros.desde <= filtros.hasta, {
      message: "desde no puede superar a hasta",
      path: ["desde"],
    })
    .refine((filtros) => filtros.hasta <= sumarDias(hoyLima(), 1), {
      message: "hasta no puede ser una fecha futura",
      path: ["hasta"],
    });
}

export const esquemaFiltros = validarRango(baseFiltros);

export const esquemaRegistros = validarRango(
  baseFiltros.extend({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().min(1).max(500).default(50),
    sort: z
      .enum(["fecha", "costo_total", "cantidad", "semana_iso"])
      .default("fecha"),
    order: z.enum(["asc", "desc"]).default("desc"),
    q: z.string().trim().min(1).optional(),
    motivo: z.string().trim().min(1).optional(),
    codigo: z
      .string()
      .regex(/^\d+$/, "El código debe ser numérico")
      .optional(),
  }),
);

export const esquemaPareto = validarRango(
  baseFiltros.extend({
    limite: z.coerce.number().int().min(1).max(108).default(15),
  }),
);

export const esquemaSerieSemanal = validarRango(
  baseFiltros.extend({
    incluir_wow: z
      .enum(["true", "false"])
      .default("true")
      .transform((valor) => valor === "true"),
  }),
);

export const esquemaProyeccion = validarRango(
  baseFiltros.extend({
    meta_reduccion: z.coerce.number().min(0).max(1).optional(),
    semanas_restantes: z.coerce.number().int().min(1).max(52).optional(),
    umbral_atipico: z.coerce.number().positive().optional(),
  }),
);

const cantidadManual = z
  .union([z.string(), z.number()])
  .transform((valor) => String(valor).trim())
  .refine((valor) => {
    try {
      const cantidad = new Decimal(valor);
      return cantidad.isFinite() && cantidad.gt(0);
    } catch {
      return false;
    }
  }, "La cantidad debe ser numérica y mayor que cero");

export const esquemaRegistroManual = z.strictObject({
  fecha,
  codigo_material: z.coerce.number().int().positive(),
  cantidad: cantidadManual,
  motivo: z.string().trim().min(1).max(120),
});

export const esquemaEditarRegistro = z
  .strictObject({
    fecha: fecha.optional(),
    codigo_material: z.coerce.number().int().positive().optional(),
    cantidad: cantidadManual.optional(),
    motivo: z.string().trim().min(1).max(120).optional(),
  })
  .refine((valor) => Object.keys(valor).length > 0, {
    message: "Envía al menos un campo para editar.",
  });

export type Filtros = z.infer<typeof baseFiltros>;
export type RegistrosQuery = z.infer<typeof esquemaRegistros>;
export type ParetoQuery = z.infer<typeof esquemaPareto>;
export type SerieSemanalQuery = z.infer<typeof esquemaSerieSemanal>;
export type ProyeccionQuery = z.infer<typeof esquemaProyeccion>;
export type RegistroManualBody = z.infer<typeof esquemaRegistroManual>;
export type EditarRegistroBody = z.infer<typeof esquemaEditarRegistro>;

function parseConEsquema<T>(esquema: z.ZodType<T>, query: unknown): T {
  const resultado = esquema.safeParse(query);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((issue) => ({
      campo: issue.path.join(".") || "filtros",
      mensaje: issue.message,
    }));

    throw new FiltroInvalido(
      detalle[0]?.mensaje ?? "Filtros inválidos",
      detalle,
    );
  }

  return resultado.data;
}

export function parseFiltros(query: unknown): Filtros {
  return parseConEsquema(esquemaFiltros, query);
}

export function parseRegistros(query: unknown): RegistrosQuery {
  return parseConEsquema(esquemaRegistros, query);
}

export function parsePareto(query: unknown): ParetoQuery {
  return parseConEsquema(esquemaPareto, query);
}

export function parseSerieSemanal(query: unknown): SerieSemanalQuery {
  return parseConEsquema(esquemaSerieSemanal, query);
}

export function parseProyeccion(query: unknown): ProyeccionQuery {
  return parseConEsquema(esquemaProyeccion, query);
}

export function parseRegistroManual(body: unknown): RegistroManualBody {
  return parseConEsquema(esquemaRegistroManual, body);
}

export function parseEditarRegistro(body: unknown): EditarRegistroBody {
  return parseConEsquema(esquemaEditarRegistro, body);
}

export function where(filtros: Filtros): { sql: string; params: unknown[] } {
  const condiciones = ["r.fecha between $1 and $2"];
  const params: unknown[] = [filtros.desde, filtros.hasta];

  const agregar = (columna: string, valores: string[] | undefined) => {
    if (!valores?.length) return;
    params.push(valores);
    condiciones.push(`${columna} = any($${params.length}::text[])`);
  };

  agregar("r.mes::text", filtros.mes);
  agregar("m.programa", filtros.programa);
  agregar("m.grupo_material", filtros.familia);
  agregar("mo.gestionabilidad", filtros.gestion);

  return { sql: condiciones.join(" and "), params };
}

export function whereRango(
  desde: string,
  hasta: string,
): { sql: string; params: unknown[] } {
  return { sql: "r.fecha between $1 and $2", params: [desde, hasta] };
}

export function filtrosMeta(filtros: Filtros) {
  return {
    desde: filtros.desde,
    hasta: filtros.hasta,
    mes: filtros.mes ?? null,
    programa: filtros.programa ?? null,
    familia: filtros.familia ?? null,
    gestion: filtros.gestion ?? null,
  };
}
