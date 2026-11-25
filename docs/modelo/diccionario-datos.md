# Diccionario de datos

Esquema `merma` en PostgreSQL 16. Fuente de verdad: `apps/api/db/migrations/`.
Este documento describe el estado que dejan `0001_esquema_inicial.sql`,
`0002_vistas.sql` y `0003_seeds.sql`. Si cambia una migración, actualízalo en el
mismo commit.

```text
dim_motivo ──< dim_motivo_alias
     │
     └──< fact_merma >── dim_material
                │
                └──< carga
parametro (independiente)
```

## 1. `merma.dim_motivo` — catálogo de motivos

13 filas. La clave es el texto normalizado del motivo tal como aparece en el libro.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `codigo` | `text` | no | — | PK. Motivo normalizado en mayúsculas (`ERROR DE IMPRESIÓN`). |
| `categoria` | `text` | no | — | Agrupación funcional (`Operativa - Manipulación`). |
| `area_responsable` | `text` | no | — | Área que ejecuta la acción correctiva. |
| `gestionabilidad` | `text` | no | — | `Controlable`, `Estándar Técnico`, `Por Auditar` o `Recuperable Proveedor`. |
| `accion_correctiva` | `text` | sí | — | Contramedida sugerida. |
| `activo` | `boolean` | no | `true` | Permite retirar un motivo sin borrar historia. |

## 2. `merma.dim_motivo_alias` — variantes de digitación

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `alias` | `text` | no | — | PK. Texto alternativo encontrado en el Excel. |
| `motivo_codigo` | `text` | no | — | FK → `dim_motivo.codigo`. Motivo canónico. |
| `creado_en` | `timestamptz` | no | `now()` | Auditoría. |

El alias no reescribe el hecho: `fact_merma.motivo_original` conserva el texto del
archivo (decisión D2).

## 3. `merma.dim_material` — catálogo de materiales

108 filas, cargadas por el ETL desde la hoja de catálogo.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `codigo` | `bigint` | no | — | PK. Código SAP del material. |
| `descripcion` | `text` | no | — | Descripción comercial. |
| `um` | `text` | no | — | Unidad de medida (`UND`, `KG`, `BOLSA`). |
| `valor_unitario` | `numeric(16,10)` | no | — | Costo unitario; `>= 0`. |
| `cod_subgrupo` | `text` | sí | — | Subgrupo del maestro. |
| `grupo_material` | `text` | no | — | Familia usada por el filtro `familia` (`BOLSAS`, `ETIQUETAS`, …). |
| `programa` | `text` | no | — | Programa productivo; hoy es atributo del material, no del evento (D4). |
| `unidades_por_pallet` | `integer` | no | — | `> 0`. Base del cálculo de pallets equivalentes. |
| `activo` | `boolean` | no | `true` | Baja lógica. |
| `actualizado_en` | `timestamptz` | no | `now()` | Última actualización del catálogo. |

Índices: `ix_material_grupo (grupo_material)`, `ix_material_programa (programa)`.

## 4. `merma.carga` — control de cargas del Excel

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `bigserial` | no | — | PK. |
| `archivo` | `text` | no | — | Nombre del `.xlsx`. |
| `hash_archivo` | `text` | no | — | SHA-256 del archivo; base de la idempotencia. |
| `filas_leidas` | `integer` | no | `0` | Filas de datos leídas. |
| `filas_insertadas` | `integer` | no | `0` | Filas nuevas escritas. |
| `filas_duplicadas` | `integer` | no | `0` | Duplicados detectados dentro del archivo. |
| `filas_observadas` | `integer` | no | `0` | Filas con observación de calidad. |
| `desde` / `hasta` | `date` | sí | — | Rango de fechas cargado. |
| `estado` | `text` | no | `en_proceso` | `en_proceso`, `completada`, `fallida` o `revertida`. |
| `detalle` | `jsonb` | no | `{}` | Reporte del ETL (errores, observaciones, alias). |
| `creada_en` | `timestamptz` | no | `now()` | Marca de tiempo. |

Restricción clave: `ux_carga_hash_vigente` es un índice único **parcial** sobre
`hash_archivo` para los estados `en_proceso` y `completada`. Permite recargar un
archivo después de revertirlo sin perder el historial.

