import { Decimal } from "decimal.js";
import type { Pool } from "pg";

import { costoTotal } from "../etl/dinero.js";
import { semanaISO } from "../etl/fechas.js";
import { hashFila } from "../etl/hash.js";
import { normalizar, validarFila } from "../etl/reglas.js";
import { ErrorApi } from "../http/errores.js";
import {
  leerSnapshot,
  registrarCambio,
  type SnapshotRegistro,
} from "./historial.js";
import {
  consultarRegistroPorId,
  normalizarCantidad,
  type FilaRegistro,
} from "./registros.js";

export type EdicionRegistro = {
  fecha?: string;
  codigoMaterial?: number;
  cantidad?: string;
  motivo?: string;
};

export async function obtenerRegistro(
  pool: Pool,
  id: number,
): Promise<FilaRegistro> {
  const registro = await consultarRegistroPorId(pool, id);

  if (!registro) {
    throw new ErrorApi(
      "REGISTRO_NO_ENCONTRADO",
      "El registro no existe o ya fue eliminado.",
      null,
      404,
    );
  }

  return registro;
}

export async function editarRegistro(
  pool: Pool,
  id: number,
  cambios: EdicionRegistro,
): Promise<FilaRegistro> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const actual = await leerSnapshot(client, id, true);
    if (!actual) {
      throw new ErrorApi(
        "REGISTRO_NO_ENCONTRADO",
        "El registro no existe o ya fue eliminado.",
        null,
        404,
      );
    }

    const fecha = cambios.fecha ?? actual.fecha;
    const codigo = cambios.codigoMaterial ?? actual.codigo_material;
    const cantidad = normalizarCantidad(cambios.cantidad ?? actual.cantidad);
    const motivoTexto =
      cambios.motivo ?? actual.motivo_original ?? actual.motivo;

    const { rows: materiales } = await client.query<{
      valor_unitario: string;
      unidadesPorPallet: number;
    }>(
      `select valor_unitario::text as valor_unitario,
              unidades_por_pallet as "unidadesPorPallet"
         from merma.dim_material
        where codigo = $1 and activo`,
      [codigo],
    );

    const material = materiales[0];
    if (!material) {
      throw new ErrorApi(
        "MATERIAL_NO_REGISTRADO",
        `El código ${codigo} no existe en el maestro de materiales.`,
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

    const revision = validarFila({
      fecha,
      codigo,
      cantidad: new Decimal(cantidad),
      motivoOriginal: motivoTexto,
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

    const motivo = revision.motivoCodigo;
    const hash = hashFila(fecha, codigo, cantidad, motivo);

    const { rows: duplicados } = await client.query<{ id: number }>(
      "select id::int as id from merma.fact_merma where hash_fila = $1 and id <> $2 limit 1",
      [hash, id],
    );

    if (duplicados[0]) {
      throw new ErrorApi(
        "REGISTRO_DUPLICADO",
        "Ya existe otro registro con la misma fecha, material, cantidad y motivo.",
        { id: duplicados[0].id },
        409,
      );
    }

    const sinCambios =
      fecha === actual.fecha &&
      codigo === actual.codigo_material &&
      motivo === actual.motivo &&
      new Decimal(cantidad).eq(actual.cantidad);

    if (sinCambios) {
      await client.query("commit");
      return await obtenerRegistro(pool, id);
    }

    const costo = costoTotal(cantidad, material.valor_unitario);
    const motivoOriginal = cambios.motivo
      ? motivoTexto
      : (actual.motivo_original ?? motivo);

    await client.query(
      `update merma.fact_merma
          set fecha = $2,
              semana_iso = $3,
              mes = $4,
              codigo_material = $5,
              cantidad = $6,
              motivo_codigo = $7,
              motivo_original = $8,
              valor_unitario = $9,
              costo_total = $10,
              hash_fila = $11
        where id = $1`,
      [
        id,
        fecha,
        semanaISO(fecha),
        fecha.slice(0, 7),
        codigo,
        cantidad,
        motivo,
        motivoOriginal,
        material.valor_unitario,
        costo,
        hash,
      ],
    );

    const despues = await leerSnapshot(client, id);
    if (!despues) throw new Error("No se pudo leer el registro editado");

    await registrarCambio(client, {
      factId: id,
      cargaId: actual.carga_id ?? null,
      codigoMaterial: codigo,
      accion: "editar",
      antes: actual,
      despues,
    });

    await client.query("commit");

    return await obtenerRegistro(pool, id);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function eliminarRegistro(
  pool: Pool,
  id: number,
): Promise<SnapshotRegistro> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const actual = await leerSnapshot(client, id, true);
    if (!actual) {
      throw new ErrorApi(
        "REGISTRO_NO_ENCONTRADO",
        "El registro no existe o ya fue eliminado.",
        null,
        404,
      );
    }

    await registrarCambio(client, {
      factId: id,
      cargaId: actual.carga_id ?? null,
      codigoMaterial: actual.codigo_material,
      accion: "eliminar",
      antes: actual,
      despues: null,
    });

    await client.query("delete from merma.fact_merma where id = $1", [id]);
    await client.query("commit");

    return actual;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
