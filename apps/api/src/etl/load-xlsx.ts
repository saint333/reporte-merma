import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Decimal } from "decimal.js";
import ExcelJS from "exceljs";
import type { Pool, PoolClient } from "pg";

import { costoTotal } from "./dinero.js";
import { fechaISO, semanaISO } from "./fechas.js";
import { hashArchivo, hashFila } from "./hash.js";
import {
  GESTIONES,
  normalizar,
  validarFila,
  type Material,
  type Motivo,
} from "./reglas.js";

const HOJAS = [
  "REGISTRO_MERMAS",
  "MAESTRO_MATERIALES",
  "CATALOGO_MOTIVOS",
] as const;

const DIR_REPORTES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data/reports",
);

export type Modo = "dry-run" | "append" | "replace";

type Evento = {
  fecha: string;
  semanaIso: number;
  mes: string;
  codigoMaterial: number;
  cantidad: string;
  motivoCodigo: string;
  motivoOriginal: string;
  valorUnitario: string;
  costoTotal: string;
  origenFila: number;
  hashFila: string;
  esDuplicado: boolean;
};

type Detalle = { fila: number; codigo: string; mensaje: string };

type Grupo = { filas: number[]; costo: Decimal };

export type Reporte = {
  archivo: string;
  hash: string;
  modo: Modo;
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
  detalle_errores: Detalle[];
  detalle_observaciones: Detalle[];
  duracion_ms: number;
  ya_cargado?: boolean;
  reporte?: string;
};

function textoDe(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);

  if (typeof valor === "object") {
    if ("richText" in valor) return valor.richText.map((t) => t.text).join("");
    if ("text" in valor) return String(valor.text);
    if ("result" in valor) return textoDe(valor.result as ExcelJS.CellValue);
    if ("error" in valor) return String(valor.error);
  }

  return String(valor);
}

function celda(fila: ExcelJS.Row, columna: number): string {
  return textoDe(fila.getCell(columna).value).replace(/\s+/g, " ").trim();
}

function leerCatalogo(wb: ExcelJS.Workbook): Motivo[] {
  const ws = wb.getWorksheet("CATALOGO_MOTIVOS");
  if (!ws) throw new Error("Falta la hoja CATALOGO_MOTIVOS");

  const motivos: Motivo[] = [];
  for (let r = 5; r <= Math.min(ws.rowCount, 100); r++) {
    const fila = ws.getRow(r);
    const codigo = normalizar(celda(fila, 1));
    if (!codigo) continue;

    const gestionabilidad = celda(fila, 4);
    if (!GESTIONES.has(gestionabilidad)) {
      throw new Error(
        `Gestión inválida en CATALOGO_MOTIVOS!D${r}: "${gestionabilidad}"`,
      );
    }

    motivos.push({
      codigo,
      categoria: celda(fila, 2),
      areaResponsable: celda(fila, 3),
      gestionabilidad,
      accionCorrectiva: celda(fila, 5) || null,
    });
  }

  if (motivos.length === 0) throw new Error("CATALOGO_MOTIVOS no tiene filas");
  return motivos;
}