## 5. `merma.fact_merma` — eventos de merma

Granularidad: una fila del libro = un evento. 1,795 filas con el archivo actual.

| Columna | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|
| `id` | `bigserial` | no | — | PK. |
| `carga_id` | `bigint` | no | — | FK → `carga.id`; permite revertir una carga completa. |
| `fecha` | `date` | no | — | Fecha del evento (zona `America/Lima`). |
| `semana_iso` | `smallint` | no | — | Semana ISO-8601, `1..53`. |
| `mes` | `char(7)` | no | — | `YYYY-MM`. |
| `codigo_material` | `bigint` | no | — | FK → `dim_material.codigo`. |
| `cantidad` | `numeric(16,4)` | no | — | Cantidad mermada; `> 0`. |
| `motivo_codigo` | `text` | no | — | FK → `dim_motivo.codigo` (canónico). |
| `motivo_original` | `text` | sí | — | Texto tal como vino en el Excel. |
| `valor_unitario` | `numeric(16,10)` | no | — | Copia del valor del material al momento de la carga. |
| `costo_total` | `numeric(16,4)` | no | — | `cantidad * valor_unitario`; `>= 0`. |
| `origen_fila` | `integer` | sí | — | Número de fila en la hoja para trazabilidad. |
| `hash_fila` | `text` | no | — | Huella de la fila; evita insertar dos veces el mismo evento. |
| `es_duplicado` | `boolean` | no | `false` | Marca duplicados dentro del archivo; no se excluyen del total (D3). |
| `creado_en` | `timestamptz` | no | `now()` | Auditoría. |

Índices: `fecha`, `mes`, `semana_iso`, `codigo_material`, `motivo_codigo`,
`hash_fila` y uno parcial sobre `es_duplicado = true`.

## 6. `merma.parametro` — parámetros de escenario

| Clave | Valor | Etiqueta | Uso |
|---|---|---|---|
| `meta_reduccion_controlable` | `0.25` | Meta de reducción | Escenario C de proyección (C9 del Excel). |
| `semanas_restantes` | `6` | Semanas restantes | Horizonte al cierre (C8). |
| `umbral_semana_atipica` | `3000` | Umbral de atípico | Semanas por debajo no entran al promedio ajustado (C7). |

Las rutas de proyección aceptan `meta_reduccion`, `semanas_restantes` y
`umbral_atipico` como query params; si faltan, se usan estos valores.

## 7. Vistas

### `merma.v_registro`

Vista plana de `fact_merma` con los atributos del material y del motivo ya
resueltos. Es la base de `/registros`, `/registros.csv`, `/kpis` y de los cortes.
Añade:

| Columna calculada | Fórmula |
|---|---|
| `familia` | `dim_material.grupo_material` |
| `pallets_equiv` | `cantidad / unidades_por_pallet`, `numeric(16,6)` |
| `gestion` | `dim_motivo.gestionabilidad` |

### `merma.v_abc`

Pareto por material sobre **todos** los hechos (sin filtros de fecha), calculado
con funciones de ventana —no con el orden físico de las filas—.

| Columna calculada | Fórmula |
|---|---|
| `participacion` | `costo / costo_total_global` |
| `participacion_acumulada` | acumulado ordenado por `costo desc, codigo_material` |
| `clase_abc` | `<= 0.80` → `A (Crítico)`; `<= 0.95` → `B (Moderado)`; resto `C (Bajo)`; costo 0 → `Sin Merma` |

## 8. Reglas que dependen del esquema

- **Costo:** siempre `cantidad * valor_unitario`, con `numeric` (nunca coma flotante).
- **Semana:** ISO-8601; el pico del periodo es S40, no S39.
- **Idempotencia:** `carga.hash_archivo` para el archivo y `fact_merma.hash_fila` para la fila.
- **Duplicados:** se marcan y se suman; el total debe seguir cuadrando con el libro.
- **Reversión:** `replace` pasa la carga anterior a `revertida` y borra sus hechos por `carga_id`.
- **Catálogos:** un material o motivo inactivo no se borra; los hechos históricos lo siguen referenciando.
