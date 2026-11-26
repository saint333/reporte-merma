# Auditoría del proyecto (API + Web)

Fecha: 2026-11-26
Alcance: `apps/api` (Fastify, pg, ETL), `apps/web` (React, PrimeReact, Recharts), CI/CD, despliegue y documentación.
Método: lectura del código, búsqueda de patrones de riesgo y revisión de configuración. **No se ejecutaron pruebas ni se revisó la UI en navegador en esta auditoría.** Los hallazgos son lecturas del código y deben confirmarse antes de implementar.

## Resumen

| Prioridad | Cantidad | Tema principal |
|---|---|---|
| Alta | 3 | Escritura abierta por defecto; carga de archivos sin token; CORS/origen |
| Media | 6 | Lectura de cargas sin protección; sin paginación en CSV; cobertura de pruebas web; tokens en sessionStorage; errores sin ID; consultas sin límite de tiempo |
| Baja | 6 | Documentación desfasada, ruta de Docker, accesibilidad, duplicación de código, etc. |

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

### A1. Escritura abierta por defecto
- **Dónde:** `apps/api/src/http/autorizacion.ts`, `routes/registros.ts` (POST, PATCH, DELETE), `routes/cargas.ts` (POST).
- **Qué pasa:** si `ADMIN_TOKEN` no está definido, `exigirAutorizacion` retorna sin validar. Cualquiera con acceso a la URL pública de Render puede crear, editar, borrar eventos o reemplazar datos con `modo=replace&confirmar=true`.
- **Riesgo:** pérdida o alteración de datos de merma en producción.
- **Propuesta:** en `config.ts`, exigir `ADMIN_TOKEN` cuando `APP_ENV=production` (fallar al arrancar). Mantener el modo abierto solo en `development` y `test`. Documentar en `render.yaml` que el token es obligatorio.

### A2. Carga de Excel y reemplazo de datos sin token en producción
- **Dónde:** `routes/cargas.ts`, y `render.yaml` (comentario: "Sin ella la carga queda abierta").
- **Qué pasa:** la misma causa que A1, pero con impacto mayor: `modo=replace` borra hechos de la carga previa (`load-xlsx.ts`, línea ~652).
- **Propuesta:** se resuelve junto con A1. Además, el archivo se carga entero en memoria con `toBuffer()`; con el límite de 20 MB está acotado, pero conviene documentarlo.

### A3. CORS y origen de la API
- **Dónde:** `config.ts` (`CORS_ORIGINS` por defecto `http://localhost:5173`), `app.ts` (`credentials: false`, métodos incluyen `PATCH` y `DELETE`).
- **Qué pasa:** el valor por defecto es local, así que en producción debe definirse; si se omite, el navegador de Netlify falla (no es un hueco de seguridad, sino una fuente de errores). El riesgo real es que `CORS_ORIGINS` acepte comodines o listas amplias en el futuro.
- **Propuesta:** en producción, rechazar `CORS_ORIGINS` vacío o con `localhost`. Validar que cada origen sea una URL `https://`.

---

## Hallazgos de prioridad media

### M1. Lectura de historial de cargas sin protección
- **Dónde:** `routes/cargas.ts`, `GET /api/v1/cargas`.
- **Qué pasa:** expone nombres de archivo, fechas, costos y modo de carga sin autorización. Es información de negocio.
- **Propuesta:** aplicar `exigirAutorizacion` en lectura solo si hay token, o limitar los campos devueltos (ocultar `archivo`). Decidir con el usuario qué es sensible.

### M2. Exportación CSV sin límite de filas
- **Dónde:** `services/registros.ts`, `consultarRegistrosCsv` (sin `limit`) y `routes/registros.ts` (`/api/v1/registros.csv`).
- **Qué pasa:** con filtros amplios (todo el histórico) la consulta carga todo en memoria y arma el CSV completo en una sola respuesta. Con el volumen actual del Excel no es crítico, pero crece con cada carga.
- **Propuesta:** añadir tope (p. ej. 50 000 filas, con aviso al usuario) o streaming con `pg-cursor`/`COPY`. Medir antes de implementar.

### M3. Tokens de administración en sessionStorage
- **Dónde:** `apps/web/src/lib/api.ts` (`leerTokenAdmin`, `guardarTokenAdmin`).
- **Qué pasa:** cualquier script que se ejecute en el origen puede leer la clave. Se acepta como compromiso (sesión, no `localStorage`), pero conviene documentarlo como riesgo residual.
- **Propuesta:** mantener sessionStorage y añadir una cabecera CSP restrictiva en `netlify.toml` (hoy solo hay X-Frame-Options, nosniff, Referrer-Policy y X-Robots-Tag). Esto es relevante porque `helmet` en la API tiene `contentSecurityPolicy: false`, pero en la web no hay CSP.

