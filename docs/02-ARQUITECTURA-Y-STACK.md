# 02 · ARQUITECTURA Y STACK

**Objetivo:** definir la forma de la solución antes de escribir código: piezas, límites, repositorio, entornos y decisiones técnicas con su justificación.

---

## 1. Vista general

```text
┌──────────────────────────────┐          ┌───────────────────────────────┐
│  NETLIFY (CDN global)        │          │  RENDER (Web Service)         │
│                              │  HTTPS   │                               │
│  React 19 + Vite + TS        │ ───────► │  Node.js 22 + Fastify 5       │
│  Tailwind + Recharts         │  JSON    │  TypeScript 5 + pg (SQL)      │
│  TanStack Query              │ ◄─────── │  Zod + decimal.js             │
│  Build estático → /dist      │          │  /api/v1/*                    │
└──────────────────────────────┘          └──────────────┬────────────────┘
                                                          │ TLS (sslmode=require)
                                                          ▼
                                            ┌───────────────────────────────┐
                                            │  POSTGRES 16                  │
                                            │  Neon (free) — o Render PG    │
                                            │  material, motivo, registro   │
                                            └───────────────────────────────┘

  Fuente inicial: REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK.xlsx
  → script ETL en Node (local o Render Shell) → Postgres
```

**Tres despliegues independientes:**

| Pieza | Plataforma | Tipo | Se redespliega cuando |
|---|---|---|---|
| `apps/web` | Netlify | Sitio estático (build de Vite) | Cambia `main` en `/apps/web` |
| `apps/api` | Render | Web Service Node | Cambia `main` en `/apps/api` |
| Base de datos | Neon | Postgres gestionado | Migraciones manuales |

---

## 2. Stack y justificación

### 2.1 Frontend

| Tecnología | Versión objetivo | Por qué |
|---|---|---|
| React | 19 | Componentes y ecosistema; el equipo lo consigue en el mercado local |
| Vite | 7 | Build en segundos, variables `VITE_*`, salida estática ideal para Netlify |
| TypeScript | 5.x `strict` | El contrato de la API se tipa; evita errores de campos nulos |
| Tailwind CSS | 4 | Replicar el tema oscuro con tokens, sin CSS muerto |
| Recharts | 3 | Columnas, línea, barras y anillo con `ResponsiveContainer`; mismo lenguaje visual que el Excel |
| TanStack Query | 5 | Caché, reintentos, `staleTime`, estados de carga/error por consulta |
| React Router | 7 | 3 rutas: `/`, `/registros`, `/analisis` |
| Zod | 4 | Validar la respuesta en desarrollo (opcional, solo `dev`) |

**Descartado:** Next.js. No hay SEO ni render en servidor que justifique el costo; el tablero es interno y detrás de URL privada. Netlify sirve el `index.html` con rewrite SPA.

### 2.2 Backend

| Tecnología | Versión objetivo | Por qué |
|---|---|---|
| Node.js | 22 LTS | Runtime disponible en Render y en Netlify; mismo lenguaje que la web |
| TypeScript | 5.x `strict` | Contrato, ETL y servicios tipados; los errores aparecen en el build, no en producción |
| Fastify | 5 | HTTP liviano con plugins oficiales (CORS, rate limit, Swagger); serialización JSON rápida |
| pg (node-postgres) | 8 | Pool de conexiones y SQL parametrizado; `numeric` se entrega como string, sin pérdida de centavos |
| Zod | 4 | Validación de filtros y de variables de entorno con mensajes propios |
| decimal.js | 10 | Aritmética decimal con `ROUND_HALF_UP` en ETL y proyección (nunca `number` para dinero) |
| exceljs | 4 | Lectura del `.xlsx` y de sus valores, sin depender de fórmulas cacheadas |
| postgres-migrations | última | Aplica los `.sql` del Paso 1 en orden, con tabla de control |
| Vitest + `fastify.inject()` | últimas | Pruebas de endpoints y de paridad sin abrir puertos ni usar HTTP real |
| pino (incluido en Fastify) | — | Logs JSON a stdout; Render los captura sin configuración extra |
| tsx | 4 | Ejecuta el ETL y los scripts en TypeScript sin paso de build |

