# PASO 3 · API EN RENDER

**Duración estimada:** 3 días
**Depende de:** Pasos 1 y 2
**Bloquea a:** Paso 4 (frontend) y Paso 6 (QA)

**Objetivo:** exponer todos los cálculos del Excel como endpoints de solo lectura, con una única definición de KPI, filtros globales, paginación y alertas de calidad.

---

## 0. Estado de implementación

Implementado en este corte:

| Endpoint | Estado | Código |
|---|---|---|
| `GET /api/v1/salud` | Listo | `src/routes/salud.ts` |
| `GET /api/v1/meta` | Listo | `src/routes/meta.ts` |
| `GET /api/v1/kpis` | Listo | `src/routes/kpis.ts`, `src/services/kpis.ts` |
| `GET /api/v1/series/mensual` | Listo | `src/routes/series.ts`, `src/services/series.ts` |
| `GET /api/v1/series/semanal` | Listo | `src/routes/series.ts`, `src/services/series.ts` |
| `GET /api/v1/cortes/:dimension` | Listo | `src/routes/cortes.ts`, `src/services/cortes.ts` |
| `GET /api/v1/pareto` | Listo | `src/routes/pareto.ts`, `src/services/pareto.ts` |
| `GET /api/v1/proyeccion` | Listo | `src/routes/proyeccion.ts`, `src/services/proyeccion.ts` |
| `GET /api/v1/registros` | Listo | `src/routes/registros.ts`, `src/services/registros.ts` |
| `GET /api/v1/registros.csv` | Listo | `src/routes/registros.ts` |
| `GET /api/v1/alertas` | Listo | `src/routes/alertas.ts`, `src/services/alertas.ts` |

También están listos el parseo Zod de filtros (`src/http/filtros.ts`), el sobre `data/meta`, el formato único de error (incluido `SERIE_INSUFICIENTE` y `RATE_LIMIT`), CORS por lista blanca, `buildApp()` y el arranque con cierre ordenado (`src/server.ts`).

Infraestructura transversal:

- **Caché:** `CacheApi` con `lru-cache` (256 entradas) y TTL de `CACHE_TTL_SECONDS` (60 s por defecto) en `meta`, `kpis`, series, cortes, Pareto, proyección y alertas. Los agregados responden `Cache-Control: public, max-age=<TTL>`.
- **Swagger:** OpenAPI 3.1 en `/openapi.json` y Swagger UI en `/docs`. Los esquemas de query están en `src/http/openapi.ts`; `attachValidation` deja que Zod mantenga los 422.
- **Seguridad:** `@fastify/helmet` (CSP desactivada para permitir Swagger UI) y `@fastify/rate-limit` global, `RATE_LIMIT_MAX` por minuto y respuesta 429 `RATE_LIMIT`.
- **Pendiente fuera de este paso:** `Dockerfile`, `render.yaml` y despliegue corresponden al Paso 5; la generación de tipos TypeScript para el frontend se hará con el cliente del Paso 4.

Notas de implementación:

- La proyección usa solo el rango de fechas e ignora `programa`, `familia`, `mes` y `gestion`, igual que el Excel. La respuesta lo declara en `meta.alcance`.
- `/alertas` toma `motivo-huerfano` del reporte de la última carga completada (`carga.detalle.motivos_alias`), por lo que es una alerta de calidad de ingesta y no desaparece al filtrar por fecha.
- `/registros.csv` no pagina, aplica los mismos filtros y corta en 50,000 filas.

Pruebas:

- `tests/api.test.ts`: dataset fijo en una base de prueba (18 casos: endpoints, filtros, paginación, CSV, 422, CORS, 404, 503, OpenAPI y rate limit).
- `tests/api.parity.test.ts`: cifras de control contra el dataset real (11 casos); se activa con `PARITY_DATABASE_URL`.
- `tests/cache.test.ts`: reutilización por clave y separación de rutas/filtros (2 casos).

