# PASO 1 · MODELO DE DATOS

**Duración estimada:** 0.5 día
**Depende de:** nada
**Bloquea a:** Pasos 2, 3, 4 y 6

**Objetivo:** convertir el libro en un esquema relacional que (a) reproduzca las cifras del Excel al centavo, (b) permita calcular cualquier período sin tocar fórmulas y (c) deje rastro de cada carga y de cada dato dudoso.

---

## 1. Principios de diseño

1. **El hecho es el evento, no la fila del Excel.** Cada fila del registro es un evento de merma con fecha, material, cantidad y motivo.
2. **Lo derivado no se guarda dos veces.** `mes`, `semana_iso`, `pallets`, `% participación`, `clase ABC` se calculan en consulta o al momento de insertar como snapshot justificado.
3. **El costo se congela.** Se guarda el `valor_unitario` aplicado y el `costo_total` calculado, no solo la FK al material. Si mañana cambia el precio del material, el histórico no se mueve.
4. **Nada se borra.** Los duplicados y motivos inválidos se marcan, no se eliminan. El reporte de calidad es parte del producto.
5. **Los catálogos son la ley.** `motivo` es FK; el texto original se conserva aparte para auditar.

---

## 2. Diagrama entidad-relación

```text
 dim_motivo 1 ──── n dim_motivo_alias
      │ 1
      │
      │ n
 carga 1 ──── n fact_merma n ──── 1 dim_material
                     │
                     └── (snapshot: valor_unitario, costo_total, motivo_original)

 parametro (clave/valor)  ← escenarios de proyección
```

No hay tabla de programas ni de familias: son atributos del material (`programa`, `grupo_material`) y se normalizarán en fase 2 si el negocio lo pide. Se documenta la limitación H9.

---

## 3. DDL (PostgreSQL 16)