**Descartado:** Python/FastAPI. El usuario pidió explícitamente Node.js; además, usar TypeScript en web y API permite compartir los tipos del contrato y evita mantener dos modelos del mismo JSON. La lógica de negocio no existía en Python: se define en este plan y vive en SQL + una capa decimal.

**Descartado:** Express. Fastify ya trae validación, logs estructurados, OpenAPI y rate limit como plugins, con mejor rendimiento y menos middleware escrito a mano.

**Descartado:** NestJS. Su inyección de dependencias y su estructura por módulos son excesivas para 10 endpoints de solo lectura; agrega ceremonia sin resolver ningún problema de este proyecto.

**Descartado:** Netlify Functions. Aunque ahora sería viable en Node, cada invocación efímera abre su propio pool hacia Postgres y el arranque en frío se suma al de la base; además el usuario pidió la API en Render. El cálculo de agregados encaja mejor en un servicio persistente.

### 2.3 Base de datos

PostgreSQL 16. Evaluación:

| Opción | Ventaja | Limitación | Veredicto |
|---|---|---|---|
| **Neon (free)** | Tier gratuito sin fecha de expiración, `DATABASE_URL`, branching, suspensión automática | Cold start de ~1 s tras inactividad | **Recomendado** |
| Render Postgres (free) | Mismo panel que la API, red privada | El plan free **expira a los 30 días** (luego se borra si no se paga) | Alternativa si se acepta el costo |
| SQLite en Render | Cero configuración | Disco efímero: se pierde en cada deploy | **No viable** |

Con 1,795 filas y ~2,000 altas/año, cualquier opción sobra en capacidad. La decisión es operativa, no de volumen.

---

## 3. Estructura del repositorio

```text
reporte-merma/
├── README.md
├── docs/                          # este plan (00–09)
├── data/
│   └── source/
│       └── REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK.xlsx
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── server.ts          # listen(PORT) + cierre ordenado
│   │   │   ├── app.ts             # buildApp(): CORS, helmet, límites, Swagger, rutas
│   │   │   ├── config.ts          # env validado con Zod
│   │   │   ├── db.ts              # Pool de pg + query() tipado
│   │   │   ├── http/
│   │   │   │   ├── filtros.ts     # esquema Zod y parseo de query params
│   │   │   │   ├── errores.ts     # formato único de error
│   │   │   │   └── cache.ts       # TTL en memoria por hash de filtros
│   │   │   ├── routes/
│   │   │   │   ├── salud.ts
│   │   │   │   ├── meta.ts        # catálogos de filtros + rango de fechas
│   │   │   │   ├── kpis.ts
│   │   │   │   ├── series.ts      # mensual, semanal
│   │   │   │   ├── cortes.ts      # motivos, familias, programas, gestión
│   │   │   │   ├── pareto.ts
│   │   │   │   ├── proyeccion.ts
│   │   │   │   ├── registros.ts   # tabla paginada
│   │   │   │   └── alertas.ts
│   │   │   ├── services/
│   │   │   │   ├── where.ts       # WHERE reutilizable y parametrizado
│   │   │   │   ├── metricas.ts
│   │   │   │   ├── abc.ts
│   │   │   │   ├── proyeccion.ts
│   │   │   │   └── alertas.ts
│   │   │   └── etl/
│   │   │       ├── load-xlsx.ts
│   │   │       └── reglas.ts
│   │   ├── db/migrations/         # 0001_esquema_inicial.sql, 0002_vistas.sql
│   │   ├── scripts/migrate.ts     # aplica db/migrations con postgres-migrations
│   │   ├── tests/
│   │   │   ├── paridad.test.ts
│   │   │   ├── endpoints.test.ts
│   │   │   └── fixtures/valores_excel.json
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── Dockerfile
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes.tsx
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   ├── formatters.ts
│       │   │   └── theme.ts
│       │   ├── components/
│       │   │   ├── layout/ (Shell, Sidebar, Topbar, FilterBar)
│       │   │   ├── kpi/ (KpiCard, KpiStrip)
│       │   │   ├── charts/ (MonthlyBars, WeeklyLine, MotivoBars, FamiliaDonut, ProgramaBars)
│       │   │   ├── tables/ (DataTable, ParetoTable, ProgramaTable, GestionMatrix)
│       │   │   └── ui/ (Card, Badge, Skeleton, EmptyState, ErrorState, Tooltip)
│       │   └── pages/
│       │       ├── DashboardPage.tsx
│       │       ├── RegistrosPage.tsx
│       │       └── AnalisisPage.tsx
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── package.json
├── render.yaml
└── netlify.toml                   # raíz: apunta a apps/web
```