```bash
TEST_DATABASE_URL=postgresql://merma:merma@localhost:5432/merma_test npm test
PARITY_DATABASE_URL=postgresql://merma:merma@localhost:5432/merma npm test
```

Resultado actual: **45 pruebas verdes** (18 de API con dataset fijo, 11 de paridad, 14 de ETL y 2 de caché).

---

## 1. Estructura de la app

```text
apps/api/
├── src/
│   ├── server.ts          # listen(PORT) + cierre ordenado (SIGTERM)
│   ├── app.ts             # buildApp(): CORS, helmet, rate limit, Swagger, rutas
│   ├── config.ts          # env validado con Zod
│   ├── db.ts              # Pool de pg + query()
│   ├── http/
│   │   ├── filtros.ts     # esquema Zod + parseo de query params
│   │   ├── errores.ts     # formato único de error y mapa de códigos
│   │   └── cache.ts       # TTL en memoria por hash de filtros
│   ├── routes/
│   │   ├── salud.ts       # /salud
│   │   ├── meta.ts        # /meta
│   │   ├── kpis.ts        # /kpis
│   │   ├── series.ts      # /series/mensual, /series/semanal
│   │   ├── cortes.ts      # /cortes/{motivos|familias|programas|gestion}
│   │   ├── pareto.ts      # /pareto
│   │   ├── proyeccion.ts  # /proyeccion
│   │   ├── registros.ts   # /registros + /registros.csv
│   │   └── alertas.ts     # /alertas
│   └── services/
│       ├── where.ts       # WHERE reutilizable y parametrizado
│       ├── metricas.ts    # kpis, series, cortes
│       ├── abc.ts         # Pareto
│       ├── proyeccion.ts  # escenarios
│       └── alertas.ts     # reglas de calidad
├── db/migrations/         # los .sql del Paso 1
├── scripts/migrate.ts     # aplica migraciones con postgres-migrations
├── tests/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── Dockerfile
```

---

## 2. Filtros globales (`http/filtros.ts`)

Los mismos 4 slicers del Excel, más el rango de fechas:

| Parámetro | Tipo | Ejemplo | Regla |
|---|---|---|---|
| `desde` | `date` | `2026-05-08` | ≤ `hasta` |
| `hasta` | `date` | `2026-11-11` | ≤ hoy + 1 día |
| `mes` | `str` CSV | `2026-09` o `2026-09,2026-10` | formato `YYYY-MM` |
| `programa` | `str` CSV | `GENÉRICO,UNIFRUTTI` | valores de `/meta` |
| `familia` | `str` CSV | `ETIQUETAS,CLAMSHELL` | valores de `/meta` |
| `gestion` | `str` CSV | `Controlable` | valores de `/meta` |

- `TODOS` **no** se envía: la ausencia del parámetro significa “sin filtro” (equivalente al comodín `"*"` del Excel).
- Se aceptan valores repetidos o separados por coma; se normalizan a lista.
- Un valor desconocido devuelve **422** con el código `FILTRO_INVALIDO`, no una lista vacía silenciosa.

```ts
// apps/api/src/http/filtros.ts
import { z } from "zod";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Se espera YYYY-MM-DD");
const csv = z
  .string()
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.string().min(1)).min(1));

export const esquemaFiltros = z
  .strictObject({
    desde: fecha,
    hasta: fecha,
    mes: csv.optional(),
    programa: csv.optional(),
    familia: csv.optional(),
    gestion: csv.optional(),
  }) // un typo como `program` falla con 422, no se ignora
  .refine((f) => f.desde <= f.hasta, { message: "desde no puede superar a hasta", path: ["desde"] });
// Además: `hasta` no puede ser posterior a hoy + 1 día (fecha de America/Lima).

export type Filtros = z.infer<typeof esquemaFiltros>;

export function where(f: Filtros): { sql: string; params: unknown[] } {
  const condiciones = ["r.fecha between $1 and $2"];
  const params: unknown[] = [f.desde, f.hasta];
  const agregar = (columna: string, valores: string[] | undefined) => {
    if (!valores?.length) return;
    params.push(valores);
    condiciones.push(`${columna} = any($${params.length}::text[])`);
  };
  agregar("r.mes::text", f.mes);
  agregar("m.programa", f.programa);
  agregar("m.grupo_material", f.familia);
  agregar("mo.gestionabilidad", f.gestion);
  return { sql: condiciones.join(" and "), params };
}
```

