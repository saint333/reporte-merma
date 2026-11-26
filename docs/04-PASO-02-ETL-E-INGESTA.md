# PASO 2 · ETL E INGESTA DEL EXCEL

**Duración estimada:** 1.5 días
**Depende de:** Paso 1 (esquema)
**Bloquea a:** Paso 3 (API con datos reales) y Paso 6 (paridad)

**Objetivo:** cargar el libro en Postgres sin perder trazabilidad: 108 materiales, 13 motivos, 1,795 eventos, 4 posibles duplicados y 3 motivos fuera de catálogo, todo reportado.

---

## 1. Estrategia

**No se confía en los valores cacheados del Excel.** El libro tiene fórmulas que pueden estar desactualizadas (por eso los textos mienten). El ETL lee **solo las columnas de entrada** y **recalcula** lo demás con las mismas reglas del Paso 1.

| Se lee del Excel | Se recalcula |
|---|---|
| `REGISTRO!D` fecha | año, mes, semana ISO |
| `REGISTRO!E` código | descripción, um, familia, programa, unidades/pallet (maestro) |
| `REGISTRO!J` cantidad | pallets, costo total |
| `REGISTRO!L` motivo | gestionabilidad, área (catálogo/alias) |
| `MAESTRO!A:H` | columnas I–M (merma, %, ABC) **no se leen** |
| `CATALOGO!A:E` | — |

Con esto, si mañana alguien reabre el Excel y agrega filas, el ETL las ve; si las fórmulas del libro quedaron viejas, no importa.

---

## 2. Orden de ejecución

```text
1. Validar archivo (existe, extensión, hash, hojas requeridas)
2. Leer CATALOGO_MOTIVOS      → upsert dim_motivo (13)
3. Leer MAESTRO_MATERIALES    → upsert dim_material (108)
4. Leer REGISTRO_MERMAS       → construir eventos en memoria
5. Validar cada evento        → errores / observaciones
6. Detectar duplicados        → contra archivo y contra BD
7. Insertar carga + hechos    → una transacción
8. Escribir reporte           → JSON + log + salida por consola
```

Si falla cualquier paso 2–6, **no se inserta nada**. Si falla el 7, rollback completo.

---

## 3. Mapeo de columnas

### 3.1 Registro (`REGISTRO_MERMAS`, filas 5–1799)

| Col | Campo destino | Transformación |
|---|---|---|
| D | `fecha` | `date`; rechaza vacío, texto no parseable, año fuera de 2020–2030 |
| E | `codigo_material` | `int`; debe existir en maestro, si no → error de fila |
| J | `cantidad` | `decimal.js`; > 0; redondeo a 4 decimales |
| L | `motivo_original` | `strip()`, colapsa espacios, mayúsculas |
| — | `motivo_codigo` | match exacto → alias → `SIN CLASIFICAR` |
| — | `semana_iso` | semana ISO 8601 calculada desde la fecha (`lunes` como inicio) |
| — | `mes` | `YYYY-MM` a partir de la fecha |
| — | `valor_unitario` | snapshot del maestro, como texto decimal |
| — | `costo_total` | `decimal.js`: producto normalizado a 15 dígitos y `ROUND_HALF_UP` a 4 decimales (así redondea Excel) |
| — | `hash_fila` | `sha256(fecha|codigo|cantidad|motivo_codigo)`; así el mismo evento tiene la misma identidad venga del Excel o del formulario (`motivo_original` queda solo para trazabilidad) |
| — | `origen_fila` | número de fila del Excel |

**Filas ignoradas:** 1–4 (títulos/cabecera), 1800 (`SUBTOTAL`), filas sin fecha.

### 3.2 Maestro (`MAESTRO_MATERIALES`, filas 5–112)

| Col | Campo | Validación |
|---|---|---|
| A | `codigo` | único, entero |
| B | `descripcion` | no vacío |
| C | `um` | ∈ {UNI, UND, MTS, MIL, ROL} |
| D | `valor_unitario` | ≥ 0 |
| E | `cod_subgrupo` | texto |
| F | `grupo_material` | ∈ 8 familias |
| G | `programa` | ∈ 5 programas |
| H | `unidades_por_pallet` | entero > 0 |

