# PASO 5 · DESPLIEGUE Y CI/CD

**Duración estimada:** 1 día (0.5 para el “hola mundo”, 0.5 para producción)
**Depende de:** Pasos 1–4
**Bloquea a:** Paso 6 (QA sobre el ambiente real)

**Objetivo:** publicar la base, la API y la web con un procedimiento repetible, secretos fuera del repositorio y rollback probado.

> **Configuración vigente:** el repositorio ya incluye `render.yaml`, `apps/api/Dockerfile` y `netlify.toml`. El runbook operativo con las variables exactas está en [`operacion/despliegue.md`](operacion/despliegue.md).

---

## 1. Orden de despliegue

```text
1. Base (Neon)  → 2. API local  → 3. API en Render  → 4. Web en Netlify  → 5. Dominio  → 6. CI/CD
```

Nunca al revés: el frontend necesita una API viva para su primera verificación, y la API necesita el esquema aplicado.

---

## 2. Prerrequisitos

| Requisito | Verificación |
|---|---|
| Cuenta GitHub con el repo | `git remote -v` |
| Cuenta Neon | https://neon.tech |
| Cuenta Render conectada a GitHub | https://render.com |
| Cuenta Netlify conectada a GitHub | https://netlify.com |
| Node 22 y npm 10 locales | `node -v`, `npm -v` |
| Docker (opcional, para Postgres local) | `docker compose version` |

---

## 3. Base de datos (Neon)

### 3.1 Crear proyecto

1. Neon Console → **New Project**.
2. Nombre: `merma-prod`. Región: la más cercana a los usuarios (ej. `AWS us-east-1` u `Oregon`; debe coincidir con la región de Render para minimizar latencia).
3. Postgres 16.
4. Copiar la **connection string** (botón “Connect” → “Connection string”):

```text
postgresql://neondb_owner:********@ep-xxxx-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

5. La cadena se usa **tal cual**: `pg` (node-postgres) entiende `sslmode=require` sin adaptadores.

```text
postgresql://neondb_owner:********@ep-xxxx-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Si el proveedor entrega `?ssl=true`, también funciona; no se debe quitar el TLS.

### 3.2 Verificar conectividad

```bash
psql "postgresql://neondb_owner:********@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require" -c "select version();"
```

### 3.3 Aplicar esquema

```bash
export DATABASE_URL="postgresql://…?sslmode=require"
cd apps/api && npm ci
npm run db:migrate
psql "$DATABASE_URL" -c "\dt merma.*"
# esperado: carga, dim_material, dim_motivo, dim_motivo_alias, fact_merma, parametro
```

### 3.4 Cargar datos

```bash
# desde apps/api
npm run etl -- \
  --file "../../REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx" \
  --mode append
psql "$DATABASE_URL" -c "select count(*), round(sum(costo_total),2) from merma.fact_merma;"
# esperado: 1795 | 20383.75
```

**Alternativa:** si el archivo no debe salir de la máquina, la carga se hace por túnel SSH a Neon o se ejecuta en Render Shell subiendo el archivo temporalmente. No se sube el `.xlsx` al repo si contiene datos sensibles (decisión D6).

### 3.5 Respaldo

- Neon free incluye *point-in-time restore* limitado y *branches*. Crear una rama `respaldo-2026-11` antes de la primera carga.
- Export semanal: `pg_dump --no-owner --format=custom "$DATABASE_URL" > backup-$(date +%F).dump` (guardar fuera del repo).

---

## 4. API local (humo antes de Render)

```bash
cd apps/api
npm ci
cp .env.example .env                                    # completar DATABASE_URL
npm run dev                                             # tsx watch src/server.ts
```

Verificación:

```bash
curl -s localhost:8000/api/v1/salud | jq
curl -s "localhost:8000/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11" | jq '.data.merma_total'
# "17999.6033"
```

Swagger: http://localhost:8000/docs

---

## 5. API en Render

### 5.1 Opción A — Blueprint (recomendado)

1. Verificar que `render.yaml` y `apps/api/Dockerfile` están en el repo.
2. Render Dashboard → **New** → **Blueprint** → seleccionar el repo.
3. Render detecta `merma-api` y pide `DATABASE_URL` y `CORS_ORIGINS` (ambas están como `sync: false`).
4. Pegar la cadena con `postgresql://…?sslmode=require`.
5. Completar `CORS_ORIGINS` con la URL de Netlify, sin barra final (se puede ajustar después).
6. **Create**.

### 5.2 Opción B — Manual

1. **New** → **Web Service** → repo.
2. Nombre `merma-api`, runtime **Docker**, Dockerfile `apps/api/Dockerfile`, contexto `apps/api`.
3. Plan **Free**, región la misma de Neon (`virginia`).
4. Health check: `/api/v1/salud`.
5. Variables de entorno (§5.3).
6. Deploy.

### 5.3 Variables obligatorias