Todas las consultas parten de `fact_merma` con `join` a material y motivo. Nunca se filtra por `es_duplicado` (los duplicados suman, ver Paso 1 §R8).

---

## 3. Endpoints

Base: `https://<servicio>.onrender.com/api/v1`

### 3.1 `GET /salud`

```json
{ "estado": "ok", "db": "ok", "version": "1.0.0", "ultima_carga": "2026-11-25T10:12:00-05:00" }
```

- Sin filtros, sin caché, timeout de BD 2 s.
- Si la BD no responde: **503** `BASE_NO_DISPONIBLE`.
- Es el `healthCheckPath` de Render.

### 3.2 `GET /meta`

Devuelve todo lo necesario para pintar la barra de filtros y el encabezado.

```json
{
  "data": {
    "rango": { "min": "2026-05-08", "max": "2026-11-23", "dias": 200 },
    "meses": ["2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11"],
    "programas": ["ALPINE FRESH","GENÉRICO","SUNBELLE","UNIFRUTTI","UNITED EXPORT"],
    "familias": ["BOLSAS","CAJAS","CLAMSHELL","ETIQUETAS","INTERCONECTORES","MOLDES","PALLETS","RIBBON"],
    "gestiones": ["Controlable","Estándar Técnico","Por Auditar","Recuperable Proveedor"],
    "vistas": [
      { "id": "campania-28s", "nombre": "Campaña 28 semanas (corte 11/11)",
        "desde": "2026-05-08", "hasta": "2026-11-11" },
      { "id": "todo", "nombre": "Todo el registro", "desde": "2026-05-08", "hasta": "2026-11-23" }
    ],
    "totales": { "registros": 1795, "materiales": 108, "motivos": 13 },
    "ultima_carga": { "id": 1, "archivo": "…xlsx", "creada_en": "2026-11-25T10:12:00-05:00" }
  },
  "meta": { "...": "..." }
}
```

Las `vistas` resuelven H1/H10: el usuario elige “corte 28 semanas” o “todo”, sin que el sistema mienta.

### 3.3 `GET /kpis`

```json
{
  "data": {
    "merma_total": "17999.6033",
    "eventos": 1618,
    "ticket_promedio": "11.1246",
    "merma_controlable": "11232.0822",
    "controlable_pct": 0.6240,
    "pallets_equiv": "14.898022",
    "skus_con_merma": 79,
    "skus_total": 108,
    "semana_pico": { "semana_iso": 40, "costo": "5579.31" },
    "variacion_ultima_semana": -0.5537
  }
}
```

Definiciones (idénticas al Excel):

| Campo | Fórmula |
|---|---|
| `merma_total` | `SUM(costo_total)` con filtros |
| `eventos` | `COUNT(*)` con filtros |
| `ticket_promedio` | `merma_total / eventos` |
| `merma_controlable` | `SUM` donde `gestion='Controlable'` |
| `controlable_pct` | `controlable / total` |
| `pallets_equiv` | `SUM(cantidad / unidades_por_pallet)` |
| `skus_con_merma` | `COUNT(DISTINCT codigo_material)` con `costo > 0` |
| `semana_pico` | semana con mayor `SUM(costo)` en el rango |

Implementación: **una sola consulta** con CTE para evitar 8 round-trips.