La fila 113 (`TOTAL GENERAL MAESTRO`) se ignora por no tener código.

### 3.3 Catálogo (`CATALOGO_MOTIVOS`, filas 5–17)

| Col | Campo |
|---|---|
| A | `codigo` |
| B | `categoria` |
| C | `area_responsable` |
| D | `gestionabilidad` |
| E | `accion_correctiva` |

---

## 4. Reglas de validación y observaciones

Cada fila termina en uno de tres estados:

| Estado | Ejemplo | Acción |
|---|---|---|
| `ok` | fila normal | Se inserta |
| `observada` | motivo no catalogado, fecha atípica, cantidad enorme | Se inserta **y** se reporta |
| `error` | fecha nula, código inexistente, cantidad ≤ 0 | **No** se inserta; se reporta con número de fila |

```ts
const UMBRAL_CANTIDAD = new Decimal("10000000"); // 10 millones: revisar antes de aceptar
const CAMPANIA = { desde: "2026-01-01", hasta: "2026-12-31" } as const;
```

Validaciones:

| Regla | Nivel | Mensaje |
|---|---|---|
| Fecha nula o no parseable | error | `FECHA_INVALIDA` |
| Fecha fuera de la campaña | observación | `FECHA_FUERA_DE_CAMPANIA` |
| Código no existe en maestro | error | `MATERIAL_NO_REGISTRADO` |
| Cantidad ≤ 0 | error | `CANTIDAD_INVALIDA` |
| Cantidad > 10,000,000 | observación | `CANTIDAD_ATIPICA` |
| Motivo no catalogado y sin alias | observación | `MOTIVO_NO_CATALOGADO` (se guarda `SIN CLASIFICAR` + `motivo_original`) |
| Motivo con alias | observación | `MOTIVO_ALIAS` |
| Fila repetida (hash ya visto) | observación | `POSIBLE_DUPLICADO` |
| `unidades_por_pallet` = 1 | observación | `PALLET_SINGULAR` (solo informativo) |

**Resultado esperado con el archivo actual:**

| Métrica | Valor |
|---|---|
| Filas leídas | 1,795 |
| Insertadas | 1,795 |
| Errores | 0 |
| Observadas | 3 (`MOTIVO_ALIAS`) + 4 (`POSIBLE_DUPLICADO`) = 7 |
| Motivos con alias | `MALA IMPRESIÓN` × 3 ($39.3084) → `ERROR DE IMPRESIÓN` |
| Sin clasificar (motivo válido, pendiente de auditoría) | `SIN CLASIFICAR` × 7 ($1,118.13) |

---

## 5. Deduplicación

**Definición:** dos eventos son duplicados si coinciden fecha, código, cantidad exacta y motivo original.

```sql
-- Ya en base
select hash_fila from merma.fact_merma where hash_fila = any(:hashes);
```

- El **primero** se inserta con `es_duplicado = false`.
- Los siguientes se insertan con `es_duplicado = true` (no se descartan).
- El reporte lista los pares con fila de origen, fecha y costo, para que el área decida.

**Falso positivo posible:** dos turnos distintos pueden reportar la misma cantidad del mismo material el mismo día con el mismo motivo. Por eso se marca “posible” y no se borra. La UI (Paso 4) muestra un badge y un enlace al detalle.

---

## 6. Idempotencia y modos de ejecución

```bash
cd apps/api
npm run etl -- \
  --file "../../data/source/REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK.xlsx" \
  --mode dry-run
```

| Modo | Comportamiento | Uso |
|---|---|---|
| `dry-run` | Lee y valida, no escribe; imprime reporte | Primera vez, CI |
| `append` (default) | Inserta solo hechos cuyo `hash_fila` no exista en la base ni en el archivo | Cargas incrementales |
| `replace` | Marca la carga previa del mismo archivo como `revertida` y reinserta sus hechos en una transacción | Corrección de un archivo |