| Clave | Valor | Secreto |
|---|---|---|
| `DATABASE_URL` | `postgresql://…?sslmode=require` | **Sí** |
| `CORS_ORIGINS` | `https://merma.netlify.app,https://merma.example.com` | No |
| `APP_ENV` | `production` | No |
| `TZ` | `America/Lima` | No |
| `CACHE_TTL_SECONDS` | `60` | No |
| `RATE_LIMIT_MAX` | `600` | No |
| `ADMIN_TOKEN` | vacío por defecto; opcional (mínimo 16 caracteres) | **Sí**, si se define |
| `UPLOAD_MAX_MB` | `20` | No |

### 5.4 Migraciones en el servicio

No se ejecutan al arrancar (riesgo de bloqueo con varias instancias y arranque en frío más lento). Se aplican **desde local o CI** contra Neon, antes del deploy:

```bash
cd apps/api
export DATABASE_URL="postgresql://…?sslmode=require"
npm run db:migrate
```

Con el pipeline actual esto lo hace GitHub Actions antes de disparar el Deploy Hook (§8.2). La imagen de producción no incluye `tsx`: el script de migración vive en `scripts/migrate.ts` y se ejecuta en la máquina que despliega o en el runner, nunca en el contenedor.

La carga del Excel desde la web funciona **sin clave**: `ADMIN_TOKEN` es opcional y no se declara en `render.yaml`. Si lo defines en el panel de Render, `POST /api/v1/cargas` exige la cabecera `x-admin-token` y la pantalla **Cargas** muestra el campo (lo detecta por `carga_requiere_token` en `/salud`). Sin token, cualquiera con la URL del sitio puede subir archivos, así que actívalo si el sitio deja de ser privado.

### 5.5 Verificación

```bash
curl -s https://merma-api.onrender.com/api/v1/salud | jq
curl -s "https://merma-api.onrender.com/api/v1/kpis?desde=2026-05-08&hasta=2026-11-11" | jq '.data | {merma_total, eventos}'
```

- [ ] `/salud` = 200
- [ ] Totales correctos
- [ ] CORS: desde el navegador en `localhost:5173` (con esa URL agregada temporalmente) la petición no se bloquea

---

## 6. Web en Netlify

### 6.1 Conectar repositorio

1. Netlify → **Add new site** → **Import an existing project** → GitHub → repo.
2. Configuración detectada desde `netlify.toml`:
   - Base: `apps/web`
   - Build: `npm ci && npm run build`
   - Publish: `dist`
3. Variables:
   - `VITE_API_URL=https://<servicio>.onrender.com` (sin `/api/v1` ni barra final)
   - `VITE_APP_TITLE` ya está definido en `netlify.toml`; no hace falta duplicarlo.
4. **Deploy site**.

### 6.2 Ajustar CORS

1. Copiar la URL final (`https://<nombre>.netlify.app`).
2. En Render → `merma-api` → Environment → `CORS_ORIGINS` → agregar la URL.
3. Guardar: Render redepliega automáticamente.
4. Verificar en DevTools → Network que `/kpis` responde 200 sin error de CORS.

### 6.3 Verificación funcional

- [ ] Dashboard carga con $17,999.60 en el corte por defecto.
- [ ] Cambiar a “todo el registro” muestra $20,383.75.
- [ ] Filtro `2026-09` → $9,108.95.
- [ ] Recargar una URL con filtros conserva la vista.
- [ ] Export CSV descarga con tildes correctas.

---

## 7. Dominio y DNS

| Paso | Acción |
|---|---|
| 1 | Comprar/definir dominio (ej. `merma.agrologistics.pe`) |
| 2 | Netlify → Domain management → Add domain → seguir instrucciones |
| 3 | Crear `CNAME merma → <sitio>.netlify.app` (o `A` a la IP que indique Netlify) |
| 4 | Esperar propagación (5–60 min) y activar **HTTPS** (Let’s Encrypt automático) |
| 5 | Agregar `https://merma.agrologistics.pe` a `CORS_ORIGINS` en Render |
| 6 | Verificar `curl -I https://merma.agrologistics.pe` → 200 y HSTS |

Opcional: subdominio de API (`api.merma.…`) con CNAME a Render y certificado gestionado.

---

## 8. CI/CD

### 8.1 Flujo de ramas

```text
feature/*  → PR → main
main       → pruebas + migraciones en Neon + Deploy Hook de Render (API)
             Netlify reconstruye la web desde su integración con Git
PR         → pruebas en GitHub Actions + Deploy Preview de Netlify
```

### 8.2 GitHub Actions (`.github/workflows/ci.yml`)

| Job | Cuándo | Qué hace |
|---|---|---|
| `pruebas` | push y PR | Postgres 16 de servicio, `db:migrate`, typecheck y tests de la API; typecheck, tests y build de la web |
| `desplegar-api` | push a `main` | `db:migrate` contra Neon, `POST` al Deploy Hook de Render y espera de `/api/v1/salud` |

Secretos necesarios en el repositorio (**Settings → Secrets and variables → Actions**):

