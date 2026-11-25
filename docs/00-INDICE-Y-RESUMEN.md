# PLAN DE CONSTRUCCIÓN — REPORTE DE MERMA DIARIA GERENCIAL

**Documento índice** · Versión 1.0 · 25/11/2026
**Origen analizado:** `REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx`
**Destino:** aplicación web (frontend estático) + API Node.js, publicados en **Netlify** (web) y **Render** (API).

---

## 1. Qué se revisó

Se abrió el libro completo y se inspeccionó, hoja por hoja, celda por celda:

| Elemento | Cantidad revisada |
|---|---|
| Hojas | 6 (2 visibles, 4 ocultas) |
| Filas de datos en el registro | 1,795 (05/08/2026 – 23/11/2026) |
| SKUs en el maestro | 108 |
| Motivos en el catálogo | 13 |
| Celdas con fórmula | ~22,000 (12 por fila en el registro + hojas de reporte) |
| Gráficas | 5 (columnas, línea, barras, anillo) |
| Slicers (validación de datos) | 4 (Mes, Programa, Familia, Gestionabilidad) |
| Rangos combinados | 85 en el dashboard |
| Formato condicional | 3 rangos en dashboard + 4 en otras hojas |

Detalle completo: [`01-ANALISIS-DEL-EXCEL.md`](./01-ANALISIS-DEL-EXCEL.md).

---

## 2. Resumen ejecutivo (5 hallazgos que cambian el diseño)

1. **El dashboard no cubre todos los datos.** Todas las fórmulas usan `filas 5:1622`, es decir, hasta el **11/11/2026**. Existen **177 registros más** (12–23/11/2026) por **$2,384.15** que ningún KPI, gráfica ni consolidado semanal toma en cuenta. El total real del libro es **$20,383.75**, no **$17,999.60**. La app no puede heredar ese rango fijo: debe calcular por **rango de fechas**, no por filas.

2. **Los textos del dashboard están desactualizados respecto de sus propias fórmulas.** Son cajas de texto escritas a mano:
   - Dice “ahorro meta $1,124.21 · cierre $20,732.45”, pero la fórmula da **$2,121.63** y **$19,735.03**.
   - Dice “Etiquetas 44.9% + Clamshell 29.3% = 74.2%”, pero los datos dan **31.31% + 28.51% = 59.82%**.
   - Dice “pico en Semana 39 · $5,635”, pero el pico real es **Semana 40: $5,579.31** (la S39 fue $3,510.14).
   En la app **ningún texto de negocio se escribe a mano**: todos los “insights” se generan desde la data.

3. **El registro diario no tiene validación de motivo.** Por eso apareció el motivo `MALA IMPRESIÓN`, que no existe en el catálogo, y 7 registros `SIN CLASIFICAR` del 02/10 por **$1,118.13**. El catálogo debe aplicarse como clave foránea + alias, no como texto libre.

4. **La métrica “PALLETS EQUIV.” es heterogénea.** Se calcula dividiendo cantidad entre “unidades por pallet”, pero el maestro tiene desde 1 unidad/pallet (malla antiafida) hasta 3,000,000 (etiquetas). Sumar pallets es válido como indicador de capacidad, pero **no** como unidad física auditable. Debe rotularse “pallets equivalentes” y no usarse para inventario.

5. **El libro es un snapshot, no un sistema.** Rangos `5:1622` repetidos en ~40 fórmulas, 6 semanas de proyección fijas, factor `0.624` incrustado y 4 slicers que solo filtran el dashboard (no la proyección, ni el consolidado, ni el maestro). La app reemplaza eso con consultas parametrizadas y una sola definición de cada KPI.

**Conclusión:** el Excel es una buena especificación funcional y un mal sistema de registro. El plan lo convierte en un modelo de datos normalizado + API de agregación + dashboard web, replicando **exactamente** los números de control de la sección 4.

---

## 3. Decisiones ya tomadas (y su porqué)

| Decisión | Elección | Motivo |
|---|---|---|
| Frontend | **React + Vite + TypeScript + Tailwind + Recharts** | SPA estática, build directo en Netlify, ecosistema de gráficas maduro para el look “dark BI”. |
| Backend | **Node.js 22 + Fastify + TypeScript** | Un solo lenguaje entre web y API: los tipos del contrato se comparten. Fastify es liviano, con validación Zod y OpenAPI; las agregaciones se hacen en SQL y el dinero se opera con `decimal.js`, no con `number`. |
| Base de datos | **PostgreSQL** (Neon free; alternativa Render Postgres) | 1,795 filas hoy, pero crecerá a diario; SQL hace las agregaciones y filtros que hoy hacen 40 SUMIFS. |
| Hosting web | **Netlify** | Requisito del usuario. Build estático, CDN, previews por PR. |
| Hosting API | **Render** | Requisito del usuario. Runtime Node nativo o Docker, healthcheck y blueprint `render.yaml`. |
| Alcance del MVP | **Solo lectura** (dashboard + registros + catálogos) | Es lo que el Excel hace hoy. La escritura/import se planifica en fase 2. |
| Idioma de la UI | Español (Perú), moneda USD, fechas `dd/mm/aaaa` | Consistente con el libro y el negocio. |