`carga.hash_archivo` es **único entre cargas vigentes** (índice parcial del Paso 1): subir dos veces el mismo archivo en modo `append` no duplica nada y devuelve `filas_insertadas = 0`. En `replace`, la carga anterior pasa a `revertida` y sus hechos se borran antes de reinsertar, para que no sigan sumando.

---

## 7. Código de referencia (esqueleto)

```ts
// apps/api/src/etl/load-xlsx.ts
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { Decimal } from "decimal.js";
import ExcelJS from "exceljs";

import { pool } from "../db.js";
import { resolverMotivo, validarFila } from "./reglas.js";

const HOJAS = ["REGISTRO_MERMAS", "MAESTRO_MATERIALES", "CATALOGO_MOTIVOS"];
const UMBRAL_CANTIDAD = new Decimal("10000000");

type Material = {
  codigo: number;
  descripcion: string;
  um: string;
  valorUnitario: string; // siempre texto: nunca pasa por number
  grupoMaterial: string;
  programa: string;
  unidadesPorPallet: number;
};

type Modo = "dry-run" | "append" | "replace";

export async function hashArchivo(ruta: string): Promise<string> {
  return createHash("sha256").update(await readFile(ruta)).digest("hex");
}

export function hashFila(fecha: string, codigo: number, cantidad: string, motivo: string): string {
  const crudo = `${fecha}|${codigo}|${new Decimal(cantidad).toFixed(4)}|${motivo.trim().toUpperCase()}`;
  return createHash("sha256").update(crudo, "utf8").digest("hex");
}

export function costoTotal(cantidad: string, valorUnitario: string): string {
  return new Decimal(cantidad)
    .times(valorUnitario)
    .toSignificantDigits(15)
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed(4);
}

/** Semana ISO 8601 (lunes = 1), equivalente a WEEKNUM(fecha; 21). */
function semanaISO(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86_400_000 + 1) / 7);
}

const texto = (celda: ExcelJS.Cell) => celda.text.replace(/\s+/g, " ").trim();

function fechaISO(valor: ExcelJS.CellValue): string | null {
  // exceljs devuelve Date para celdas con formato de fecha; un serial crudo se rechaza
  return valor instanceof Date ? valor.toISOString().slice(0, 10) : null;
}

async function leerCatalogo(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet("CATALOGO_MOTIVOS");
  if (!ws) throw new Error("Falta la hoja CATALOGO_MOTIVOS");
  const filas = [];
  for (let nro = 5; nro <= 17; nro++) {
    const fila = ws.getRow(nro);
    const codigo = texto(fila.getCell(1)).toUpperCase();
    if (!codigo) continue;
    filas.push({
      codigo,
      categoria: texto(fila.getCell(2)),
      areaResponsable: texto(fila.getCell(3)),
      gestionabilidad: texto(fila.getCell(4)),
      accionCorrectiva: texto(fila.getCell(5)),
    });
  }
  return filas;
}

async function leerMaestro(wb: ExcelJS.Workbook): Promise<Material[]> {
  const ws = wb.getWorksheet("MAESTRO_MATERIALES");
  if (!ws) throw new Error("Falta la hoja MAESTRO_MATERIALES");
  const filas: Material[] = [];
  for (let nro = 5; nro <= 112; nro++) {
    const fila = ws.getRow(nro);
    const codigo = Number(fila.getCell(1).value);
    if (!Number.isInteger(codigo)) continue;
    filas.push({
      codigo,
      descripcion: texto(fila.getCell(2)),
      um: texto(fila.getCell(3)),
      valorUnitario: new Decimal(String(fila.getCell(4).value)).toFixed(10),
      grupoMaterial: texto(fila.getCell(6)).toUpperCase(),
      programa: texto(fila.getCell(7)).toUpperCase(),
      unidadesPorPallet: Number(fila.getCell(8).value),
    });
  }
  return filas;
}

export async function ejecutar(ruta: string, modo: Modo = "append") {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);

  const faltantes = HOJAS.filter((h) => !wb.getWorksheet(h));
  if (faltantes.length) throw new Error(`Faltan hojas: ${faltantes.join(", ")}`);

  const catalogo = await leerCatalogo(wb);
  const maestro = new Map((await leerMaestro(wb)).map((m) => [m.codigo, m]));
  const archivoHash = await hashArchivo(ruta);

  const reporte = {
    archivo: path.basename(ruta),
    archivoHash,
    modo,
    leidas: 0,
    insertadas: 0,
    costoTotal: "0.0000",
    errores: [] as unknown[],
    observaciones: [] as unknown[],
    porEstado: { ok: 0, observada: 0, error: 0 },
  };

  // 1) Validar y construir los eventos en memoria, sin tocar la base
  const eventos: Array<Record<string, unknown>> = [];
  const vistos = new Set<string>();
  const ws = wb.getWorksheet("REGISTRO_MERMAS")!;
  let acumulado = new Decimal(0);

  for (let nro = 5; nro <= ws.rowCount; nro++) {
    const fila = ws.getRow(nro);
    const fecha = fechaISO(fila.getCell(4).value);
    if (!fecha) continue; // títulos, subtotal y filas vacías

    reporte.leidas += 1;
    const codigo = Number(fila.getCell(5).value);
    const cantidad = new Decimal(String(fila.getCell(10).value ?? "0"));
    const motivoOriginal = texto(fila.getCell(12));
    const revision = validarFila({ fecha, codigo, cantidad, motivoOriginal, maestro });

    if (revision.estado === "error") {
      reporte.errores.push({ fila: nro, ...revision.observacion });
      reporte.porEstado.error += 1;
      continue;
    }

    const material = maestro.get(codigo)!;
    const costo = costoTotal(cantidad.toFixed(4), material.valorUnitario);
    const h = hashFila(fecha, codigo, cantidad.toFixed(4), motivoOriginal);

    eventos.push({
      fecha,
      semanaIso: semanaISO(new Date(`${fecha}T00:00:00Z`)),
      mes: fecha.slice(0, 7),
      codigoMaterial: codigo,
      cantidad: cantidad.toFixed(4),
      motivoCodigo: resolverMotivo(motivoOriginal),
      motivoOriginal,
      valorUnitario: material.valorUnitario,
      costoTotal: costo,
      origenFila: nro,
      hashFila: h,
      esDuplicado: vistos.has(h),
    });
    vistos.add(h);

    reporte.insertadas += 1;
    acumulado = acumulado.plus(costo);
    reporte.porEstado[revision.estado] += 1;
    if (revision.observacion) reporte.observaciones.push({ fila: nro, ...revision.observacion });
  }
  reporte.costoTotal = acumulado.toFixed(4);

  if (modo === "dry-run") return escribirReporte(reporte);

  // 2) Insertar catálogo, maestro, carga y hechos en una sola transacción
  const client = await pool.connect();
  try {
    await client.query("begin");

    for (const m of maestro.values()) {
      await client.query(
        `insert into merma.dim_material
           (codigo, descripcion, um, valor_unitario, grupo_material, programa, unidades_por_pallet)
         values ($1,$2,$3,$4,$5,$6,$7)
         on conflict (codigo) do update set
           descripcion = excluded.descripcion, um = excluded.um,
           valor_unitario = excluded.valor_unitario, grupo_material = excluded.grupo_material,
           programa = excluded.programa, unidades_por_pallet = excluded.unidades_por_pallet`,
        [m.codigo, m.descripcion, m.um, m.valorUnitario, m.grupoMaterial, m.programa, m.unidadesPorPallet],
      );
    }
    for (const c of catalogo) {
      await client.query(
        `insert into merma.dim_motivo
           (codigo, categoria, area_responsable, gestionabilidad, accion_correctiva)
         values ($1,$2,$3,$4,$5)
         on conflict (codigo) do update set
           categoria = excluded.categoria, area_responsable = excluded.area_responsable,
           gestionabilidad = excluded.gestionabilidad, accion_correctiva = excluded.accion_correctiva`,
        [c.codigo, c.categoria, c.areaResponsable, c.gestionabilidad, c.accionCorrectiva],
      );
    }

    // append: si el archivo ya está cargado, no se reinserta nada (idempotencia)
    const previa = await client.query<{ id: number }>(
      `select id from merma.carga
        where hash_archivo = $1 and estado in ('en_proceso','completada')`,
      [archivoHash],
    );
    if (previa.rowCount && modo === "append") {
      await client.query("commit");
      return escribirReporte({ ...reporte, insertadas: 0, yaCargado: true });
    }

    // append entre archivos distintos: no reinsertar hechos ya presentes en la base
    const yaEnBase = new Set<string>();
    if (modo === "append" && eventos.length > 0) {
      const fechas = eventos.map((e) => e.fecha as string).sort();
      const { rows } = await client.query<{ hash_fila: string }>(
        `select hash_fila from merma.fact_merma where fecha between $1 and $2`,
        [fechas[0], fechas[fechas.length - 1]],
      );
      for (const fila of rows) yaEnBase.add(fila.hash_fila);
      for (const evento of eventos) {
        if (yaEnBase.has(evento.hashFila as string)) evento.esDuplicado = true;
      }
    }
    const aInsertar = modo === "append"
      ? eventos.filter((e) => !yaEnBase.has(e.hashFila as string))
      : eventos;
    reporte.insertadas = aInsertar.length;
    reporte.costoTotal = aInsertar
      .reduce((acc, e) => acc.plus(e.costoTotal as string), new Decimal(0))
      .toFixed(4);

    // replace: la carga anterior queda como historial y sus hechos se borran
    // (si no, seguirían sumando en las consultas, que no filtran por carga)
    if (modo === "replace" && previa.rowCount) {
      const ids = previa.rows.map((r) => r.id);
      await client.query(`update merma.carga set estado = 'revertida' where id = any($1::bigint[])`, [ids]);
      await client.query(`delete from merma.fact_merma where carga_id = any($1::bigint[])`, [ids]);
    }

    const { rows: [carga] } = await client.query<{ id: number }>(
      `insert into merma.carga (archivo, hash_archivo, modo, estado)
       values ($1,$2,$3,'en_proceso') returning id`,
      [reporte.archivo, archivoHash, modo],
    );

    // 500 filas por INSERT: 1,795 filas en 4 viajes, no 1,795
    for (let i = 0; i < aInsertar.length; i += 500) {
      const lote = aInsertar.slice(i, i + 500);
      const valores: unknown[] = [carga.id];
      const tuplas = lote.map((e, j) => {
        const base = j * 12 + 2;
        valores.push(
          e.fecha, e.semanaIso, e.mes, e.codigoMaterial, e.cantidad, e.motivoCodigo,
          e.motivoOriginal, e.valorUnitario, e.costoTotal, e.origenFila, e.hashFila, e.esDuplicado,
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

    await client.query(
      `update merma.carga
          set estado = 'completada', filas_leidas = $2, filas_insertadas = $3, detalle = $4
        where id = $1`,
      [carga.id, reporte.leidas, reporte.insertadas, JSON.stringify(reporte)],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return escribirReporte(reporte);
}

async function escribirReporte(reporte: object) {
  const dir = path.resolve("data/reports");
  await mkdir(dir, { recursive: true });
  const destino = path.join(dir, `carga-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(destino, JSON.stringify(reporte, null, 2), "utf8");
  return { ...reporte, reporte: destino };
}