function leerMaestro(wb: ExcelJS.Workbook): Map<number, Material> {
  const ws = wb.getWorksheet("MAESTRO_MATERIALES");
  if (!ws) throw new Error("Falta la hoja MAESTRO_MATERIALES");

  const materiales = new Map<number, Material>();
  for (let r = 5; r <= Math.min(ws.rowCount, 500); r++) {
    const fila = ws.getRow(r);
    const codigoCrudo = fila.getCell(1).value;
    if (typeof codigoCrudo !== "number" && typeof codigoCrudo !== "string") continue;

    const codigo = Number(codigoCrudo);
    if (!Number.isInteger(codigo)) continue;

    const valorUnitario = celda(fila, 4);
    const unidadesPorPallet = Number(fila.getCell(8).value);
    const descripcion = celda(fila, 2);
    const um = celda(fila, 3);
    const grupoMaterial = normalizar(celda(fila, 6));
    const programa = normalizar(celda(fila, 7));

    let valor: Decimal;
    try {
      valor = new Decimal(valorUnitario);
    } catch {
      throw new Error(`Valor unitario inválido en MAESTRO_MATERIALES!D${r}`);
    }

    if (!valor.isFinite() || valor.isNegative()) {
      throw new Error(`Valor unitario inválido en MAESTRO_MATERIALES!D${r}`);
    }
    if (!Number.isInteger(unidadesPorPallet) || unidadesPorPallet <= 0) {
      throw new Error(`Unidades por pallet inválidas en MAESTRO_MATERIALES!H${r}`);
    }
    if (!descripcion || !um || !grupoMaterial || !programa) {
      throw new Error(`Datos incompletos en MAESTRO_MATERIALES fila ${r}`);
    }
    if (materiales.has(codigo)) {
      throw new Error(`Código duplicado en MAESTRO_MATERIALES: ${codigo}`);
    }

    materiales.set(codigo, {
      codigo,
      descripcion,
      um,
      valorUnitario: valor.toFixed(10),
      codSubgrupo: celda(fila, 5) || null,
      grupoMaterial,
      programa,
      unidadesPorPallet,
    });
  }

  if (materiales.size === 0) throw new Error("MAESTRO_MATERIALES no tiene filas");
  return materiales;
}

function leerRegistro(
  wb: ExcelJS.Workbook,
  materiales: Map<number, Material>,
  catalogo: Set<string>,
  alias: Map<string, string>,
) {
  const ws = wb.getWorksheet("REGISTRO_MERMAS");
  if (!ws) throw new Error("Falta la hoja REGISTRO_MERMAS");

  const eventos: Evento[] = [];
  const errores: Detalle[] = [];
  const observaciones: Detalle[] = [];
  const aliasGrupos = new Map<string, Grupo>();
  const huerfanosGrupos = new Map<string, Grupo>();
  const gruposHash = new Map<
    string,
    {
      fecha: string;
      codigo: number;
      cantidad: string;
      filas: number[];
      costoExtra: Decimal;
    }
  >();
  const porEstado = { ok: 0, observada: 0, error: 0 };
  let leidas = 0;
  let costoArchivo = new Decimal(0);
  let desde: string | null = null;
  let hasta: string | null = null;

  const sumarGrupo = (grupo: Map<string, Grupo>, motivo: string, fila: number, costo: string) => {
    const actual = grupo.get(motivo) ?? { filas: [], costo: new Decimal(0) };
    actual.filas.push(fila);
    actual.costo = actual.costo.plus(costo);
    grupo.set(motivo, actual);
  };

  for (let r = 5; r <= ws.rowCount; r++) {
    const fila = ws.getRow(r);
    const fechaCruda = fila.getCell(4).value;
    if (fechaCruda === null || fechaCruda === undefined) continue;

    leidas += 1;
    const fecha = fechaISO(fechaCruda);
    if (!fecha) {
      errores.push({
        fila: r,
        codigo: "FECHA_INVALIDA",
        mensaje: "La celda de fecha no es una fecha válida",
      });
      porEstado.error += 1;
      continue;
    }

    const codigo = Number(fila.getCell(5).value);
    let cantidad: Decimal | null = null;
    try {
      cantidad = new Decimal(celda(fila, 10) || "0");
    } catch {
      cantidad = null;
    }

    if (!cantidad || !cantidad.isFinite()) {
      errores.push({
        fila: r,
        codigo: "CANTIDAD_INVALIDA",
        mensaje: `La cantidad "${celda(fila, 10)}" no es numérica`,
      });
      porEstado.error += 1;
      continue;
    }

    const motivoOriginal = celda(fila, 12);
    const material = materiales.get(codigo);
    const hash = hashFila(fecha, codigo, cantidad.toFixed(4), motivoOriginal);
    const esDuplicado = gruposHash.has(hash);

    const revision = validarFila({
      fecha,
      codigo,
      cantidad,
      motivoOriginal,
      material,
      catalogo,
      alias,
      esDuplicado,
    });

    if (revision.estado === "error" || !material || !revision.motivoCodigo) {
      for (const observacion of revision.observaciones) {
        errores.push({ fila: r, codigo: observacion.codigo, mensaje: observacion.mensaje });
      }
      porEstado.error += 1;
      continue;
    }

    const costo = costoTotal(cantidad, material.valorUnitario);
    const evento: Evento = {
      fecha,
      semanaIso: semanaISO(fecha),
      mes: fecha.slice(0, 7),
      codigoMaterial: codigo,
      cantidad: cantidad.toFixed(4),
      motivoCodigo: revision.motivoCodigo,
      motivoOriginal,
      valorUnitario: material.valorUnitario,
      costoTotal: costo,
      origenFila: r,
      hashFila: hash,
      esDuplicado,
    };

    eventos.push(evento);
    porEstado[revision.estado] += 1;
    costoArchivo = costoArchivo.plus(costo);
    const minimo = desde;
    const maximo = hasta;
    if (minimo === null || fecha < minimo) desde = fecha;
    if (maximo === null || fecha > maximo) hasta = fecha;

    for (const observacion of revision.observaciones) {
      observaciones.push({ fila: r, codigo: observacion.codigo, mensaje: observacion.mensaje });
    }

    if (revision.observaciones.some((o) => o.codigo === "MOTIVO_ALIAS")) {
      sumarGrupo(aliasGrupos, motivoOriginal, r, costo);
    }
    if (revision.observaciones.some((o) => o.codigo === "MOTIVO_NO_CATALOGADO")) {
      sumarGrupo(huerfanosGrupos, motivoOriginal, r, costo);
    }

    const grupo = gruposHash.get(hash);
    if (grupo) {
      grupo.filas.push(r);
      grupo.costoExtra = grupo.costoExtra.plus(costo);
    } else {
      gruposHash.set(hash, {
        fecha,
        codigo,
        cantidad: cantidad.toFixed(4),
        filas: [r],
        costoExtra: new Decimal(0),
      });
    }
  }

  const duplicados = [...gruposHash.values()].filter((g) => g.filas.length > 1);

  return {
    eventos,
    errores,
    observaciones,
    porEstado,
    leidas,
    costoArchivo,
    desde,
    hasta,
    aliasGrupos,
    huerfanosGrupos,
    duplicados,
  };
}