**Por qué monorepo:** un solo PR puede cambiar contrato, API y UI; las pruebas de paridad viven junto al ETL; el despliegue se configura con dos archivos (`render.yaml`, `netlify.toml`).

---

## 4. Flujo de una consulta

1. El usuario abre `https://merma.example.com/`.
2. Netlify entrega `index.html` + assets (cache inmutable, hash en el nombre).
3. `App` monta `FilterBar`; `GET /api/v1/meta` llena meses, programas, familias, gestiones y el rango disponible.
4. Con los filtros por defecto (periodo = rango completo o vista guardada), TanStack Query dispara en paralelo:
   - `GET /api/v1/kpis`
   - `GET /api/v1/series/mensual`
   - `GET /api/v1/series/semanal`
   - `GET /api/v1/cortes/motivos`
   - `GET /api/v1/cortes/familias`
   - `GET /api/v1/cortes/programas`
   - `GET /api/v1/cortes/gestion`
   - `GET /api/v1/pareto?limit=15`
   - `GET /api/v1/alertas`
5. Fastify recibe la petición; `filtros.ts` valida los query params con Zod, `where.ts` arma un único `WHERE` parametrizado y se ejecutan las agregaciones en Postgres.
6. Respuesta JSON tipada; Recharts renderiza; los skeletons desaparecen.
7. Al cambiar un filtro, cambia la `queryKey` y se refetchea solo lo necesario (`keepPreviousData` para no parpadear).

**Regla de oro:** el frontend **no calcula** métricas de negocio. Suma, porcentajes, ABC, proyección y alertas vienen resueltos por la API. Así una sola definición de KPI sirve para web, export y futuras integraciones.

---

## 5. Contratos y convenciones

### 5.1 Formato de respuesta

```json
{
  "data": { },
  "meta": {
    "generado_en": "2026-11-25T15:04:05-05:00",
    "filtros": { "desde": "2026-05-08", "hasta": "2026-11-23", "mes": null,
                 "programa": null, "familia": null, "gestion": null },
    "filas_base": 1795,
    "moneda": "USD"
  }
}
```

- Fechas ISO `YYYY-MM-DD`; horas con zona `America/Lima`.
- Dinero como **string decimal** (`"17999.60"`) para no perder centavos en JavaScript. El frontend formatea con `Intl.NumberFormat('en-US', {style:'currency', currency:'USD'})`.
- Porcentajes como número `0.6240` (no string), con 4 decimales.
- Nulos explícitos, nunca `NaN`.

### 5.2 Errores

```json
{ "error": { "codigo": "FILTRO_INVALIDO", "mensaje": "El mes '2026-13' no existe", "detalle": null } }
```

Códigos: `FILTRO_INVALIDO` (422), `NO_ENCONTRADO` (404), `BASE_NO_DISPONIBLE` (503), `NO_AUTORIZADO` (401, fase 2).

### 5.3 Nombres

- Endpoints en plural y en español, porque el dominio es en español: `/cortes/motivos`, `/registros`.
- Campos JSON en `snake_case`, idénticos al modelo (`costo_total`, `semana_iso`).
- Enums: `gestion` ∈ `Controlable | Estandar Tecnico | Por Auditar | Recuperable Proveedor` (sin tildes en la clave; la etiqueta con tilde vive en el catálogo).

---

## 6. Variables de entorno

### API (Render)

| Variable | Ejemplo | Secreto | Uso |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/db?sslmode=require` | Sí | Conexión (la entiende `pg` tal cual) |
| `CORS_ORIGINS` | `https://merma.netlify.app,https://merma.example.com` | No | Orígenes permitidos (lista separada por coma) |
| `APP_ENV` | `production` | No | Logs y docs |
| `TZ` | `America/Lima` | No | Fechas |
| `CACHE_TTL_SECONDS` | `60` | No | Caché en memoria de agregados |
| `WRITE_API_KEY` | 32+ caracteres | Sí | Solo fase 2 (altas) |
| `PORT` | inyectado por Render | No | `listen()` de Fastify |