Arquitectura completa: [`02-ARQUITECTURA-Y-STACK.md`](./02-ARQUITECTURA-Y-STACK.md).

---

## 4. Cifras de control (la app debe reproducirlas al centavo)

Estas cifras salen de las fórmulas del libro, no de los textos. Serán la base de las pruebas de reconciliación del Paso 6.

### 4.1 Ventana del dashboard (08/05/2026 – 11/11/2026, 28 semanas ISO)

| KPI | Valor |
|---|---|
| Merma total valorizada | **$17,999.60** |
| Eventos | **1,618** |
| Ticket promedio | **$11.12** |
| Merma controlable | **$11,232.08** (62.40%) |
| Volumen (pallets equiv.) | **14.90** |
| SKUs con merma / total | **79 / 108** |

### 4.2 Serie mensual

| Mes | Eventos | Costo | % |
|---|---:|---:|---:|
| 2026-05 | 84 | $162.37 | 0.90% |
| 2026-06 | 172 | $430.11 | 2.39% |
| 2026-07 | 285 | $1,030.52 | 5.73% |
| 2026-08 | 295 | $1,844.82 | 10.25% |
| 2026-09 | 320 | $9,108.95 | **50.61%** |
| 2026-10 | 332 | $3,840.78 | 21.34% |
| 2026-11 (corte 11/11) | 130 | $1,582.05 | 8.79% |
| **Total** | **1,618** | **$17,999.60** | **100%** |

### 4.3 Ranking de motivos (top 6)

| Motivo | Gestión | Eventos | Costo | % |
|---|---|---:|---:|---:|
| CONTRAMUESTRA | Estándar Técnico | 37 | $3,594.01 | 19.97% |
| APILADO | Controlable | 407 | $3,468.37 | 19.27% |
| ROTURA DE EMBALAJES | Controlable | 698 | $2,833.14 | 15.74% |
| ERROR DE IMPRESIÓN | Controlable | 46 | $1,530.67 | 8.50% |
| REEMPAQUE | Controlable | 182 | $1,278.65 | 7.10% |
| SIN CLASIFICAR | Por Auditar | 7 | $1,118.13 | 6.21% |

### 4.4 Familias de material

| Familia | Eventos | Costo | % |
|---|---:|---:|---:|
| ETIQUETAS | 732 | $5,635.05 | 31.31% |
| CLAMSHELL | 464 | $5,132.46 | 28.51% |
| BOLSAS | 7 | $3,897.00 | 21.65% |
| CAJAS | 365 | $2,024.86 | 11.25% |
| MOLDES | 22 | $863.48 | 4.80% |
| INTERCONECTORES | 19 | $258.46 | 1.44% |
| RIBBON | 4 | $102.76 | 0.57% |
| PALLETS | 5 | $85.54 | 0.48% |

### 4.5 Programas / clientes

| Programa | Eventos | Costo | % |
|---|---:|---:|---:|
| GENÉRICO | 663 | $14,007.74 | 77.82% |
| UNITED EXPORT | 176 | $2,002.31 | 11.12% |
| UNIFRUTTI | 218 | $973.29 | 5.41% |
| ALPINE FRESH | 520 | $872.04 | 4.84% |
| SUNBELLE | 41 | $144.22 | 0.80% |

### 4.6 Proyección de cierre 2026

| Parámetro / escenario | Valor |
|---|---|
| Acumulado real (C5) | $17,999.60 |
| Promedio semanal global (C6) | $642.84 |
| Promedio semanal excluyendo semanas ≥ $3,000 (C7) | $342.70 (26 semanas) |
| Semanas restantes (C8) | 6 |
| Meta de reducción de merma controlable (C9) | 25% |
| A. Tendencial (sin intervención) | $21,856.66 |
| B. Base operativo (sin S39/S40) | $20,055.79 · ahorro $1,800.87 |
| C. Meta optimizada | **$19,735.03** · ahorro **$2,121.63** |

Fórmula exacta de la meta: `C5 + (C7 × (1 − (C9 × 0.624))) × 6`, donde `0.624` es la participación de la merma controlable. En la app ese factor se **calcula**, no se escribe.

### 4.7 Pareto ABC

- Top 15 SKUs = **$14,596.51** (81.09% del total).
- Clase A (corte 80% acumulado) = **14 SKUs** ($14,276.93, 79.32%).
- SKU #1: `13060001` BOLSA ATMÓSFERA 4KG — $3,885.00 (21.58%, solo 6 eventos).
- SKU #2: `31030001` CLAMSHELL 4.4 OZ — $2,689.66 (14.94%, 127 eventos).

