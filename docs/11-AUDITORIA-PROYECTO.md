# Auditoría del proyecto (API + Web)

Fecha: 2026-11-26 (primera versión) · actualizada tras el login con sesión (commits `59bf447` y `e78de97`).
Alcance: `apps/api` (Fastify, pg, ETL), `apps/web` (React, PrimeReact, Recharts), CI/CD, despliegue y documentación.
Método: lectura del código, búsqueda de patrones de riesgo y revisión de configuración. **No se revisó la UI en navegador.** La actualización comprueba cada hallazgo con búsquedas en el código actual; los hallazgos siguen siendo lecturas y deben confirmarse antes de implementar.

## Resumen

| Prioridad | Cantidad | Tema principal |
|---|---|---|
| Alta | 2 abiertos (1 resuelto) | Carga de Excel sin token; CORS/origen en producción |
| Media | 6 | Lectura de cargas sin protección; CSV truncado en silencio; cobertura de pruebas web; tokens en sessionStorage; errores sin ID; consultas sin límite de tiempo |
| Baja | 6 | CI sin build de Docker, accesibilidad, duplicación de código, documentación |

Lo que está bien y no requiere cambios inmediatos:
- Consultas SQL parametrizadas; el orden de `sort` usa lista blanca (`ORDEN`), no entrada directa.
- Validación de entrada con Zod en `http/filtros.ts` (fechas reales, rangos, cantidades positivas, `strictObject`).
- Comparación de token con `timingSafeEqual`.
- `.env` de la API ignorado por git; `.env.example` versionado.
- Errores normalizados (`ErrorApi`) y handler global sin filtrar stack traces al cliente.
- Helmet, rate limit por ruta de escritura, límite de tamaño en la carga.
- Transacciones (`begin/commit/rollback`) en alta, edición y borrado, con historial de cambios.
- Sin `any`, `@ts-ignore` ni `dangerouslySetInnerHTML` en el código fuente.
- CI con Postgres, typecheck, tests y verificación de contrato OpenAPI.

---

## Hallazgos de prioridad alta

### A1. Escritura abierta por defecto — RESUELTO
- **Dónde:** `apps/api/src/http/autorizacion.ts`, `routes/registros.ts` (POST, PATCH, DELETE), `routes/cargas.ts` (POST).
- **Estado (verificado):** `exigirAutorizacion` está en las 4 escrituras (`registros` POST/PATCH/DELETE y `cargas` POST). `ADMIN_TOKEN` desapareció. La escritura exige el Bearer que emite `POST /api/v1/auth/login`, y en `APP_ENV=production` la API no arranca sin `ADMIN_USER`, `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` (`server.ts`). Así que ya no existe el modo abierto por descuido. Queda abierto solo en desarrollo y pruebas, sin esas variables.

### A2. Carga de Excel y reemplazo de datos sin token en producción — RESUELTO EN ESCRITURA, ABIERTO EN COMPROBACIÓN
- **Dónde:** `routes/cargas.ts`, y `render.yaml`.
- **Estado:** `POST /api/v1/cargas` exige sesión; sin `ADMIN_*`/`SESSION_SECRET` en producción el servidor no arranca. Falta confirmar en Render que las tres variables están definidas (la API responde `carga_requiere_token: true` en `/salud`, así que sí lo están).
- **Riesgo residual:** `modo=replace` borra hechos de la carga previa (`load-xlsx.ts`); requiere sesión y `confirmar=true`. Además, el archivo se carga entero en memoria con `toBuffer()`; con el límite de 20 MB está acotado, pero conviene documentarlo.

### A3. CORS y origen de la API
- **Dónde:** `config.ts` (`CORS_ORIGINS` por defecto `http://localhost:5173`), `app.ts` (`credentials: false`, métodos incluyen `PATCH` y `DELETE`).
- **Qué pasa:** el valor por defecto es local, así que en producción debe definirse; si se omite, el navegador de Netlify falla (no es un hueco de seguridad, sino una fuente de errores). El riesgo real es que `CORS_ORIGINS` acepte comodines o listas amplias en el futuro.
- **Estado (verificado):** sigue igual. `config.ts` no valida `CORS_ORIGINS` por `APP_ENV`, y `server.ts` solo valida la sesión. Si Render arranca sin `CORS_ORIGINS`, el valor por defecto es `localhost` y el navegador de Netlify falla.
- **Propuesta:** en producción, rechazar `CORS_ORIGINS` vacío o con `localhost`. Validar que cada origen sea una URL `https://`.