```sql
-- ============================================================
-- 0. Extensiones y esquema
-- ============================================================
create schema if not exists merma;
set search_path to merma, public;

-- ============================================================
-- 1. Catálogo de motivos (13 filas)
-- ============================================================
create table merma.dim_motivo (
  codigo             text primary key,          -- 'ROTURA DE EMBALAJES'
  categoria          text not null,
  area_responsable   text not null,
  gestionabilidad    text not null
                     check (gestionabilidad in
                       ('Controlable','Estándar Técnico','Por Auditar','Recuperable Proveedor')),
  accion_correctiva  text,
  activo             boolean not null default true
);

-- Alias para unificar variantes de digitación (MALA IMPRESIÓN, etc.)
create table merma.dim_motivo_alias (
  alias          text primary key,
  motivo_codigo  text not null references merma.dim_motivo(codigo),
  creado_en      timestamptz not null default now()
);

-- ============================================================
-- 2. Catálogo de materiales (108 filas)
-- ============================================================
create table merma.dim_material (
  codigo               bigint primary key,       -- ID FRUSYS
  descripcion          text not null,
  um                   text not null,            -- UNI, UND, MTS, MIL, ROL
  valor_unitario       numeric(16,10) not null check (valor_unitario >= 0),
  cod_subgrupo         text,
  grupo_material       text not null,            -- ETIQUETAS, CLAMSHELL, ...
  programa             text not null,            -- GENÉRICO, UNITED EXPORT, ...
  unidades_por_pallet  integer not null check (unidades_por_pallet > 0),
  activo               boolean not null default true,
  actualizado_en       timestamptz not null default now()
);

create index ix_material_grupo    on merma.dim_material (grupo_material);
create index ix_material_programa on merma.dim_material (programa);

-- ============================================================
-- 3. Control de cargas
-- ============================================================
create table merma.carga (
  id                bigserial primary key,
  archivo           text not null,
  hash_archivo      text not null,               -- sha256 del .xlsx
  filas_leidas      integer not null default 0,
  filas_insertadas  integer not null default 0,
  filas_duplicadas  integer not null default 0,
  filas_observadas  integer not null default 0,  -- motivo inválido, fecha fuera de rango
  desde             date,
  hasta             date,
  estado            text not null default 'en_proceso'
                    check (estado in ('en_proceso','completada','fallida','revertida')),
  detalle           jsonb not null default '{}'::jsonb,
  creada_en         timestamptz not null default now()
);

-- Una sola carga vigente por archivo. Las revertidas se conservan como historial,
-- por eso el índice es parcial y no un unique de columna.
create unique index ux_carga_hash_vigente
  on merma.carga (hash_archivo)
  where estado in ('en_proceso', 'completada');

-- ============================================================
-- 4. Hecho: eventos de merma
-- ============================================================
create table merma.fact_merma (
  id                  bigserial primary key,
  carga_id            bigint not null references merma.carga(id),
  fecha               date not null,
  semana_iso          smallint not null check (semana_iso between 1 and 53),
  mes                 char(7) not null,          -- 'YYYY-MM'
  codigo_material     bigint not null references merma.dim_material(codigo),
  cantidad            numeric(16,4) not null check (cantidad > 0),
  motivo_codigo       text not null references merma.dim_motivo(codigo),
  motivo_original     text,                      -- texto tal como se digitó
  valor_unitario      numeric(16,10) not null,   -- snapshot
  costo_total         numeric(16,4) not null check (costo_total >= 0),
  origen_fila         integer,                   -- fila del Excel (trazabilidad)
  hash_fila           text not null,             -- sha256(fecha|codigo|cantidad|motivo)
  es_duplicado        boolean not null default false,
  creado_en           timestamptz not null default now()
);

create index ix_fact_fecha      on merma.fact_merma (fecha);
create index ix_fact_mes        on merma.fact_merma (mes);
create index ix_fact_semana     on merma.fact_merma (semana_iso);
create index ix_fact_material   on merma.fact_merma (codigo_material);
create index ix_fact_motivo     on merma.fact_merma (motivo_codigo);
create index ix_fact_hash       on merma.fact_merma (hash_fila);
create index ix_fact_dup        on merma.fact_merma (es_duplicado) where es_duplicado;

-- ============================================================
-- 5. Parámetros de escenario (editables desde la UI, fase 2)
-- ============================================================
create table merma.parametro (
  clave        text primary key,
  valor        numeric(16,6) not null,
  etiqueta     text not null,
  descripcion  text,
  actualizado_en timestamptz not null default now()
);

insert into merma.parametro (clave, valor, etiqueta, descripcion) values
  ('meta_reduccion_controlable', 0.25,  'Meta de reducción', 'Objetivo sobre la merma controlable (C9 del Excel)'),
  ('semanas_restantes',          6,     'Semanas restantes', 'Horizonte de proyección al cierre (C8 del Excel)'),
  ('umbral_semana_atipica',      3000,  'Umbral de atípico', 'Semanas con costo menor se usan para el promedio ajustado (C7)');
```

---

## 4. Vistas de apoyo

```sql
-- Vista plana: evita repetir joins en cada consulta
create or replace view merma.v_registro as
select
  r.id,
  r.fecha,
  r.mes,
  r.semana_iso,
  r.codigo_material,
  m.descripcion,
  m.um,
  m.grupo_material as familia,
  m.programa,
  m.unidades_por_pallet,
  r.cantidad,
  (r.cantidad / m.unidades_por_pallet)::numeric(16,6) as pallets_equiv,
  r.motivo_codigo,
  mo.gestionabilidad as gestion,
  mo.area_responsable,
  r.valor_unitario,
  r.costo_total,
  r.es_duplicado,
  r.carga_id
from merma.fact_merma r
join merma.dim_material m on m.codigo = r.codigo_material
join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo;

-- Pareto ABC calculado (no depende del orden físico de las filas)
create or replace view merma.v_abc as
with base as (
  select codigo_material,
         count(*)              as eventos,
         sum(cantidad)         as cantidad,
         sum(costo_total)      as costo
  from merma.fact_merma
  group by codigo_material
), ordenado as (
  select b.*,
         sum(costo) over ()                                    as costo_total_global,
         sum(costo) over (order by costo desc, codigo_material
                          rows between unbounded preceding and current row) as costo_acumulado
  from base b
)
select o.*,
       (costo / nullif(costo_total_global,0))::numeric(12,6)                      as participacion,
       (costo_acumulado / nullif(costo_total_global,0))::numeric(12,6)            as participacion_acumulada,
       case
         when costo = 0 then 'Sin Merma'
         when costo_acumulado / nullif(costo_total_global,0) <= 0.80 then 'A (Crítico)'
         when costo_acumulado / nullif(costo_total_global,0) <= 0.95 then 'B (Moderado)'
         else 'C (Bajo)'
       end as clase_abc
from ordenado o;
```

