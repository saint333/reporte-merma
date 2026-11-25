# Despliegue en Render y Netlify

Configuración incluida en el repositorio:

| Archivo | Uso |
|---|---|
| `render.yaml` | Blueprint de Render para `merma-api` |
| `apps/api/Dockerfile` | Imagen de producción de la API |
| `apps/api/.dockerignore` | Evita enviar `.env`, tests y artefactos al contexto Docker |
| `netlify.toml` | Build de la SPA, fallback de rutas y cabeceras |
| `.github/workflows/ci.yml` | Pruebas, migraciones en Neon y Deploy Hook de Render |

El primer despliegue se completa en los paneles de Neon, Render y Netlify. A partir de ahí, cada push a `main` pasa por GitHub Actions (pruebas + migraciones + Deploy Hook) y Netlify reconstruye la web desde su integración con Git.

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
| `ADMIN_TOKEN` | vacío (carga sin clave) | Opcional | panel de Render |
| `UPLOAD_MAX_MB` | `20` | No | `render.yaml` |

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

El Excel no se versiona. La carga inicial se hace desde tu máquina; a partir de ahí los reportes nuevos se suben desde la pantalla **Cargas** de la web (ver §5). El ETL no forma parte del arranque de Render.

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

- [x] El dashboard abre con `$17,999.60` y 1,618 eventos.
- [x] “Todo el registro” muestra `$20,383.75` y 1,795 eventos.
- [x] El filtro `2026-09` muestra `$9,108.95`.
- [x] Recargar una URL con filtros conserva la selección.
- [x] El CSV descarga correctamente.
- [x] La pestaña **Cargas** lista el historial y sube el mismo archivo con `ya_cargado: true`.
- [x] Un push a `main` dispara el workflow y el deploy de Render queda **Live**.
- [ ] En móvil (375 px) no hay scroll horizontal. **Corregido el 25/11/2026**, pendiente de confirmar en producción tras el deploy (ver abajo).

### Verificación en producción · 25/11/2026

Comprobación por HTTP contra las URLs reales (sin navegador):

| Comprobación | Resultado |
|---|---|
| `GET /api/v1/salud` | `200`, `db: ok`, `carga_requiere_token: false` |
| Campaña 08/05–11/11 | `17999.6033` · 1,618 eventos · ticket `11.1246` · controlable `0.624` · pallets `14.898022` · 79/108 SKU · pico S40 |
| Todo el registro 08/05–23/11 | `20383.7525` · 1,795 eventos |
| Filtro `2026-09` | `9108.9505` · 320 eventos |
| `GET /meta` | rango 08/05–23/11 (200 días), 1,795 registros / 108 materiales / 13 motivos |
| `GET /pareto` | 79 SKU, 14 clase A, top `14596.5068` (81.09%); la fila 15 queda en “ALTO IMPACTO” |
| `GET /alertas` | 7 sin motivo por `$1,118.13`, 4 duplicados, `MALA IMPRESIÓN` (3), S40 al 31.0% |
| `GET /registros.csv` | `text/csv`, `attachment`, 1,618 filas + cabecera, tildes conservadas, separador coma y decimal con punto |
| CORS `GET /salud` desde `https://reporte-merma.netlify.app` | `access-control-allow-origin` con ese origen, sin `*` |
| Preflight `OPTIONS /cargas` | `204`, `allow-methods: GET, POST, OPTIONS`, `allow-headers: content-type, x-admin-token, x-request-id` |
| Cabeceras de Netlify | `X-Robots-Tag: noindex, nofollow`, `X-Frame-Options: DENY`, HSTS con `preload` |
| `POST /cargas` sin cabecera y sin archivo | `400 ARCHIVO_REQUERIDO`: no exige clave |
| `POST /cargas?modo=append` con el Excel real, sin cabecera | `200`, `ya_cargado: true`, `insertadas: 0`, 1,795 leídas (08/05–23/11), `costo_total 20383.7525` |
| `GET /cargas` | historial con la carga `completada` de 1,795 filas; la subida repetida no crea registro porque no escribe nada |
| Workflow `CI/CD` en el push de `main` | `Pruebas y build` y `Migrar Neon y desplegar la API` en success |

### Revisión en navegador · 25/11/2026

Recorrido automatizado con Edge headless sobre la app en local (`vite dev`)
contra la API local con los mismos 1,795 hechos, y las comprobaciones ya
registradas arriba contra la URL pública.

