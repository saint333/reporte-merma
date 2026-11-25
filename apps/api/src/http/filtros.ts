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

export const esquemaFiltros = z
  .strictObject({
    desde: fecha,
    hasta: fecha,
    mes: meses.optional(),
    programa: csv.optional(),
    familia: csv.optional(),
    gestion: csv.optional(),
  })
  .refine((filtros) => filtros.desde <= filtros.hasta, {
    message: "desde no puede superar a hasta",
    path: ["desde"],
  })
  .refine((filtros) => filtros.hasta <= sumarDias(hoyLima(), 1), {
    message: "hasta no puede ser una fecha futura",
    path: ["hasta"],
  });

export type Filtros = z.infer<typeof esquemaFiltros>;

export function parseFiltros(query: unknown): Filtros {
  const resultado = esquemaFiltros.safeParse(query);
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