> La vista `v_abc` no se filtra por período: el ABC cambia según el rango. En el Paso 3 se implementa como consulta parametrizada (`?desde&hasta&...`) reutilizando esta misma lógica en `services/abc.ts`. La vista queda para validación manual y para el endpoint sin filtros.
>
> **Los duplicados no se excluyen de los totales.** Se marcan con `es_duplicado = true` y se reportan en el panel de calidad, pero suman, igual que en el Excel. Excluirlos rompería la paridad y escondería un problema operativo que debe revisarse, no silenciarse.

---

## 5. Diccionario de datos (campos clave)

| Tabla.campo | Regla | Ejemplo |
|---|---|---|
| `fact_merma.fecha` | Fecha del evento, no de carga | `2026-11-11` |
| `fact_merma.semana_iso` | `EXTRACT(WEEK FROM fecha)` ISO 8601 (equivale a `WEEKNUM(fecha;21)`) | `46` |
| `fact_merma.mes` | `to_char(fecha,'YYYY-MM')` | `2026-11` |
| `fact_merma.cantidad` | 4 decimales, > 0 | `12000.0000` |
| `fact_merma.valor_unitario` | Copia del maestro en el momento de la carga | `0.0038722407` |
| `fact_merma.costo_total` | `ROUND_HALF_UP(cantidad * valor_unitario, 4)` | `46.4669` |
| `fact_merma.es_duplicado` | `true` si ya existía el mismo `hash_fila` | `false` |
| `dim_material.unidades_por_pallet` | Entero > 0 | `3000000` |
| `parametro.meta_reduccion_controlable` | 0–1 | `0.25` |

### Redondeo: punto crítico de paridad

Excel usa `ROUND()` con **mitad hacia arriba** y evalúa el producto con unos **15 dígitos significativos**, no con el binario exacto. En JavaScript, `number` es un binario de doble precisión y `Math.round()` no reproduce ese comportamiento en los empates (`x.5`), además de arrastrar error al multiplicar precios de 10 decimales. Con 1,795 filas, ignorar esa precisión cambia el total en el cuarto decimal ($20,383.7522 en vez de $20,383.7525).

```ts
// apps/api/src/etl/dinero.ts
import { Decimal } from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function costoTotal(cantidad: string, valorUnitario: string): string {
  return new Decimal(cantidad)
    .times(valorUnitario)
    .toSignificantDigits(15)              // misma precisión que Excel
    .toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
    .toFixed(4);
}
```

En Postgres, `numeric` ya redondea half-up al castear a `numeric(16,4)`. **No usar `number` en ningún punto del cálculo de dinero**: ni en el ETL, ni en la proyección, ni en los porcentajes que se comparan contra el Excel.

---

## 6. Reglas de negocio que el modelo debe soportar

| ID | Regla | Verificación |
|---|---|---|
| R1 | Merma total = suma de `costo_total` de todos los eventos cargados en el rango | Igual a `SUMIFS(P)` |
| R2 | Merma controlable = suma donde `gestion = 'Controlable'` | Igual a `L7` |
| R3 | Evento = 1 fila; ticket = merma total / eventos | Igual a `F8` |
| R4 | Pallets equiv. = `cantidad / unidades_por_pallet` | Igual a `SUM(K)` |
| R5 | Semana ISO = 1–53 calculada desde la fecha | 28 semanas en la ventana |
| R6 | ABC = orden por costo descendente, acumulado ≤80% ⇒ A, ≤95% ⇒ B | 14 SKUs A |
| R7 | Proyección = acumulado + tasa semanal × semanas restantes | Ver fórmulas abajo |
| R8 | Duplicado = mismo fecha+código+cantidad+motivo; se marca y se reporta, **no** se excluye del cálculo | 4 casos |

### Fórmulas de proyección (equivalentes a `PROYECCION_Y_PARETO`)

