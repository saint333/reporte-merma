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

## Cifras que la app debe reproducir

| Ventana | Eventos | Merma |
|---|---:|---:|
| Corte 28 semanas (08/05–11/11) | 1,618 | $17,999.60 |
| Registro completo (08/05–23/11) | 1,795 | $20,383.75 |

## Estado

- **Paso 1 implementado:** esquema Postgres, migraciones SQL y verificación en `apps/api`.
- Pasos 2 a 7: planificados en `docs/`.
- El Excel original está en la raíz y no se modifica; se copiará a `data/source/` al iniciar el Paso 2.

### Levantar el esquema local

```bash
docker compose up -d db
cd apps/api
npm install
cp .env.example .env
npm run db:migrate
npm run db:check     # 6 tablas · 2 vistas · 13 motivos · 3 parámetros
```

## Antes de empezar

Firmar las decisiones D1–D4 de [09 · Roadmap](docs/09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md#5-decisiones-abiertas-requieren-firma).