### M4. Cobertura de pruebas en la web
- **Dónde:** `apps/web` solo tiene `src/lib/formatters.test.ts`.
- **Qué pasa:** no hay pruebas de `api.ts` (manejo de errores, token), de formularios (`CamposRegistro`, `NuevoRegistroPage`, `EditarRegistroPage`) ni de `lib/filters.ts`, `lib/fechas.ts`.
- **Propuesta:** pruebas unitarias para `api.ts` (errores `ApiError`, `construirUrl`) y `lib/filters.ts`. Pruebas de componentes solo para formularios.

### M5. Consultas sin límite de tiempo en la API
- **Dónde:** `services/*.ts` (kpis, series, pareto, cortes, alertas). Solo `salud.ts` tiene timeout de 2 s.
- **Qué pasa:** una consulta lenta (rango amplio, muchos filtros) bloquea una conexión del pool; con el plan gratuito de Render y Neon, el pool es pequeño.
- **Confirmado:** `db.ts` crea el pool con `max: 5` y sin `statement_timeout`.
- **Propuesta:** configurar `statement_timeout` en `db.ts` (p. ej. 10 s) y revisar `max` del pool.

### M6. Errores de base y de validación sin identificador de incidente
- **Dónde:** `http/errores.ts`.
- **Qué pasa:** el cliente recibe `ERROR_INTERNO` sin ID; `x-request-id` existe en las cabeceras, pero el mensaje no lo incluye. Dificulta correlacionar con logs de Render.
- **Propuesta:** incluir `request.id` en `detalle` de los errores 500 y 503.

---

## Hallazgos de prioridad baja

### B1. Ruta del Dockerfile no comprobada en la auditoría
- `render.yaml` apunta a `./apps/api/Dockerfile`. El archivo existe. El Dockerfile copia `dist` y ejecuta `node dist/server.js`, correcto para `tsc -p tsconfig.build.json`. Solo verificar que el build se ejecuta en CI (hoy no se construye la imagen).

### B2. CI no construye la imagen Docker
- `.github/workflows/ci.yml` ejecuta pruebas, typecheck y build de la web, pero no `docker build` de la API (confirmado: no aparece la palabra `docker` en el workflow). Un fallo del Dockerfile se descubre solo en Render.
- **Propuesta:** añadir un paso `docker build apps/api` en CI.

### B3. Duplicación de lógica de fechas
- Hay `apps/api/src/etl/fechas.ts` y `apps/api/src/http/fechas.ts` con responsabilidades parecidas. Revisar si se pueden unificar sin cambiar comportamiento; el coste es bajo.

### B4. Duplicación de `fetch` en `api.ts`
- `getJson`, `enviarJson`, `subirCarga`, `crearRegistroManual` y `descargarCsv` repiten el manejo de `AbortError`, `ApiError(0)` y el parseo de payload. Extraer una función `peticion()` común.

### B5. Accesibilidad de formularios
- Confirmado: `components/forms/CamposRegistro.tsx` no contiene atributos `aria-*`. Revisar `aria-invalid`/`aria-describedby` para los errores de cada campo y verificar con lector de pantalla antes de cerrar.

### B6. Documentación con valores por defecto desfasados
- `render.yaml` dice `UPLOAD_MAX_MB: 20`, coincide con el código. Revisar `docs/05-PASO-03-API-EN-RENDER.md` y `docs/operacion/despliegue.md` contra `config.ts` (p. ej. `RATE_LIMIT_MAX`, `CACHE_TTL_SECONDS`) porque no se contrastaron línea a línea.

---

## Plan de implementación paso a paso

Cada paso debe ir en su propio commit, sin footer de atribución, y con verificación antes de avanzar.

1. **Seguridad de escritura (A1, A2):** exigir `ADMIN_TOKEN` en `APP_ENV=production`; pruebas de `exigirAutorizacion` y de `config.ts`. Verificar con `npm test` en `apps/api`.
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
- Esta auditoría es de lectura. No se ejecutaron `npm test`, `typecheck` ni builds en esta sesión.
- No se revisaron `docs/` con detalle más allá de los nombres de archivo.
- Las decisiones de M1 y M3 requieren acuerdo con el usuario.