```text
acumulado      = SUM(costo_total)                              -- C5
tasa_global    = acumulado / semanas_observadas                -- C6 (AVERAGE de la serie semanal)
tasa_ajustada  = AVG(semana_total WHERE semana_total < umbral) -- C7 (AVERAGEIFS "<3000")
proporcion_ctrl= controlable / acumulado                       -- 0.624 antes hardcodeado
tendencial     = acumulado + tasa_global   * semanas_restantes -- I6
base           = acumulado + tasa_ajustada * semanas_restantes -- I7
meta           = acumulado + tasa_ajustada * (1 - meta_reduccion * proporcion_ctrl) * semanas_restantes -- I8
ahorro_meta    = tendencial - meta                             -- J8
```

Nota: `tasa_global` debe calcularse como **promedio de los totales semanales** (28 valores), no como `total / 28` redondeado, para reproducir los $642.8430 del Excel. Con 28 semanas completas ambos coinciden; con semanas parciales no. Se implementará como `AVG()` sobre la serie.

---

## 7. Migraciones y datos iniciales

1. Crear `apps/api/db/migrations/` con archivos `.sql` numerados (`0001_esquema_inicial.sql`, `0002_vistas.sql`, `0003_seeds.sql`).
2. `0001` contiene todo el DDL de la sección 3 (tablas, claves, índices).
3. `0002` crea `v_registro` y `v_abc`.
4. `0003` inserta de forma idempotente `dim_motivo` (13 filas) y `parametro` (3 filas).
5. El maestro se carga desde el Excel en el Paso 2 (no en la migración: son datos de negocio que cambian).
6. Alias iniciales (decisión pendiente D2):
   ```sql
   insert into merma.dim_motivo_alias (alias, motivo_codigo)
   values ('MALA IMPRESIÓN', 'ERROR DE IMPRESIÓN')
   on conflict do nothing;
   ```

Se aplican con `postgres-migrations`, que registra cada archivo en la tabla `migrations` y ejecuta cada uno dentro de una transacción:

```bash
docker compose up -d db
cd apps/api
npm install
cp .env.example .env
npm run db:migrate          # tsx scripts/migrate.ts
npm run db:check            # 6 tablas · 2 vistas · 13 motivos · 3 parámetros
```

**Prohibido:** crear o alterar tablas desde el código de la API al arrancar (`CREATE TABLE IF NOT EXISTS` en `server.ts`). El esquema se aplica solo con `npm run db:migrate`.

---

## 8. Entregables del paso

- [x] `apps/api/db/migrations/*.sql` con las 6 tablas, vistas, índices y seeds.
- [x] `apps/api/scripts/migrate.ts` con la conexión y el orden de ejecución.
- [x] `docs/modelo/diccionario-datos.md` generado desde las migraciones.
- [x] `apps/api/scripts/check_schema.sql`: 6 tablas, 2 vistas, 13 motivos y 3 parámetros (los 108 materiales se validan en el Paso 2).
- [x] Base local levantada con Docker Compose (`postgres:16-alpine`) y migración aplicada.

---

## 9. Criterios de aceptación

| # | Criterio | Cómo se comprueba |
|---|---|---|
| 1 | `npm run db:migrate` corre desde cero sin error | Base vacía + comando |
| 2 | Existen 6 tablas, 2 vistas, 3 parámetros | `npm run db:check` |
| 3 | Ningún campo monetario es `float`/`double` | Inspección del DDL |
| 4 | Insertar un registro con motivo inexistente falla por FK | `insert` de prueba |
| 5 | `v_abc` ordena por costo y asigna A/B/C sin depender del orden de inserción | Insertar en orden aleatorio y comparar |
| 6 | El redondeo de `costo_total` coincide con Excel en 10 filas al azar | Comparación manual documentada |

---

## 10. Riesgos del paso

| Riesgo | Mitigación |
|---|---|
| Un material se reutiliza en otro programa (H9) | Se documenta; fase 2 agrega `programa_evento` opcional |
| `unidades_por_pallet = 1` distorsiona pallets | Se mantiene, pero la UI lo rotula “equiv.” y nunca lo usa para inventario |
| El maestro cambia de precio y el histórico se mueve | `valor_unitario` y `costo_total` son snapshot |
| Motivos con tildes distintas (`Estándar Técnico`) | Se fija el string exacto del catálogo en el check y en los enums |

---

**Siguiente paso:** [`04-PASO-02-ETL-E-INGESTA.md`](./04-PASO-02-ETL-E-INGESTA.md).