### 4.8 Datos totales (incluyendo los 177 registros huérfanos)

| KPI | Valor |
|---|---|
| Merma total | **$20,383.75** |
| Eventos | **1,795** |
| Controlable | **$13,575.65** (66.59%) |
| Pallets equiv. | **17.30** |
| Rango de fechas | 08/05/2026 – 23/11/2026 |

> La diferencia entre 4.1 y 4.8 **no es un error de cálculo**: es la consecuencia del rango fijo `5:1622`. El plan resuelve esto con el selector de período y una vista guardada “corte 28 semanas”.

---

## 5. Mapa de documentos (el plan, paso por paso)

| # | Documento | Qué contiene | Entregable |
|---|---|---|---|
| — | [`01-ANALISIS-DEL-EXCEL.md`](./01-ANALISIS-DEL-EXCEL.md) | Auditoría completa: hojas, modelo, fórmulas, gráficas, calidad de datos | Informe |
| — | [`02-ARQUITECTURA-Y-STACK.md`](./02-ARQUITECTURA-Y-STACK.md) | Arquitectura Netlify + Render + Postgres, repo, entornos | Diagrama + decisiones |
| 1 | [`03-PASO-01-MODELO-DE-DATOS.md`](./03-PASO-01-MODELO-DE-DATOS.md) | DDL, claves, índices, reglas de cálculo, diccionario de datos | Esquema en Postgres |
| 2 | [`04-PASO-02-ETL-E-INGESTA.md`](./04-PASO-02-ETL-E-INGESTA.md) | Carga del `.xlsx`, limpieza, deduplicación, idempotencia | Script `etl/load-xlsx.ts` |
| 3 | [`05-PASO-03-API-EN-RENDER.md`](./05-PASO-03-API-EN-RENDER.md) | Endpoints, servicios de agregación, caché, tests, Docker | API desplegable |
| 4 | [`06-PASO-04-FRONTEND-EN-NETLIFY.md`](./06-PASO-04-FRONTEND-EN-NETLIFY.md) | Pantallas, componentes, filtros, tema visual, performance | SPA desplegable |
| 5 | [`07-PASO-05-DESPLIEGUE-Y-CI-CD.md`](./07-PASO-05-DESPLIEGUE-Y-CI-CD.md) | Neon, Render, Netlify, variables, dominios, rollback | URL productiva |
| 6 | [`08-PASO-06-CALIDAD-Y-RECONCILIACION.md`](./08-PASO-06-CALIDAD-Y-RECONCILIACION.md) | Pruebas de paridad numérica, QA, monitoreo, criterios de aceptación | Suite verde |
| 7 | [`09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md`](./09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md) | Fases, estimación, riesgos, decisiones pendientes | Backlog priorizado |

---

## 6. Orden de ejecución y dependencias

```text
Paso 1 (modelo)  ──►  Paso 2 (ETL)  ──►  Paso 3 (API)  ──►  Paso 4 (frontend)
                                              │                    │
                                              └────► Paso 5 (despliegue) ◄──┘
                                                          │
                                                          ▼
                                                   Paso 6 (QA / paridad)
                                                          │
                                                          ▼
                                                   Paso 7 (roadmap)
```

- Los pasos 1 y 2 son bloqueantes para todo lo demás.
- El paso 4 puede arrancar en paralelo al 3 usando un contrato OpenAPI con datos mock, pero no se publica sin el 3.
- El paso 5 se ejecuta una vez, temprano, con un “hola mundo” para validar credenciales y CORS; se repite al final.
- El paso 6 no se cierra hasta que las 8 tablas de la sección 4 coincidan con tolerancia ±$0.01.

---

## 7. Estimación

| Paso | Esfuerzo (1 dev full-stack) |
|---|---|
| 1. Modelo de datos | 0.5 día |
| 2. ETL e ingesta | 1.5 días |
| 3. API + tests | 3 días |
| 4. Frontend | 4 días |
| 5. Despliegue y CI/CD | 1 día |
| 6. Calidad y reconciliación | 1.5 días |
| **Total MVP** | **11.5 días hábiles** (~2.5 semanas calendario) |

Fase 2 (escritura, import, auth): ver [`09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md`](./09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md).

---

## 8. Qué NO incluye este plan

- No modifica el archivo Excel original (queda intacto como respaldo y especificación).
- No define autenticación de usuarios en el MVP (se evalúa en fase 2; ver riesgos).
- No integra el ERP Frusys en vivo (la fuente sigue siendo el archivo/carga manual).
- No incluye aplicación móvil ni notificaciones push.
- No reemplaza el juicio del área: automatiza el cálculo y la visualización, no la clasificación de motivos.

---

**Siguiente acción:** leer `01-ANALISIS-DEL-EXCEL.md` y firmar las 3 decisiones abiertas de la sección 6 de `09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md` antes de escribir código.
