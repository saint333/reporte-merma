import { createHash, randomUUID } from "node:crypto";

import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { costoTotal } from "../etl/dinero.js";
import { semanaISO } from "../etl/fechas.js";
import { hashFila } from "../etl/hash.js";
import { normalizar } from "../etl/reglas.js";
import { ErrorApi } from "../http/errores.js";
import type { FilaRegistro } from "./registros.js";

export type RegistroManualEntrada = {
  fecha: string;
  codigoMaterial: number;
  cantidad: string;
  motivo: string;
};

export type RegistroManualCreado = {
  carga_id: number;
  registro: FilaRegistro;
};

const CANTIDAD_MAXIMA = new Decimal("999999999999.9999");

const COLUMNAS_REGISTRO = `
  select r.id::int as id,
         r.fecha::text as fecha,
         r.semana_iso,
         r.mes::text as mes,
         r.codigo_material::int as codigo_material,
         m.descripcion,
         m.grupo_material as familia,
         m.programa,
         r.cantidad::text as cantidad,
         m.um,
         r.motivo_codigo as motivo,
         mo.gestionabilidad as gestion,
         mo.area_responsable,
         r.costo_total::text as costo_total,
         r.es_duplicado,
         r.origen_fila
    from merma.fact_merma r
    join merma.dim_material m on m.codigo = r.codigo_material
    join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo`;

export async function crearRegistroManual(
  pool: Pool,
  entrada: RegistroManualEntrada,
): Promise<RegistroManualCreado> {
  let cantidad: Decimal;
  try {
    cantidad = new Decimal(entrada.cantidad);
  } catch {
    throw new ErrorApi(
      "CANTIDAD_INVALIDA",
      "La cantidad no es numérica.",
      null,
      422,
    );
  }

  if (!cantidad.isFinite() || cantidad.lte(0) || cantidad.gt(CANTIDAD_MAXIMA)) {
    throw new ErrorApi(
      "CANTIDAD_INVALIDA",
      "La cantidad debe ser mayor que cero y caber en la columna numérica.",
      null,
      422,
    );
  }

  const cantidadNormalizada = cantidad.toFixed(4);
  const motivoCodigo = normalizar(entrada.motivo);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const { rows: materiales } = await client.query<{
      valor_unitario: string;
    }>(
      `select valor_unitario::text as valor_unitario
         from merma.dim_material
        where codigo = $1 and activo`,
      [entrada.codigoMaterial],
    );

    const material = materiales[0];
    if (!material) {
      throw new ErrorApi(
        "MATERIAL_NO_REGISTRADO",
        `El código ${entrada.codigoMaterial} no existe en el maestro de materiales.`,
        null,
        422,
      );
    }

    const { rows: motivos } = await client.query<{ codigo: string }>(
      "select codigo from merma.dim_motivo where codigo = $1 and activo",
      [motivoCodigo],
    );

    if (!motivos[0]) {
      throw new ErrorApi(
        "MOTIVO_NO_REGISTRADO",
        `El motivo "${entrada.motivo}" no existe en el catálogo.`,
        null,
        422,
      );
    }

    const hash = hashFila(
      entrada.fecha,
      entrada.codigoMaterial,
      cantidadNormalizada,
      motivoCodigo,
    );

    const { rows: existentes } = await client.query<{ id: number }>(
      "select id::int as id from merma.fact_merma where hash_fila = $1 limit 1",
      [hash],
    );

    if (existentes[0]) {
      throw new ErrorApi(
        "REGISTRO_DUPLICADO",
        "Ya existe un registro con la misma fecha, material, cantidad y motivo.",
        { id: existentes[0].id },
        409,
      );
    }

    const costo = costoTotal(cantidad, material.valor_unitario);
    const hashArchivo = createHash("sha256")
      .update(`${hash}|${randomUUID()}`)
      .digest("hex");

    const { rows: cargas } = await client.query<{ id: number }>(
      `insert into merma.carga
         (archivo, hash_archivo, filas_leidas, filas_insertadas, filas_observadas,
          desde, hasta, estado, detalle)
       values ('Registro manual', $1, 1, 1, 0, $2, $2, 'completada', $3::jsonb)
       returning id::int as id`,
      [
        hashArchivo,
        entrada.fecha,
        JSON.stringify({
          modo: "manual",
          costo_total: costo,
          codigo_material: entrada.codigoMaterial,
          cantidad: cantidadNormalizada,
          motivo: motivoCodigo,
        }),
      ],
    );

    const carga = cargas[0];
    if (!carga) throw new Error("No se pudo crear la carga manual");

    const { rows: creados } = await client.query<{ id: number }>(
      `insert into merma.fact_merma
         (carga_id, fecha, semana_iso, mes, codigo_material, cantidad,
          motivo_codigo, motivo_original, valor_unitario, costo_total,
          origen_fila, hash_fila, es_duplicado)
       values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, null, $10, false)
       returning id::int as id`,
      [
        carga.id,
        entrada.fecha,
        semanaISO(entrada.fecha),
        entrada.fecha.slice(0, 7),
        entrada.codigoMaterial,
        cantidadNormalizada,
        motivoCodigo,
        material.valor_unitario,
        costo,
        hash,
      ],
    );

    const creado = creados[0];
    if (!creado) throw new Error("No se pudo insertar el registro manual");

    const { rows } = await client.query<FilaRegistro>(
      `${COLUMNAS_REGISTRO} where r.id = $1`,
      [creado.id],
    );

    await client.query("commit");

    const registro = rows[0];
    if (!registro) throw new Error("No se pudo leer el registro manual");

    return { carga_id: carga.id, registro };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
