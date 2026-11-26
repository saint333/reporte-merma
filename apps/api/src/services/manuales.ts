import { createHash, randomUUID } from "node:crypto";

import type { Pool } from "pg";

import { costoTotal } from "../etl/dinero.js";
import { semanaISO } from "../etl/fechas.js";
import { hashFila } from "../etl/hash.js";
import { normalizar } from "../etl/reglas.js";
import { ErrorApi } from "../http/errores.js";
import { leerSnapshot, registrarCambio } from "./historial.js";
import {
  consultarRegistroPorId,
  normalizarCantidad,
  type FilaRegistro,
} from "./registros.js";

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

export async function crearRegistroManual(
  pool: Pool,
  entrada: RegistroManualEntrada,
): Promise<RegistroManualCreado> {
  const cantidadNormalizada = normalizarCantidad(entrada.cantidad);
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

    const costo = costoTotal(cantidadNormalizada, material.valor_unitario);
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

    const despues = await leerSnapshot(client, creado.id);
    if (!despues) throw new Error("No se pudo leer el registro manual");

    await registrarCambio(client, {
      factId: creado.id,
      cargaId: carga.id,
      codigoMaterial: entrada.codigoMaterial,
      accion: "crear",
      antes: null,
      despues,
    });

    const registro = await consultarRegistroPorId(client, creado.id);

    await client.query("commit");

    if (!registro) throw new Error("No se pudo leer el registro manual");

    return { carga_id: carga.id, registro };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