```sql
with base as (
  select r.fecha, r.mes, r.semana_iso, r.costo_total, r.cantidad,
         m.unidades_por_pallet, m.programa, m.grupo_material,
         mo.gestionabilidad, r.codigo_material
  from merma.fact_merma r
  join merma.dim_material m on m.codigo = r.codigo_material
  join merma.dim_motivo  mo on mo.codigo = r.motivo_codigo
  where r.fecha between :desde and :hasta
    and (:mes is null or r.mes = any(:mes))
    and (:programa is null or m.programa = any(:programa))
    and (:familia is null or m.grupo_material = any(:familia))
    and (:gestion is null or mo.gestionabilidad = any(:gestion))
)
select
  sum(costo_total)                                             as merma_total,
  count(*)                                                     as eventos,
  sum(costo_total) filter (where gestionabilidad='Controlable') as merma_controlable,
  sum(cantidad / unidades_por_pallet)                          as pallets_equiv,
  count(distinct codigo_material) filter (where costo_total > 0) as skus_con_merma
from base;
```

### 3.4 `GET /series/mensual`

```json
{ "data": [ { "mes": "2026-05", "eventos": 84, "costo": "162.3657", "participacion": "0.0090" } ] }
```

- Orden ascendente por mes.
- `participacion` calculada sobre el total **del rango filtrado** (no sobre el total global), igual que `H12/$H$19`.

### 3.5 `GET /series/semanal?incluir_wow=true`

```json
{
  "data": [
    { "semana_iso": 19, "inicio": "2026-05-04", "eventos": 1, "costo": "0.2900",
      "wow_costo": null, "wow_pct": null, "es_atipica": false }
  ],
  "resumen": { "semanas": 28, "promedio": "642.8430", "promedio_ajustado": "342.6986", "umbral": "3000.00" }
}
```

- `inicio`: lunes de la semana ISO (`date_trunc('week', fecha)`).
- `wow_costo` = actual − anterior; `wow_pct` = (actual − anterior)/anterior (null si anterior = 0).
- `es_atipica` = costo ≥ `umbral_semana_atipica` (default 3000).
- Reemplaza la hoja oculta `CONSOLIDADO_SEMANAL` y genera cualquier semana, no solo 19–46.

### 3.6 `GET /cortes/{dimension}`

`dimension` ∈ `motivos | familias | programas | gestion`.

```json
{
  "data": [
    { "clave": "CONTRAMUESTRA", "etiqueta": "CONTRAMUESTRA", "gestion": "Estándar Técnico",
      "eventos": 37, "costo": "3594.0076", "participacion": "0.1997", "orden": 1 }
  ],
  "total": { "eventos": 1618, "costo": "17999.6033" }
}
```

- Orden descendente por costo.
- `gestion` solo aplica a motivos (y es el join con la matriz).
- Para `familias`, se agrega `pallets_equiv`.
- Para `programas`, se agrega `pallets_equiv`.

### 3.7 `GET /pareto?limite=15`

```json
{
  "data": [
    { "rank": 1, "codigo": 13060001, "descripcion": "BOLSA ATMOSFERA…", "familia": "BOLSAS",
      "programa": "GENÉRICO", "eventos": 6, "cantidad": "13875.0000",
      "costo": "3885.0000", "participacion": "0.215838", "acumulado": "0.215838",
      "clase_abc": "A (Crítico)", "prioridad": "CRÍTICO (A)" }
  ],
  "resumen": { "skus": 79, "clase_a": 14, "clase_b": 24, "clase_c": 41,
               "costo_top": "14596.5068", "participacion_top": "0.810935" }
}
```

- `limite` default 15, máximo 108.
- Clase A: acumulado ≤ 0.80; B: ≤ 0.95; C: resto; `Sin Merma` si costo = 0.
- `prioridad` replica el texto del Excel (`CRÍTICO (A)` / `ALTO IMPACTO`).

### 3.8 `GET /proyeccion`

Parámetros opcionales: `meta_reduccion` (0–1, default del `parametro`), `semanas_restantes` (1–52), `umbral_atipico`.