async function upsertCatalogo(client: PoolClient, motivos: Motivo[]): Promise<void> {
  for (const motivo of motivos) {
    await client.query(
      `insert into merma.dim_motivo
         (codigo, categoria, area_responsable, gestionabilidad, accion_correctiva, activo)
       values ($1, $2, $3, $4, $5, true)
       on conflict (codigo) do update set
         categoria = excluded.categoria,
         area_responsable = excluded.area_responsable,
         gestionabilidad = excluded.gestionabilidad,
         accion_correctiva = excluded.accion_correctiva,
         activo = true`,
      [
        motivo.codigo,
        motivo.categoria,
        motivo.areaResponsable,
        motivo.gestionabilidad,
        motivo.accionCorrectiva,
      ],
    );
  }
}

async function upsertMaestro(
  client: PoolClient,
  materiales: Map<number, Material>,
): Promise<void> {
  for (const material of materiales.values()) {
    await client.query(
      `insert into merma.dim_material
         (codigo, descripcion, um, valor_unitario, cod_subgrupo, grupo_material,
          programa, unidades_por_pallet, activo, actualizado_en)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
       on conflict (codigo) do update set
         descripcion = excluded.descripcion,
         um = excluded.um,
         valor_unitario = excluded.valor_unitario,
         cod_subgrupo = excluded.cod_subgrupo,
         grupo_material = excluded.grupo_material,
         programa = excluded.programa,
         unidades_por_pallet = excluded.unidades_por_pallet,
         activo = true,
         actualizado_en = now()`,
      [
        material.codigo,
        material.descripcion,
        material.um,
        material.valorUnitario,
        material.codSubgrupo,
        material.grupoMaterial,
        material.programa,
        material.unidadesPorPallet,
      ],
    );
  }
}