---

## Hallazgos de prioridad media

### M1. Lectura de historial de cargas sin protección
- **Dónde:** `routes/cargas.ts`, `GET /api/v1/cargas`.
- **Estado (verificado):** sigue abierto. `GET /api/v1/cargas` (`routes/cargas.ts`, línea ~112) no llama a `exigirAutorizacion`. La web lo usa en `CargasPage` sin token, así que aplicar sesión exige cambiar también `cargasQuery` y el hook de sesión.
- **Qué pasa:** expone nombres de archivo, fechas, costos y modo de carga sin autorización. Es información de negocio.
- **Propuesta:** aplicar `exigirAutorizacion` en lectura solo si hay token, o limitar los campos devueltos (ocultar `archivo`). Decidir con el usuario qué es sensible.

### M2. Exportación CSV sin límite de filas
- **Dónde:** `services/registros.ts`, `consultarRegistrosCsv` (sin `limit`) y `routes/registros.ts` (`/api/v1/registros.csv`).
- **Estado (verificado):** ya existe un tope `limit 50000` en `services/registros.ts` (línea ~212), pero no avisa al usuario. Si hay más filas, el CSV sale truncado sin indicación.
- **Propuesta:** avisar cuando se alcance el tope (cabecera o mensaje) o usar streaming con `pg-cursor`/`COPY`. Medir antes de implementar.

### M3. Tokens de administración en sessionStorage
- **Dónde:** `apps/web/src/lib/api.ts` (`leerTokenAdmin`, `guardarTokenAdmin`).
- **Qué pasa:** cualquier script que se ejecute en el origen puede leer la clave. Se acepta como compromiso (sesión, no `localStorage`), pero conviene documentarlo como riesgo residual.
- **Estado (verificado):** sigue igual. La web guarda la sesión en sessionStorage (`merma.sesion`). `netlify.toml` no tiene `Content-Security-Policy` (solo X-Frame-Options, nosniff, Referrer-Policy y X-Robots-Tag).
- **Propuesta:** mantener sessionStorage y añadir una cabecera CSP restrictiva en `netlify.toml`. Esto es relevante porque `helmet` en la API tiene `contentSecurityPolicy: false`, pero en la web no hay CSP.

### M4. Cobertura de pruebas en la web
- **Estado (verificado):** sigue igual. `apps/web` solo tiene `src/lib/formatters.test.ts`.
- **Dónde:** `apps/web`.
- **Qué pasa:** no hay pruebas de `api.ts` (manejo de errores, token), de formularios (`CamposRegistro`, `NuevoRegistroPage`, `EditarRegistroPage`) ni de `lib/filters.ts`, `lib/fechas.ts`.
- **Propuesta:** pruebas unitarias para `api.ts` (errores `ApiError`, `construirUrl`) y `lib/filters.ts`. Pruebas de componentes solo para formularios.

### M5. Consultas sin límite de tiempo en la API
- **Dónde:** `services/*.ts` (kpis, series, pareto, cortes, alertas). Solo `salud.ts` tiene timeout de 2 s.
- **Qué pasa:** una consulta lenta (rango amplio, muchos filtros) bloquea una conexión del pool; con el plan gratuito de Render y Neon, el pool es pequeño.
- **Estado (verificado):** sigue igual. `db.ts` crea el pool con `max: 5` y no hay `statement_timeout` en `apps/api/src`.
- **Propuesta:** configurar `statement_timeout` en `db.ts` (p. ej. 10 s) y revisar `max` del pool.

