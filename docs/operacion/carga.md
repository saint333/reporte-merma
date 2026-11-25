# Operación · Carga del Excel

**Paso:** 2 · ETL
**Requiere:** Postgres con migraciones aplicadas.

---

## 1. Preparación

```bash
docker compose up -d db
cd apps/api
npm install
cp .env.example .env
npm run db:migrate
```

El archivo fuente no se versiona (decisión D6). Se pasa por ruta absoluta o relativa.

---

## 2. Modos

| Modo | Qué hace | Cuándo usarlo |
|---|---|---|
| `dry-run` | Lee, valida y escribe el reporte. **No escribe en la base.** | Antes de cada carga |
| `append` | Inserta los hechos nuevos y omite los `hash_fila` que ya existen | Carga diaria o semanal |
| `replace` | Marca la carga vigente del mismo archivo como `revertida`, borra sus hechos y reinserta todo | Corrección del mismo archivo |

```bash
# Validación sin escritura
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode dry-run

# Carga incremental
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode append

# Rehacer la carga de un archivo corregido
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode replace --confirm
```

`replace` exige `--confirm` porque borra los hechos de la carga anterior. Todo ocurre en una transacción: si falla, no cambia nada.

---

## 3. Qué lee y qué recalcula

| Se lee del Excel | Se recalcula |
|---|---|
| `REGISTRO_MERMAS` D fecha, E código, J cantidad, L motivo | semana ISO, mes, costo total, hash, duplicados |
| `MAESTRO_MATERIALES` A:H | costo unitario congelado en el hecho |
| `CATALOGO_MOTIVOS` A:E | gestión, área y alias del motivo |

No se usan las columnas calculadas del libro (P, O, etc.): la app recalcula con `decimal.js` y normaliza el producto a 15 dígitos antes de redondear a 4, que es como redondea Excel.

---

## 4. Reporte

Se escribe en `data/reports/carga-<timestamp>.json` y se guarda el resumen en `merma.carga.detalle`.

| Campo | Significado |
|---|---|
| `leidas` | Filas con fecha (incluye errores) |
| `insertadas` | Hechos realmente insertados |
| `omitidas_por_existir` | Filas válidas que ya estaban en la base (`append`) |
| `duplicadas` | Filas repetidas dentro del archivo |
| `errores` / `observaciones` | Conteos de filas rechazadas y de avisos |
| `filas_observadas` | Filas con al menos un aviso |
| `costo_total` | Suma del archivo, en string decimal |
| `motivos_alias` | Motivos resueltos por alias, con filas y costo |
| `motivos_no_catalogados` | Motivos sin catálogo ni alias |
| `posibles_duplicados` | Pares con fecha, código, cantidad, filas y costo extra |
| `detalle_errores` / `detalle_observaciones` | Detalle por fila |

Los reportes generados están en `.gitignore`; el reporte vigente se consulta en la base.

---

## 5. Resultado esperado con el archivo actual

| Métrica | Valor |
|---|---:|
| Filas leídas / insertadas | 1,795 / 1,795 |
| Materiales | 108 |
| Motivos | 13 |
| Costo total | $20,383.7525 |
| Ventana 08/05–11/11 | 1,618 eventos · $17,999.6033 |
| Duplicados | 4 filas · $24.3581 |
| Observaciones | 7 (3 alias + 4 duplicados) |
| `MALA IMPRESIÓN` | 3 filas · $39.3084 → `ERROR DE IMPRESIÓN` |
| `SIN CLASIFICAR` | 7 filas · $1,118.1265 |

---

## 6. Errores y observaciones

| Código | Efecto | Acción |
|---|---|---|
| `FECHA_INVALIDA` | No se inserta | Corregir la celda D de la fila indicada |
| `MATERIAL_NO_REGISTRADO` | No se inserta | Corregir el código o agregarlo al maestro |
| `CANTIDAD_INVALIDA` | No se inserta | La cantidad debe ser numérica y mayor que cero |
| `CANTIDAD_ATIPICA` | Se inserta + aviso | Revisar si son unidades o pallets |
| `FECHA_FUERA_DE_CAMPANIA` | Se inserta + aviso | Confirmar que la fecha es correcta |
| `MOTIVO_ALIAS` | Se inserta + aviso | El alias está en `dim_motivo_alias` |
| `MOTIVO_NO_CATALOGADO` | Se inserta como `SIN CLASIFICAR` + aviso | Agregar el motivo al catálogo |
| `POSIBLE_DUPLICADO` | Se inserta (suma) + aviso | Revisar el par de filas; no se borra solo |
| `PALLET_SINGULAR` | Se inserta + aviso | Material con 1 unidad por pallet |

Si hay errores, corregir el archivo y volver a ejecutar con `replace --confirm`.

---

## 7. Pruebas

```bash
npm test                    # reglas, redondeo, fechas y hojas faltantes
npm run typecheck
```

La prueba de integración se salta si no existe `TEST_DATABASE_URL`. Para habilitarla:

```bash
docker compose exec -T db psql -U merma -d merma -c "create database merma_test;"
DATABASE_URL="postgresql://merma:merma@localhost:5432/merma_test" npm run db:migrate
TEST_DATABASE_URL="postgresql://merma:merma@localhost:5432/merma_test" npm test
```

La prueba exige que el nombre de la base contenga `test` antes de truncar tablas.