async function insertarEventos(
  client: PoolClient,
  cargaId: number,
  eventos: Evento[],
): Promise<void> {
  for (let i = 0; i < eventos.length; i += 500) {
    const lote = eventos.slice(i, i + 500);
    const valores: unknown[] = [cargaId];
    const tuplas = lote.map((evento, indice) => {
      const base = indice * 12 + 2;
      valores.push(
        evento.fecha,
        evento.semanaIso,
        evento.mes,
        evento.codigoMaterial,
        evento.cantidad,
        evento.motivoCodigo,
        evento.motivoOriginal,
        evento.valorUnitario,
        evento.costoTotal,
        evento.origenFila,
        evento.hashFila,
        evento.esDuplicado,
      );
      return `($1,${Array.from({ length: 12 }, (_, k) => `$${base + k}`).join(",")})`;
    });

    await client.query(
      `insert into merma.fact_merma
         (carga_id, fecha, semana_iso, mes, codigo_material, cantidad, motivo_codigo,
          motivo_original, valor_unitario, costo_total, origen_fila, hash_fila, es_duplicado)
       values ${tuplas.join(",")}`,
      valores,
    );
  }
}

async function escribirReporte(
  reporte: Reporte,
  directorio: string | null,
  inicio: number,
): Promise<Reporte> {
  reporte.duracion_ms = Date.now() - inicio;
  if (!directorio) return reporte;

  await mkdir(directorio, { recursive: true });

  const sello = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
  const destino = path.join(directorio, `carga-${sello}.json`);
  await writeFile(destino, JSON.stringify(reporte, null, 2), "utf8");

  reporte.reporte = destino;
  return reporte;
}

export type FuenteXlsx =
  | { ruta: string }
  | { bytes: Buffer; nombre: string };