```json
{
  "data": {
    "parametros": {
      "acumulado": "17999.6033", "semanas_observadas": 28,
      "promedio_global": "642.8430", "promedio_ajustado": "342.6986",
      "semanas_excluidas": [39, 40], "semanas_restantes": 6,
      "meta_reduccion": 0.25, "proporcion_controlable": "0.6240"
    },
    "escenarios": [
      { "id": "tendencial", "nombre": "A. Tendencial histórico", "tasa": "642.8430",
        "proyeccion_6s": "3857.0578", "cierre": "21856.6611", "ahorro": "0.0000" },
      { "id": "base", "nombre": "B. Base operativo", "tasa": "342.6986",
        "proyeccion_6s": "2056.1914", "cierre": "20055.7947", "ahorro": "1800.8664" },
      { "id": "meta", "nombre": "C. Meta optimizada", "tasa": "289.2376",
        "proyeccion_6s": "1735.4256", "cierre": "19735.0289", "ahorro": "2121.6323" }
    ]
  }
}
```

Reglas:
- `promedio_global` = `AVG(total semanal)` de las semanas del rango (no `total/semanas`).
- `promedio_ajustado` = `AVG(total semanal WHERE total < umbral)`.
- Si hay menos de 4 semanas válidas: **422** `SERIE_INSUFICIENTE`.
- `proporcion_controlable` se **calcula**; ya no se hardcodea 0.624.
- La proyección es **global** (ignora programa/familia/mes) por diseño, igual que el Excel. La UI lo indica y permite “ver escenario con filtros” en fase 2.

### 3.9 `GET /registros`

| Param | Default | Regla |
|---|---|---|
| `page` | 1 | ≥ 1 |
| `per_page` | 50 | 1–500 |
| `sort` | `fecha` | whitelist: `fecha`, `costo_total`, `cantidad`, `semana_iso` |
| `order` | `desc` | `asc`/`desc` |
| `q` | — | busca en descripción, código o motivo |
| `motivo` | — | código exacto del motivo (para enlaces de alertas) |
| `codigo` | — | código de material (para el detalle del Pareto) |

```json
{
  "data": [
    { "id": 1178, "fecha": "2026-10-02", "semana_iso": 40, "mes": "2026-10",
      "codigo_material": 28100026, "descripcion": "ETIQ. BASE 4.4 OZ JUMBO OZBLU",
      "familia": "ETIQUETAS", "programa": "GENÉRICO", "cantidad": "80514.0000",
      "um": "UNI", "motivo": "SIN CLASIFICAR", "gestion": "Por Auditar",
      "area_responsable": "Supervisor de Turno", "costo_total": "331.7178",
      "es_duplicado": false, "origen_fila": 1178 }
  ],
  "page": { "page": 1, "per_page": 50, "total": 1618, "pages": 33 }
}
```

`GET /registros.csv` acepta los mismos filtros y devuelve `text/csv` con BOM UTF-8 (para Excel), sin paginación, máximo 50,000 filas.

### 3.10 `GET /alertas`

```json
{
  "data": [
    { "id": "sin-clasificar", "severidad": "alta", "icono": "alert-triangle",
      "titulo": "7 registros sin motivo por $1,118.13",
      "detalle": "Todos del 02/10/2026 (semana 40). Requiere cierre con Jefatura de Turno.",
      "accion": { "texto": "Ver registros", "filtro": "/registros?motivo=SIN%20CLASIFICAR" },
      "valor": "1118.1265", "eventos": 7 },
    { "id": "duplicados", "severidad": "media",
      "titulo": "4 posibles duplicados", "valor": "0.0000", "eventos": 4 },
    { "id": "motivo-huerfano", "severidad": "media",
      "titulo": "Motivo no catalogado: MALA IMPRESIÓN", "eventos": 3, "valor": "39.3094" },
    { "id": "pico-semanal", "severidad": "alta",
      "titulo": "La semana 40 concentra 31.0% de la merma", "valor": "5579.3100" },
    { "id": "concentracion-sku", "severidad": "alta",
      "titulo": "1 SKU concentra 21.6% del costo (BOLSA ATMÓSFERA 4KG)", "valor": "3885.0000" },
    { "id": "variacion-wow", "severidad": "media",
      "titulo": "Caída de 55.4% en la última semana", "valor": "-0.5537" }
  ]
}
```