// CLI: npm run etl -- --file <ruta.xlsx> --mode dry-run
const { values } = parseArgs({
  options: {
    file: { type: "string" },
    mode: { type: "string", default: "append" },
  },
});
if (!values.file) throw new Error("Falta --file");
console.log(JSON.stringify(await ejecutar(values.file, values.mode as Modo), null, 2));
```

> El lote de 500 se arma con parámetros vinculados, no con interpolación de valores. Con 1,795 filas son 4 viajes a la base; el patrón queda listo para años siguientes. `reporte.insertadas` y `reporte.costoTotal` reflejan **lo que realmente se insertó**: en `append` se descuentan los hashes que ya estaban en la base, y en `dry-run` se informa lo que se insertaría.

---

## 8. Reporte de carga

Se escribe en `data/reports/carga-<timestamp>.json` y se guarda el resumen en `carga.detalle` (JSONB):

```json
{
  "archivo": "REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx",
  "hash": "9f2c…",
  "modo": "append",
  "leidas": 1795,
  "insertadas": 1795,
  "omitidas_por_existir": 0,
  "duplicadas": 4,
  "errores": 0,
  "observaciones": 7,
  "filas_observadas": 7,
  "desde": "2026-05-08",
  "hasta": "2026-11-23",
  "costo_total": "20383.7525",
  "por_estado": { "ok": 1788, "observada": 7, "error": 0 },
  "motivos_alias": [{ "motivo": "MALA IMPRESIÓN", "filas": [1640, 1741, 1777], "costo": "39.3084" }],
  "motivos_no_catalogados": [],
  "posibles_duplicados": [
    { "fecha": "2026-07-10", "codigo": 28100022, "cantidad": "90.0000", "filas": [353, 354], "costo_extra": "0.3262" }
  ],
  "duracion_ms": 2140
}
```

El reporte es un **entregable del producto**, no un log técnico: alimenta el panel de alertas del Paso 4.

---

## 9. Seed reproducible para desarrollo

```bash
# 1. Base local
docker compose up -d db
cd apps/api && npm run db:migrate

