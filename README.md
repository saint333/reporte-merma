# Reporte de Merma Diaria Gerencial

Plan de migración del libro `REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK` a una aplicación web:

- **Web:** React + Vite + TypeScript → **Netlify**
- **API:** Node.js 22 + Fastify + TypeScript + PostgreSQL → **Render**
- **Datos:** 6 hojas, 108 SKUs, 1,795 eventos (08/05/2026 – 23/11/2026)

## Documentación

| Documento | Contenido |
|---|---|
| [00 · Índice y resumen](docs/00-INDICE-Y-RESUMEN.md) | Hallazgos, decisiones, cifras de control |
| [01 · Análisis del Excel](docs/01-ANALISIS-DEL-EXCEL.md) | Hojas, fórmulas, gráficas, calidad de datos |
| [02 · Arquitectura](docs/02-ARQUITECTURA-Y-STACK.md) | Stack, repo, entornos, CORS, costos |
| [03 · Paso 1 · Modelo de datos](docs/03-PASO-01-MODELO-DE-DATOS.md) | DDL Postgres, reglas, ABC, proyección |
| [04 · Paso 2 · ETL](docs/04-PASO-02-ETL-E-INGESTA.md) | Carga del `.xlsx` en TypeScript, validaciones, duplicados |
| [05 · Paso 3 · API](docs/05-PASO-03-API-EN-RENDER.md) | Endpoints, filtros, caché, Docker, tests |
| [06 · Paso 4 · Frontend](docs/06-PASO-04-FRONTEND-EN-NETLIFY.md) | Pantallas, componentes, gráficas, tema |
| [07 · Paso 5 · Despliegue](docs/07-PASO-05-DESPLIEGUE-Y-CI-CD.md) | Neon, Render, Netlify, CI/CD, rollback |
| [08 · Paso 6 · Calidad](docs/08-PASO-06-CALIDAD-Y-RECONCILIACION.md) | Paridad numérica y criterios de aceptación |
| [09 · Paso 7 · Roadmap](docs/09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md) | Fases, riesgos, decisiones abiertas |
| [Operación · Despliegue](docs/operacion/despliegue.md) | Render, Netlify, variables y verificación |
| [Diccionario de datos](docs/modelo/diccionario-datos.md) | Tablas, vistas, índices y reglas del esquema `merma` |
| [Contrato OpenAPI](docs/api/openapi.json) · [ejemplos HTTP](docs/api/ejemplos.http) | Esquema exportado y peticiones de ejemplo |

## Cifras que la app debe reproducir

| Ventana | Eventos | Merma |
|---|---:|---:|
| Corte 28 semanas (08/05–11/11) | 1,618 | $17,999.60 |
| Registro completo (08/05–23/11) | 1,795 | $20,383.75 |

## Estado