Reglas de generación (todas con datos, ninguna hardcodeada):

| ID | Regla |
|---|---|
| `sin-clasificar` | `gestion = 'Por Auditar'` y agrupación por fecha |
| `duplicados` | `es_duplicado = true` |
| `motivo-huerfano` | `motivo_original` no existe en `dim_motivo` ni en alias |
| `pico-semanal` | semana con mayor costo; `severidad` alta si > 25% del total |
| `concentracion-sku` | SKU con participación > 20% |
| `variacion-wow` | cambio absoluto semanal > 50% |
| `sin-datos` | rango vacío |

---

## 4. Validación, errores y logging

- Zod 4 con `z.strictObject()` en los filtros (un typo como `program` debe fallar con 422, no ignorarse).
- `esquemaFiltros.safeParse(request.query)` en un hook `preHandler`; si falla, se lanza `FiltroInvalido` con los campos y mensajes.
- `app.setErrorHandler` traduce: `ZodError` → 422 `FILTRO_INVALIDO`; errores de `pg` (`ECONNREFUSED`, `57P01`) → 503 `BASE_NO_DISPONIBLE`; resto → 500 `ERROR_INTERNO` sin stack ni SQL.
- Logs JSON con pino (incluido en Fastify): `reqId`, `level`, `ruta`, `ms`, `filtrosHash`, `filas`. Render los captura desde stdout.
- No se loguean datos personales (no hay) ni la cadena de conexión (`redact` de pino).
- `X-Request-ID`: `genReqId` reutiliza el entrante o genera uno; se devuelve en la respuesta.

---

## 5. Caché y rendimiento

| Capa | Mecanismo | TTL |
|---|---|---|
| API | `lru-cache` (máx. 256 entradas) con clave = hash de filtros | 60 s (`CACHE_TTL_SECONDS`) |
| HTTP | `Cache-Control: public, max-age=60` en GET de agregados | 60 s |
| Frontend | TanStack Query `staleTime: 60_000` | 60 s |
| Ingesta | No aplica: el ETL corre en otro proceso | máximo 60 s de desfase |

- Todas las consultas usan `EXPLAIN` en desarrollo; el objetivo p95 < 300 ms con 1,795 filas es holgado.
- No se usa ORM ni query builder para las agregaciones: `pool.query(sql, params)` con parámetros vinculados (evita inyección y permite `FILTER (WHERE …)`).
- La caché vive en el proceso de Render. Con una sola instancia alcanza; si se escala a varias, cada una mantiene su copia y el TTL acota la diferencia. No se intenta invalidar entre procesos: el dato es de solo lectura y 60 s de desfase es aceptable para el negocio.

---

## 6. Contenedor y despliegue en Render

```dockerfile
# apps/api/Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 8000
CMD ["node", "dist/server.js"]
```

```yaml
# render.yaml (raíz del repo)
services:
  - type: web
    name: merma-api
    runtime: docker
    plan: free
    region: virginia          # misma región que Neon (us-east-1)
    dockerfilePath: ./apps/api/Dockerfile
    dockerContext: ./apps/api
    healthCheckPath: /api/v1/salud
    autoDeploy: true
    envVars:
      - key: DATABASE_URL
        sync: false            # se pega en el panel; nunca en el repo
      - key: CORS_ORIGINS
        value: https://merma.netlify.app
      - key: APP_ENV
        value: production
      - key: TZ
        value: America/Lima
      - key: CACHE_TTL_SECONDS
        value: "60"
```

Notas:

- `plan: free` duerme a los 15 min. Ver §8 del documento 02.
- Migraciones: **no** se ejecutan en el arranque ni dentro del contenedor. Se aplican desde local o CI contra Neon: `npm run db:migrate` (ver Paso 5 §3.3). Así la imagen de producción no necesita `tsx` ni credenciales de migración.
- Si se prefiere runtime nativo: `runtime: node`, `rootDir: apps/api`, `buildCommand: npm ci && npm run build`, `startCommand: npm start`. El resultado es el mismo; Docker solo hace el entorno reproducible.

---

## 7. Pruebas

| Archivo | Qué cubre |
|---|---|
| `paridad.test.ts` | Las 8 tablas de cifras de control (tolerancia ±0.01) |
| `endpoints.test.ts` | 200 en cada GET, forma de la respuesta, tipos |
| `filtros.test.ts` | Filtro por mes/programa/familia/gestion; combinaciones; valor inválido → 422 |
| `proyeccion.test.ts` | Escenarios A/B/C y ahorro; serie insuficiente → 422 |
| `registros.test.ts` | Paginación, orden whitelist, búsqueda, CSV |
| `alertas.test.ts` | 6 alertas del archivo actual; rango vacío |

Ejemplo de paridad:

```ts
// apps/api/tests/paridad.test.ts
import { readFileSync } from "node:fs";

import { Decimal } from "decimal.js";
import { expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/valores_excel.json", import.meta.url), "utf8"),
);

const app = await buildApp();
const campania = { desde: fixture.ventana.desde, hasta: fixture.ventana.hasta };
const aCentavos = (v: string) => new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

it("reproduce los KPIs de la campaña", async () => {
  const res = await app.inject({ url: "/api/v1/kpis", query: campania });
  expect(res.statusCode).toBe(200);

  const { data } = res.json();
  expect(aCentavos(data.merma_total).equals(aCentavos(fixture.kpis.merma_total))).toBe(true);
  expect(data.eventos).toBe(1618);
  expect(aCentavos(data.merma_controlable).equals(aCentavos("11232.08"))).toBe(true);
});
```

`fastify.inject()` levanta la app en memoria, sin puerto ni red. Fixtures: la base de prueba se carga una vez en `globalSetup` y cada test corre en una transacción con rollback (o contra un schema temporal), de modo que el orden no altere los totales.

---

## 8. Entregables

- [x] API con 12 endpoints documentados en `/docs` (Swagger UI sobre OpenAPI 3.1), incluido `POST /cargas`.
- [x] `openapi.json` exportado y tipos generados para el frontend (`npm run api:types`).
- [x] `Dockerfile` + `render.yaml` funcionando.
- [x] Suite de pruebas verde (37 pruebas + 11 de paridad).
- [x] Colección de ejemplos `docs/api/ejemplos.http`.

---

## 9. Criterios de aceptación

| # | Criterio |
|---|---|
| 1 | `/salud` responde 200 con BD conectada y 503 sin ella |
| 2 | `/kpis` con el rango completo devuelve $20,383.75 y 1,795 eventos |
| 3 | `/kpis` con 08/05–11/11 devuelve $17,999.60 y 1,618 eventos |
| 4 | `/pareto` devuelve 14 SKUs clase A y $14,596.51 en el top 15 |
| 5 | `/proyeccion` devuelve $21,856.66 / $20,055.79 / $19,735.03 |
| 6 | Un filtro inexistente devuelve 422 con `FILTRO_INVALIDO` |
| 7 | `page=0` o `per_page=9999` devuelve 422 |
| 8 | El CSV abre en Excel con tildes correctas |
| 9 | p95 < 300 ms en local con el dataset completo |
| 10 | CORS rechaza un origen no listado |

---

**Siguiente paso:** [`06-PASO-04-FRONTEND-EN-NETLIFY.md`](./06-PASO-04-FRONTEND-EN-NETLIFY.md).
