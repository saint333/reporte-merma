# Despliegue en Render y Netlify

Configuración incluida en el repositorio:

| Archivo | Uso |
|---|---|
| `render.yaml` | Blueprint de Render para `merma-api` |
| `apps/api/Dockerfile` | Imagen de producción de la API |
| `apps/api/.dockerignore` | Evita enviar `.env`, tests y artefactos al contexto Docker |
| `netlify.toml` | Build de la SPA, fallback de rutas y cabeceras |

El despliegue real no se ejecuta desde el repositorio. Los pasos siguientes se completan en los paneles de Neon, Render y Netlify.

## 1. Variables de producción

### API en Render

| Variable | Valor | Secreto | Origen |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://…?sslmode=require` | Sí | Neon |
| `CORS_ORIGINS` | `https://<sitio>.netlify.app` | No | Netlify |
| `APP_ENV` | `production` | No | `render.yaml` |
| `TZ` | `America/Lima` | No | `render.yaml` |
| `CACHE_TTL_SECONDS` | `60` | No | `render.yaml` |
| `RATE_LIMIT_MAX` | `600` | No | `render.yaml` |

`PORT` lo inyecta Render y no se define a mano. `CORS_ORIGINS` acepta varios orígenes separados por coma, sin barra final:

```text
https://merma.netlify.app,https://merma.agrologistics.pe
```

No pongas `DATABASE_URL` en variables `VITE_*`: Vite las compila dentro del JavaScript público.

### Web en Netlify

| Variable | Valor | Dónde se configura |
|---|---|---|
| `VITE_API_URL` | `https://<servicio>.onrender.com` | Netlify → Site configuration → Environment variables |
| `VITE_APP_TITLE` | `Control de Mermas · Lambayeque` | `netlify.toml` |
| `NODE_VERSION` | `22` | `netlify.toml` |

`VITE_API_URL` debe ser solo el origen de Render: sin `/api/v1` y sin barra final. Vite la incrusta en el build, así que después de cambiarla hay que volver a desplegar el sitio.

## 2. Preparar la base

1. Crear un proyecto en Neon (Postgres 16) en la misma región que Render (`virginia`/`us-east-1`).
2. Copiar la connection string con `sslmode=require`.
3. Aplicar el esquema y cargar el Excel desde la máquina local:

```bash
cd apps/api
export DATABASE_URL="postgresql://…?sslmode=require"
npm ci
npm run db:migrate
npm run db:check
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode dry-run
npm run etl -- --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" --mode append
```

El Excel no se versiona. El ETL se ejecuta localmente contra Neon; no forma parte del arranque de Render.

Comprobar la carga:

```bash
psql "$DATABASE_URL" -c \
  "select count(*) as eventos, round(sum(costo_total), 2) as merma from merma.fact_merma;"
```

Esperado: `1795 | 20383.75`.

Las migraciones son manuales. No se ejecutan al arrancar el contenedor para evitar bloqueos y arranques lentos. Si se automatizan, deben correr como un Job de Render o desde CI antes del deploy.

## 3. Desplegar la API en Render

1. Render → **New** → **Blueprint** → seleccionar el repositorio.
2. Render lee `render.yaml` y crea `merma-api` con runtime Docker.
3. Completar las variables solicitadas:
   - `DATABASE_URL`: la cadena de Neon.
   - `CORS_ORIGINS`: la URL de Netlify. Si todavía no existe, usar temporalmente la URL final prevista y corregirla al terminar el paso 4.
4. Crear el servicio y esperar a que el health check `/api/v1/salud` responda.
5. Verificar:

```bash
curl -fsS "https://<servicio>.onrender.com/api/v1/salud"
curl -fsS "https://<servicio>.onrender.com/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11"
```

Esperado en `/kpis`: `merma_total = 17999.6033`, `eventos = 1618`.

Swagger queda en `https://<servicio>.onrender.com/docs`.

## 4. Desplegar la web en Netlify

1. Netlify → **Add new site** → **Import an existing project** → seleccionar el repositorio.
2. Confirmar la configuración detectada desde `netlify.toml`:
   - Base: `apps/web`
   - Build: `npm ci && npm run build`
   - Publish: `dist`
3. Agregar `VITE_API_URL` con la URL pública de Render, sin `/api/v1`.
4. Desplegar.
5. Copiar la URL final de Netlify y confirmar que coincide exactamente con `CORS_ORIGINS` en Render. Si no coincide, actualizarla y esperar el redeploy de Render.

En DevTools → Network, `/api/v1/kpis` debe responder `200` sin errores de CORS.

Prueba funcional mínima:

- [ ] El dashboard abre con `$17,999.60` y 1,618 eventos.
- [ ] “Todo el registro” muestra `$20,383.75` y 1,795 eventos.
- [ ] El filtro `2026-09` muestra `$9,108.95`.
- [ ] Recargar una URL con filtros conserva la selección.
- [ ] El CSV descarga correctamente.
- [ ] En móvil (375 px) no hay scroll horizontal.

## 5. Operación

- **Migraciones:** ejecutar `npm run db:migrate` contra `DATABASE_URL` antes de desplegar cambios de esquema.
- **Rollback de Render:** Deploys → seleccionar el deploy anterior → **Rollback**.
- **Rollback de Netlify:** Deploys → seleccionar el deploy anterior → **Publish deploy**.
- **Cold start:** el plan free de Render suspende la API tras unos minutos de inactividad. La primera petición puede tardar decenas de segundos; la UI muestra el aviso de arranque.
- **Secretos:** `DATABASE_URL` solo vive en Render/Neon y en el entorno local; nunca en el repositorio ni en Netlify.