# 2. Carga (desde apps/api)
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode append

# 3. Verificación rápida
psql "$DATABASE_URL" -c "select count(*), sum(costo_total) from merma.fact_merma;"
# esperado: 1795 | 20383.7525
```

Para CI y pruebas se usa un `fixture` de 40 filas representativas (no el archivo completo) y un test de contrato que valida el total de 1,795 con el archivo real marcado como `slow`.

---

## 10. Entregables del paso

- [x] `src/etl/load-xlsx.ts` con modos `dry-run | append | replace`.
- [x] `src/etl/reglas.ts` con `validarFila()` y `resolverMotivo()`.
- [x] `data/reports/` con el reporte de la carga real.
- [x] `tests/etl.test.ts` y `tests/etl.integration.test.ts`: 14 casos (reglas, redondeo, fechas, alias, duplicados, hojas faltantes, idempotencia y replace).
- [x] Documento `docs/operacion/carga.md` con el comando exacto y qué hacer ante errores.

---

## 11. Criterios de aceptación

| # | Criterio | Resultado esperado |
|---|---|---|
| 1 | Conteo de hechos | 1,795 |
| 2 | Suma de `costo_total` | $20,383.75 (±0.01) |
| 3 | Suma en ventana 08/05–11/11 | $17,999.60 (±0.01) |
| 4 | Eventos en ventana | 1,618 |
| 5 | Materiales | 108 |
| 6 | Motivos | 13 |
| 7 | Sin clasificar | 7 filas, $1,118.13 |
| 8 | Duplicados marcados | 4 |
| 9 | Segunda ejecución en `append` | 0 insertadas, mismo total |
| 10 | `dry-run` no modifica la BD | Conteo idéntico antes/después |
| 11 | Fila con motivo inexistente | Se inserta como `SIN CLASIFICAR` + observación, no se pierde |
| 12 | Fila con fecha nula | Se reporta y no se inserta |

---

## 12. Riesgos del paso

| Riesgo | Mitigación |
|---|---|
| El archivo se reemplaza por una versión con menos filas | `replace` exige `--confirm` y guarda el reporte anterior |
| Excel guarda números como texto (`"75"`) | `new Decimal(String(cell.value))`, que acepta texto y falla con valores no numéricos |
| Fechas como serial de Excel | `exceljs` las entrega como `Date`; un serial numérico se rechaza con `FECHA_INVALIDA` |
| Tildes inconsistentes (`IMPRESIÓN` vs `IMPRESION`) | Alias + normalización Unicode (`unicodedata.normalize("NFC")`) |
| El maestro trae precios con 10 decimales | `numeric(16,10)` en la base y `decimal.js` en Node; nunca `number` |

---

**Siguiente paso:** [`05-PASO-03-API-EN-RENDER.md`](./05-PASO-03-API-EN-RENDER.md).