### M6. Errores de base y de validación sin identificador de incidente
- **Dónde:** `http/errores.ts`.
- **Estado (verificado):** sigue igual. `http/errores.ts` no incluye `request.id` en el cuerpo del error; `x-request-id` solo va en cabeceras (`app.ts`). Dificulta correlacionar con logs de Render.
- **Propuesta:** incluir `request.id` en `detalle` de los errores 500 y 503.

---

## Hallazgos de prioridad baja

### B1. Ruta del Dockerfile no comprobada en la auditoría
- `render.yaml` apunta a `./apps/api/Dockerfile`. El archivo existe. Sigue sin verificarse en CI (ver B2).

### B2. CI no construye la imagen Docker
- `.github/workflows/ci.yml` ejecuta pruebas, typecheck y build de la web, pero no `docker build` de la API (confirmado: no aparece la palabra `docker` en el workflow). Un fallo del Dockerfile se descubre solo en Render.
- **Estado (verificado):** sigue igual. `ci.yml` no contiene la palabra `docker`. Confirmado en el último run (`45909169829`): los jobs de pruebas, build, migraciones, deploy y health check pasan, pero la imagen no se construye en CI.
- **Propuesta:** añadir un paso `docker build apps/api` en CI.

### B3. Duplicación de lógica de fechas
- Estado (verificado): siguen existiendo `apps/api/src/etl/fechas.ts` y `apps/api/src/http/fechas.ts`, pero no son duplicados: uno parsea y calcula semana ISO; el otro trabaja con zona horaria de Lima. No se unifican para no cambiar comportamiento.

### B4. Duplicación de `fetch` en `api.ts`
- `getJson`, `enviarJson`, `subirCarga`, `crearRegistroManual` y `descargarCsv` repiten el manejo de `AbortError`, `ApiError(0)` y el parseo de payload. Extraer una función `peticion()` común.

### B5. Accesibilidad de formularios
- **Estado (verificado):** cerrado en la rama de trabajo. Los campos de `components/forms/CamposRegistro.tsx` enlazan su texto de ayuda con `aria-describedby`, con un `id` por campo. Falta verificar con lector de pantalla.

### B6. Documentación con valores por defecto desfasados
- Verificado: los valores por defecto de `docs/07` y `docs/operacion/despliegue.md` (`RATE_LIMIT_MAX` 600, `CACHE_TTL_SECONDS` 60, `UPLOAD_MAX_MB` 20) coinciden con `config.ts`. No hay desfase que corregir en esas cifras.

---

## Plan de implementación paso a paso

Cada paso debe ir en su propio commit, sin footer de atribución, y con verificación antes de avanzar.

1. **Seguridad de escritura (A1, A2):** resuelto en código y desplegado. Pendiente: confirmar en Render las tres variables de sesión (ya lo indica `/salud`).
2. **Origen y CORS (A3):** validar `CORS_ORIGINS` en producción. Pruebas de `cargarConfig`.
3. **Protección de lectura de cargas (M1):** decidir con el usuario el alcance; después aplicar y probar.
4. **Límites de consulta (M2, M5):** `statement_timeout` y tope en CSV. Medir antes y después con una consulta de referencia.
5. **Trazabilidad de errores (M6):** incluir `request.id` en errores 500/503. Actualizar `openapi.json` si cambia el esquema (`npm run api:types`).
6. **CSP y cabeceras web (M3):** añadir CSP en `netlify.toml` y verificar que la app carga sin errores de consola.
7. **Pruebas de la web (M4):** `api.ts` y `lib/filters.ts`.
8. **Refactor de `api.ts` (B4):** solo después de tener pruebas del paso 7.
9. **CI (B2):** `docker build` en el workflow.
10. **Documentación y accesibilidad (B5, B6, B3):** cerrar al final.

## Notas y limitaciones
- Esta actualización es de lectura. La verificación de pruebas y builds se hizo en los commits de sesión (API `npm test` 56 pasan; 11 de paridad requieren `PARITY_DATABASE_URL`).
- No se revisaron `docs/` con detalle más allá de los nombres de archivo.
- Las decisiones de M1 y M3 requieren acuerdo con el usuario.