### Web (Netlify)

| Variable | Ejemplo | Uso |
|---|---|---|
| `VITE_API_URL` | `https://merma-api.onrender.com` | Base de la API |
| `VITE_APP_TITLE` | `Control de Mermas · Lambayeque` | Título |
| `VITE_SENTRY_DSN` | opcional | Errores de frontend (fase 2) |

**Nunca** poner `DATABASE_URL` ni claves en variables `VITE_*`: se compilan al bundle público.

---

## 7. CORS, seguridad y exposición

- `@fastify/cors` con `origin: CORS_ORIGINS`, `methods: ["GET","OPTIONS"]` (POST solo fase 2), `credentials: false`.
- HTTPS obligatorio en ambos lados (Netlify y Render lo dan gratis).
- `@fastify/helmet` y cabecera `X-Robots-Tag: noindex`; sin `*` en CORS.
- `@fastify/rate-limit` por IP en `/api/v1/*` (60 req/min) para evitar scraping accidental.
- El MVP **no tiene login**. Ver riesgo R5: los costos de merma son información sensible. Mitigación inmediata: URL no indexada (`X-Robots-Tag: noindex`), Netlify password protection si el plan lo permite, y no publicar el enlace. La solución definitiva (Google Auth) está en fase 2.

---

## 8. Rendimiento y límites del tier gratuito

| Requisito | Objetivo | Cómo se logra |
|---|---|---|
| Primera pintura | < 2.5 s en 4G | Bundle < 250 KB gzip, Recharts en chunk aparte |
| Respuesta de agregados | p95 < 300 ms | Índices por fecha/código/motivo + 1.8k filas |
| Cambio de filtro | < 500 ms percibidos | `keepPreviousData` + caché 60 s en API |
| Disponibilidad | 99% | Render free duerme a los 15 min de inactividad |
| Arranque en frío | 30–50 s | Aviso en UI + reintento automático; o plan Starter ($7/mes) |

**Advertencia honesta:** Render free suspende la instancia por inactividad. La primera consulta del día puede tardar ~40 s. El frontend debe mostrar “Despertando el servidor…” y reintentar; no se debe vender como instantáneo. Alternativas: cron externo cada 10 min (consume horas) o pasar a plan pago.

---

## 9. Entornos

| Entorno | Web | API | Base |
|---|---|---|---|
| Local | `http://localhost:5173` | `http://localhost:8000` | Postgres local en Docker o Neon branch |
| Preview | Deploy preview de Netlify por PR | Rama de Render (opcional) | Neon branch por PR (opcional) |
| Producción | `merma.example.com` | `merma-api.onrender.com` | Neon `main` |

Los datos de producción **no** se copian a local para desarrollar. Para pruebas se usa un fixture JSON con las 1,795 filas (ver Paso 6).

---

## 10. Decisiones registradas (ADR resumidos)

| ID | Decisión | Alternativa descartada | Consecuencia |
|---|---|---|---|
| A1 | SPA React en Netlify | Next.js SSR | Sin SEO; build simple |
| A2 | Fastify + TypeScript | Express / NestJS / FastAPI | Un solo lenguaje con la web; tipos compartidos |
| A3 | Postgres Neon | SQLite / Render PG free | Persistencia real; 1 dependencia externa |
| A4 | Cálculo en el servidor | Cálculo en el navegador | Una sola definición de KPI |
| A5 | Solo lectura en MVP | CRUD completo | Entrega en ~2.5 semanas; escritura en fase 2 |
| A6 | Monorepo | Dos repos | Un PR = cambio integral |
| A7 | JSON con decimales en string | `number` | Exactitud contable |
| A8 | Series y cortes por endpoint | Un “dashboard” monolítico | Caché selectiva y carga paralela |

---

**Siguiente paso:** [`03-PASO-01-MODELO-DE-DATOS.md`](./03-PASO-01-MODELO-DE-DATOS.md).