export async function ejecutar(
  fuente: FuenteXlsx,
  modo: Modo = "append",
  opciones: {
    pool: Pool;
    reportDir?: string;
    guardarReporte?: boolean;
  },
): Promise<Reporte> {
  const inicio = Date.now();
  const {
    pool,
    reportDir = DIR_REPORTES,
    guardarReporte = true,
  } = opciones;
  const destinoReporte = guardarReporte ? reportDir : null;

  const bytes = "bytes" in fuente ? fuente.bytes : await readFile(fuente.ruta);
  const nombre = "bytes" in fuente ? fuente.nombre : path.basename(fuente.ruta);
  const archivoHash = hashArchivo(bytes);
  const wb = new ExcelJS.Workbook();
  // @types/node 22 declara Buffer genérico y ExcelJS espera el Buffer clásico.
  await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const faltantes = HOJAS.filter((hoja) => !wb.getWorksheet(hoja));
  if (faltantes.length > 0) {
    throw new Error(`Faltan hojas en el archivo: ${faltantes.join(", ")}`);
  }

  const motivos = leerCatalogo(wb);
  const materiales = leerMaestro(wb);
  const client = await pool.connect();
  let enTransaccion = false;

  try {
    const { rows: aliasRows } = await client.query<{
      alias: string;
      motivo_codigo: string;
    }>("select alias, motivo_codigo from merma.dim_motivo_alias");
    const alias = new Map(
      aliasRows.map((fila) => [normalizar(fila.alias), fila.motivo_codigo]),
    );
    const catalogo = new Set(motivos.map((motivo) => motivo.codigo));

    const lectura = leerRegistro(wb, materiales, catalogo, alias);
    const reporte: Reporte = {
      archivo: nombre,
      hash: archivoHash,
      modo,
      leidas: lectura.leidas,
      insertadas: 0,
      omitidas_por_existir: 0,
      duplicadas: lectura.eventos.filter((evento) => evento.esDuplicado).length,
      errores: lectura.errores.length,
      observaciones: lectura.observaciones.length,
      filas_observadas: lectura.porEstado.observada,
      desde: lectura.desde,
      hasta: lectura.hasta,
      costo_total: lectura.costoArchivo.toFixed(4),
      por_estado: lectura.porEstado,
      motivos_alias: [...lectura.aliasGrupos.entries()].map(([motivo, grupo]) => ({
        motivo,
        filas: grupo.filas,
        costo: grupo.costo.toFixed(4),
      })),
      motivos_no_catalogados: [...lectura.huerfanosGrupos.entries()].map(
        ([motivo, grupo]) => ({
          motivo,
          filas: grupo.filas,
          costo: grupo.costo.toFixed(4),
        }),
      ),
      posibles_duplicados: lectura.duplicados.map((grupo) => ({
        fecha: grupo.fecha,
        codigo: grupo.codigo,
        cantidad: grupo.cantidad,
        filas: grupo.filas,
        costo_extra: grupo.costoExtra.toFixed(4),
      })),
      detalle_errores: lectura.errores,
      detalle_observaciones: lectura.observaciones,
      duracion_ms: 0,
    };

    const { rows: previas } = await client.query<{ id: number }>(
      `select id from merma.carga
        where hash_archivo = $1 and estado in ('en_proceso', 'completada')`,
      [archivoHash],
    );

    if (previas.length > 0 && modo !== "replace") {
      reporte.ya_cargado = true;
      return await escribirReporte(reporte, destinoReporte, inicio);
    }

    let aInsertar = lectura.eventos;
    if ((modo === "append" || modo === "dry-run") && lectura.eventos.length > 0) {
      const fechas = lectura.eventos.map((evento) => evento.fecha).sort();
      const { rows: existentes } = await client.query<{ hash_fila: string }>(
        "select hash_fila from merma.fact_merma where fecha between $1 and $2",
        [fechas[0], fechas[fechas.length - 1]],
      );
      const yaEnBase = new Set(existentes.map((fila) => fila.hash_fila));

      for (const evento of lectura.eventos) {
        if (yaEnBase.has(evento.hashFila)) evento.esDuplicado = true;
      }
      aInsertar = lectura.eventos.filter((evento) => !yaEnBase.has(evento.hashFila));
      reporte.omitidas_por_existir = lectura.eventos.length - aInsertar.length;
    }

    if (modo === "dry-run") {
      return await escribirReporte(reporte, destinoReporte, inicio);
    }

    await client.query("begin");
    enTransaccion = true;

    await upsertCatalogo(client, motivos);
    await upsertMaestro(client, materiales);

    if (modo === "replace" && previas.length > 0) {
      const ids = previas.map((fila) => fila.id);
      await client.query(
        "update merma.carga set estado = 'revertida' where id = any($1::bigint[])",
        [ids],
      );
      await client.query(
        "delete from merma.fact_merma where carga_id = any($1::bigint[])",
        [ids],
      );
    }

    const { rows } = await client.query<{ id: number }>(
      `insert into merma.carga
         (archivo, hash_archivo, filas_leidas, filas_insertadas, filas_duplicadas,
          filas_observadas, desde, hasta, estado, detalle)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'en_proceso', '{}'::jsonb)
       returning id`,
      [
        reporte.archivo,
        archivoHash,
        reporte.leidas,
        aInsertar.length,
        reporte.duplicadas,
        reporte.filas_observadas,
        reporte.desde,
        reporte.hasta,
      ],
    );

    const carga = rows[0];
    if (!carga) throw new Error("No se pudo crear la carga");

    await insertarEventos(client, carga.id, aInsertar);
    reporte.insertadas = aInsertar.length;
    reporte.duracion_ms = Date.now() - inicio;

    await client.query(
      `update merma.carga
          set estado = 'completada', detalle = $2
        where id = $1`,
      [carga.id, JSON.stringify(reporte)],
    );

    await client.query("commit");
    enTransaccion = false;

    return await escribirReporte(reporte, destinoReporte, inicio);
  } catch (error) {
    if (enTransaccion) await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