| Secreto | Uso |
|---|---|
| `NEON_DATABASE_URL` | cadena **directa** de Neon (sin `-pooler`), para migrar |
| `RENDER_DEPLOY_HOOK_URL` | Deploy Hook del servicio `merma-api` (Render → Settings → Deploy Hook) |

`render.yaml` deja `autoDeploy: false`: si Render desplegara por su cuenta, la API podría arrancar antes de que la migración cree el esquema. Netlify sigue construyendo desde su integración con Git; opcionalmente se activa **Locked deploys** para que espere el check de GitHub.

### 8.3 Reglas

- `main` protegida: PR + CI verde + 1 revisión.
- El deploy de la API lo dispara solo el pipeline, después de migrar.
- Nunca commitear `.env`; el `.gitignore` incluye `.env`, `*.dump`, `data/reports/*.json`.
- Los tests de paridad (`PARITY_DATABASE_URL`) se omiten en CI porque necesitan el Excel real; se ejecutan en local contra la base cargada.

---

## 9. Operación y mantenimiento

| Tarea | Frecuencia | Cómo |
|---|---|---|
| Cargar nuevos registros | Semanal/diaria | Pantalla **Cargas** de la web (o `npm run etl -- --file <archivo> --mode append` en local) |
| Revisar alertas de calidad | Semanal | Panel `/` → alertas |
| Actualizar precios del maestro | Mensual | Script `src/etl/update-master.ts` (fase 2) |
| Migración de esquema | Por release | `npm run db:migrate` desde local/CI contra Neon |
| Respaldo | Semanal | `pg_dump` + rama Neon |
| Rotar `DATABASE_URL` | Ante sospecha | Neon → reset password → actualizar Render |
| Revisar logs | Ante error | Render → Logs (JSON line) |
| Uptime | Cada 5 min | UptimeRobot/BetterStack a `/api/v1/salud` |

### Keep-alive del tier free (opcional)

Render free duerme a los 15 min. Un ping cada 10 min desde UptimeRobot mantiene la API despierta pero consume horas de instancia (750/mes). Si el uso es de oficina (8 h × 22 días), alcanza; si se pinguea 24/7, se agota. **Recomendación:** no hacer keep-alive 24/7; aceptar el arranque en frío y mostrar el aviso en la UI (Paso 4 §4).

---

## 10. Rollback

| Escenario | Acción |
|---|---|
| Deploy de API rompe un endpoint | Render → Deploys → “Redeploy” del commit anterior |
| Deploy de web rompe la UI | Netlify → Deploys → “Publish deploy” del anterior |
| Migración incompatible | Restaurar la rama Neon previa (o punto en el tiempo) + redeploy del commit anterior. Los `.sql` son de avance: no se edita una migración ya aplicada, se agrega otra |
| Carga con datos malos | `update merma.carga set estado='revertida'` + `delete from fact_merma where carga_id = X` en transacción; recargar archivo corregido |
| CORS mal configurado | Ajustar `CORS_ORIGINS` y guardar (redeploy automático) |

**Probar el rollback una vez en staging**, no en producción.

---

## 11. Checklist de salida a producción

- [ ] Esquema aplicado y conteos validados (1,795 / $20,383.75).
- [ ] `/salud` verde y monitoreado.
- [ ] CORS solo con dominios reales (sin `*`).
- [ ] HTTPS en ambos dominios.
- [ ] `X-Robots-Tag: noindex` activo.
- [ ] Variables de entorno cargadas en Render y Netlify (sin secretos en el repo).
- [ ] Backup inicial descargado.
- [ ] Rollback probado en staging.
- [ ] Usuarios capacitados en 15 min: qué filtro usar, dónde ver alertas, cómo exportar.
- [ ] Documento de una página con URLs, contactos y procedimiento de carga.

---

## 12. Costos esperados (tier gratuito)

| Servicio | Plan | Límite | Costo |
|---|---|---|---|
| Netlify | Free | 100 GB/mes, 300 min build | $0 |
| Render | Free | 512 MB, duerme a los 15 min | $0 |
| Neon | Free | 0.5 GB, autosuspensión | $0 |
| Dominio | — | anual | ~$12/año |
| **Total** | | | **~$12/año** |

Si se requiere disponibilidad 24/7 sin arranque en frío: Render Starter ($7/mes) + Neon Launch ($19/mes) ≈ **$26/mes**. Decisión en el documento 09 (D7).

---

## 13. Criterios de aceptación

| # | Criterio |
|---|---|
| 1 | Un `git push` a `main` despliega API y web sin intervención |
| 2 | Un PR genera preview de Netlify con la API de producción o staging |
| 3 | El CI falla si un test de paridad no cuadra |
| 4 | El rollback de API y web se completa en < 5 min |
| 5 | Ninguna credencial aparece en el historial de Git |
| 6 | El sitio responde 200 en el dominio propio con HTTPS |

---

**Siguiente paso:** [`08-PASO-06-CALIDAD-Y-RECONCILIACION.md`](./08-PASO-06-CALIDAD-Y-RECONCILIACION.md).
