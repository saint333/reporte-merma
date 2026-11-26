import { createHash, randomUUID } from "node:crypto";

import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { costoTotal } from "../etl/dinero.js";
import { semanaISO } from "../etl/fechas.js";
import { hashFila } from "../etl/hash.js";
import {
  normalizar,
  validarFila,
  type Observacion,
} from "../etl/reglas.js";
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
  observaciones: Observacion[];
};

export async function crearRegistroManual(
  pool: Pool,
  entrada: RegistroManualEntrada,
): Promise<RegistroManualCreado> {
  const cantidadNormalizada = normalizarCantidad(entrada.cantidad);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const { rows: materiales } = await client.query<{
      valor_unitario: string;
      unidadesPorPallet: number;
    }>(
      `select valor_unitario::text as valor_unitario,
              unidades_por_pallet as "unidadesPorPallet"
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

    const [motivos, aliasFilas] = await Promise.all([
      client.query<{ codigo: string }>(
        "select codigo from merma.dim_motivo where activo",
      ),
      client.query<{ alias: string; motivo_codigo: string }>(
        "select alias, motivo_codigo from merma.dim_motivo_alias",
      ),
    ]);

    const catalogo = new Set(motivos.rows.map((fila) => fila.codigo));
    const alias = new Map(
      aliasFilas.rows.map((fila) => [
        normalizar(fila.alias),
        fila.motivo_codigo,
      ]),
    );

    // Mismas reglas que el ETL: catálogo, alias o SIN CLASIFICAR, con las
    // observaciones de campaña, cantidad atípica y pallet singular.
    const revision = validarFila({
      fecha: entrada.fecha,
      codigo: entrada.codigoMaterial,
      cantidad: new Decimal(cantidadNormalizada),
      motivoOriginal: entrada.motivo,
      material,
      catalogo,
      alias,
      esDuplicado: false,
    });

    if (revision.estado === "error" || !revision.motivoCodigo) {
      const detalle = revision.observaciones[0];
      throw new ErrorApi(
        detalle?.codigo ?? "REGISTRO_INVALIDO",
        detalle?.mensaje ?? "El registro no es válido.",
        null,
        422,
      );
    }

    const motivoCodigo = revision.motivoCodigo;

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
       values ('Registro manual', $1, 1, 1, $4, $2, $2, 'completada', $3::jsonb)
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
          motivo_original: entrada.motivo,
          observaciones: revision.observaciones,
        }),
        revision.estado === "observada" ? 1 : 0,
      ],
    );

    const carga = cargas[0];
    if (!carga) throw new Error("No se pudo crear la carga manual");

    const { rows: creados } = await client.query<{ id: number }>(
      `insert into merma.fact_merma
         (carga_id, fecha, semana_iso, mes, codigo_material, cantidad,
          motivo_codigo, motivo_original, valor_unitario, costo_total,
          origen_fila, hash_fila, es_duplicado)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, null, $11, false)
       returning id::int as id`,
      [
        carga.id,
        entrada.fecha,
        semanaISO(entrada.fecha),
        entrada.fecha.slice(0, 7),
        entrada.codigoMaterial,
        cantidadNormalizada,
        motivoCodigo,
        entrada.motivo,
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

    return {
      carga_id: carga.id,
      registro,
      observaciones: revision.observaciones,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