- **Paso 1 implementado:** esquema Postgres, migraciones SQL y verificación en `apps/api`.
- **Paso 2 implementado:** ETL en TypeScript con `dry-run`, `append`, `replace` y reporte de calidad.
- **Paso 3 completo:** API Fastify con `/api/v1/salud`, `/meta`, `/kpis`, `/series/mensual`, `/series/semanal`, `/cortes/:dimension`, `/pareto`, `/proyeccion`, `/registros`, `/registros.csv` y `/alertas`; filtros Zod, caché TTL, Swagger UI en `/docs`, helmet, rate limit y pruebas de paridad.
- **Paso 4 implementado:** SPA React con dashboard, registros y análisis; filtros en URL, cinco gráficas, Pareto, matriz de gestión, alertas, export CSV y estados de carga/error. Build y pruebas del frontend en `apps/web`.
- **Carga desde la web:** `POST /api/v1/cargas` recibe el `.xlsx` (multipart) y ejecuta el mismo ETL; la pestaña **Cargas** muestra el resumen y el historial. No pide clave salvo que definas `ADMIN_TOKEN`. `GET /api/v1/cargas` lista las cargas registradas.
- **Paso 5 desplegado:** API en `https://merma-api.onrender.com` y web en `https://reporte-merma.netlify.app`. El workflow `CI/CD` corre pruebas, migra Neon y dispara el Deploy Hook de Render en cada push a `main`; Netlify reconstruye la web por su integración con Git. CORS y cifras verificados contra las URLs públicas (ver [Operación · Despliegue](docs/operacion/despliegue.md#verificación-en-producción--25112026)).
- **Paso 6 verificado:** la suite de paridad (`PARITY_DATABASE_URL`) pasa 11/11 en local y en Neon, y `npm run db:quality` deja los 5 controles en cero con 1,795 hechos y `$20,383.75`. El control de calidad corre en el workflow antes del Deploy Hook.
- **Paso 7:** roadmap, riesgos y decisiones abiertas (D1–D4) en `docs/09`.
- **Contrato publicado:** `npm run api:types` en `apps/api` regenera `docs/api/openapi.json` y `apps/web/src/lib/api-schema.d.ts`; CI falla si el snapshot queda desactualizado.
- El Excel original está en la raíz y no se modifica; el ETL lo acepta por ruta (CLI) o por multipart (web) y no se versiona.

### Levantar el frontend

```bash
docker compose up -d db
cd apps/api && npm run dev          # API en http://localhost:8000
cd apps/web
npm install
cp .env.example .env                # VITE_API_URL=http://localhost:8000
npm run dev                         # SPA en http://localhost:5173
```

Verificación del frontend:

```bash
cd apps/web
npm run typecheck
npm test
npm run build
```

### Cargar datos

Desde la web: arranca la API y sube el `.xlsx` en `http://localhost:5173/cargas` (la clave solo se pide si defines `ADMIN_TOKEN`, mínimo 16 caracteres, en `apps/api/.env`). También por terminal, como antes:

```bash
cd apps/api
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode append
```

### Despliegue

La configuración está preparada en el repositorio:

- `render.yaml` crea la API en Render con runtime Docker y health check.
- `apps/api/Dockerfile` construye la imagen de producción.
- `netlify.toml` define el build de `apps/web`, el fallback SPA y las cabeceras.

Variables mínimas: `DATABASE_URL` y `CORS_ORIGINS` en Render; `VITE_API_URL` en Netlify. `ADMIN_TOKEN` es opcional: si lo defines, la carga desde la web pide clave. El procedimiento completo, incluida la carga de Neon, la subida del Excel desde la web y la verificación de CORS, está en [`docs/operacion/despliegue.md`](docs/operacion/despliegue.md).

### Levantar el esquema local

```bash
docker compose up -d db
cd apps/api
npm install
cp .env.example .env
npm run db:migrate
npm run db:check     # 6 tablas · 2 vistas · 13 motivos · 3 parámetros
npm run db:quality   # 5 controles de calidad: sin huérfanos, costos y semana ISO coherentes
```

### Cargar el Excel

```bash
cd apps/api
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode dry-run
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode append
npm test             # reglas + integración (esta última requiere TEST_DATABASE_URL)
```

Resultado esperado: 1,795 hechos, 108 materiales, $20,383.7525 y 7 observaciones. Detalle operativo en [`docs/operacion/carga.md`](docs/operacion/carga.md).

### Levantar la API

```bash
cd apps/api
cp .env.example .env     # DATABASE_URL, PORT, CORS_ORIGINS, APP_ENV
npm run dev              # http://localhost:8000/api/v1/salud
npm run build && npm start
```

Documentación interactiva: [`http://localhost:8000/docs`](http://localhost:8000/docs) · especificación: `http://localhost:8000/openapi.json`. La caché y el rate limit se configuran con `CACHE_TTL_SECONDS` (60 s) y `RATE_LIMIT_MAX` (600 por minuto).

Endpoints disponibles:

```bash
curl -s localhost:8000/api/v1/salud
curl -s localhost:8000/api/v1/meta
curl -s "localhost:8000/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11"
curl -s "localhost:8000/api/v1/series/semanal?desde=2026-05-08&hasta=2026-11-11"
curl -s "localhost:8000/api/v1/cortes/motivos?desde=2026-05-08&hasta=2026-11-11"
curl -s "localhost:8000/api/v1/pareto?desde=2026-05-08&hasta=2026-11-11"
curl -s "localhost:8000/api/v1/proyeccion?desde=2026-05-08&hasta=2026-11-11"
curl -s "localhost:8000/api/v1/registros?desde=2026-05-08&hasta=2026-11-11&per_page=10"
curl -s "localhost:8000/api/v1/registros?desde=2026-05-08&hasta=2026-11-11&q=CLAMSHELL"
curl -s "localhost:8000/api/v1/alertas?desde=2026-05-08&hasta=2026-11-11"
```

Pruebas de la API:

```bash
# dataset fijo (requiere migraciones aplicadas en una base *test*)
TEST_DATABASE_URL=postgresql://merma:merma@localhost:5432/merma_test npm test

# paridad contra el dataset real cargado
PARITY_DATABASE_URL=postgresql://merma:merma@localhost:5432/merma npm test
```

La ventana 08/05–11/11 debe devolver `merma_total = 17999.6033`, `eventos = 1618` y `semana_pico = S40`.

## Antes de empezar

Firmar las decisiones D1–D4 de [09 · Roadmap](docs/09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md#5-decisiones-abiertas-requieren-firma).