| Comprobación | Resultado |
|---|---|
| Dashboard del corte | `$17,999.60` · 1,618 eventos · ticket `$11.12` · 62.4% · 14.90 pallets |
| Vista «Todo el registro» | `$20,383.75` · actualiza `desde`/`hasta` en la URL |
| Recarga con filtros | el selector conserva «Todo el registro» |
| Filtro `2026-09` | `$9,108.95` · 320 eventos · 7 páginas de 50 |
| Filtro familia `BOLSAS` | 7 eventos · `$3,897.00` |
| Serie semanal | pico marcado como **S40** |
| Pareto | badges 79 SKUs / 14 A, fila 15 «ALTO IMPACTO», acumulado 79.32% en la 14 |
| Alertas | 7 sin motivo por `$1,118.13` |
| CSV desde la UI | 1,618 filas sin filtro y 320 con `mes=2026-09`; separador coma, decimal con punto, tildes y BOM UTF-8 |
| Pantalla **Cargas** | historial con la carga `completada` y sin campo de clave |
| Subida del mismo archivo | «El archivo ya estaba cargado», 1,795 leídas, `$20,383.75`, 0 insertadas |
| Móvil 375 px | **desborde de 216 px** en el dashboard, corregido (ver abajo) |

El desborde lo producía la tabla accesible de las gráficas: `sr-only` estaba en
el `<table>` y, como el ancho de una tabla es un mínimo, el documento crecía
hasta 591 px. Ahora la clase va en un `<div>` contenedor.

Queda pendiente confirmar el móvil con el deploy desplegado, probar el rollback
y sincronizar el Blueprint de Render si cambia `render.yaml`.

## 5. Cargar datos desde la web

La ruta **Cargas** de la SPA envía el `.xlsx` a `POST /api/v1/cargas` y la API ejecuta el mismo ETL que la CLI, sin acceso al sistema de archivos.

1. Abrir `https://<sitio>.netlify.app/cargas`.
2. Elegir el archivo y el modo. La clave solo se pide si definiste `ADMIN_TOKEN` en Render:
   - **Agregar** (`append`): inserta filas nuevas y omite las que ya existen por hash.
   - **Reemplazar** (`replace`): revierte la carga previa del mismo archivo y la reinserta. Exige marcar la confirmación.
3. Revisar el resumen: insertadas, omitidas, errores, rango y costo total.

Reglas del endpoint:

- **No pide clave por defecto.** Si defines `ADMIN_TOKEN` (mínimo 16 caracteres) en Render, exige la cabecera `x-admin-token` y el formulario muestra el campo. `GET /api/v1/salud` publica `carga_requiere_token` para que la web sepa si mostrarlo.
- Sin `ADMIN_TOKEN`, cualquiera que conozca la URL del sitio puede subir un archivo y, en modo `replace`, reemplazar los hechos de la carga anterior de ese mismo archivo. Define el token si el sitio deja de ser privado.
- Límite de 20 MB (`UPLOAD_MAX_MB`), solo `.xlsx`, y 6 cargas por minuto por IP.
- El archivo se procesa en memoria y la carga queda registrada en `merma.carga` con su hash.
- Al terminar, la API invalida la caché de KPIs, series, cortes, Pareto y alertas.
- Si el hash ya existe y el modo es `append`, responde `200` con `ya_cargado: true` y no escribe nada.

Los errores de validación devuelven `422 ARCHIVO_INVALIDO` con el mensaje del ETL (hoja faltante, valor unitario inválido, etc.). El historial se consulta con `GET /api/v1/cargas`.

## 6. Integración continua

`.github/workflows/ci.yml` tiene dos jobs:

| Job | Cuándo | Qué hace |
|---|---|---|
| `pruebas` | push y PR | Postgres 16 de servicio, migraciones, typecheck y tests de la API; typecheck, tests y build de la web |
| `desplegar-api` | push a `main` | `db:migrate` y `db:quality` contra Neon, `POST` al Deploy Hook de Render y espera de `/api/v1/salud` |

Secretos en GitHub → **Settings → Secrets and variables → Actions**:

| Secreto | Valor |
|---|---|
| `NEON_DATABASE_URL` | cadena directa de Neon (sin `-pooler`). El pooler no garantiza los advisory locks de `postgres-migrations` |
| `RENDER_DEPLOY_HOOK_URL` | Render → `merma-api` → Settings → Deploy Hook |

`render.yaml` fija `autoDeploy: false` justamente para que el deploy ocurra después de migrar. Si prefieres que Render despliegue por su cuenta, ponlo en `true` aceptando que un cambio de esquema puede dejar la API en 503 hasta que corras `npm run db:migrate`.

## 7. Operación

- **Migraciones:** ejecutar `npm run db:migrate` contra `DATABASE_URL` antes de desplegar cambios de esquema.
- **Rollback de Render:** Deploys → seleccionar el deploy anterior → **Rollback**.
- **Rollback de Netlify:** Deploys → seleccionar el deploy anterior → **Publish deploy**.
- **Cold start:** el plan free de Render suspende la API tras unos minutos de inactividad. La primera petición puede tardar decenas de segundos; la UI muestra el aviso de arranque.
- **Secretos:** `DATABASE_URL` solo vive en Render/Neon y en el entorno local; nunca en el repositorio ni en Netlify.
- **Backup:** volcado con `pg_dump` 18, verificación en base desechable y restauración en una rama de Neon en [Backup y restauración](backup.md). El archivo del 25/11/2026 está en `backups/` (ignorado por Git).
