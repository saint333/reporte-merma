# Plan: Dashboard moderno de merma (frontend)

Documento de referencia para implementar el rediseño del dashboard **una fase a la vez**.
Cada fase es independiente, se puede revisar y desplegar por separado, y no cambia el contrato de la API.

## 1. Diagnóstico del estado actual

Stack: React 19 · PrimeReact 9 (tema `lara-dark-teal`) · PrimeIcons · Tailwind 4 · Recharts 3 · TanStack Query · React Router 7.

Lo que ya funciona y se conserva:

- Paleta propia en `lib/theme.ts` (`COLORES`, `GESTION_COLOR`, `FAMILIA_COLORES`) y tokens Tailwind en `styles.css`.
- Layout con sidebar, topbar, filtros y menú móvil (`Shell`, `Sidebar`, `Topbar`, `FilterBar`).
- Estados de carga (`Skeleton`), error (`ErrorState`), vacío (`EmptyState`) y arranque en frío (`ColdStartNotice`).
- Gráficos con Recharts y tabla accesible de respaldo en cada gráfico (`ChartTable`).
- Consultas en paralelo con TanStack Query.

Problemas detectados:

| # | Hallazgo | Dónde |
|---|----------|-------|
| 1 | La tabla Pareto es HTML a mano, con una versión de escritorio y otra móvil duplicadas. PrimeReact `DataTable` ya se usa en `RegistrosTable`. | `components/tables/ParetoTable.tsx` |
| 2 | La lógica de severidad/clase ABC (`A`→danger, `B`→warning) está repetida en dos bloques. | `ParetoTable.tsx` |
| 3 | La barra de acumulado es un `div` artesanal en lugar de `ProgressBar`. | `ParetoTable.tsx` (`BarraAcumulado`) |
| 4 | El encabezado de sección (título + subtítulo + acción) está duplicado en `Card` directos del dashboard y en `ChartCard`. | `DashboardPage.tsx` |
| 5 | `KpiCard` acepta `icono`, pero ningún KPI lo pasa. | `KpiStrip.tsx`, `KpiCard.tsx` |
| 6 | Las tarjetas KPI son solo número + texto: sin tendencia ni contexto visual. | `KpiCard.tsx` |
| 7 | Las alturas de gráfico son fijas (280/300/360 px) y no se adaptan al móvil. | `ChartCard`, `DashboardPage.tsx` |
| 8 | Estilos de PrimeReact sobrescritos en `styles.css` con selectores `.p-*` extensos, sin usar variables del tema. | `styles.css` |
| 9 | La "Matriz de gestionabilidad" usa `Card` con `title`, distinto del resto de secciones. | `DashboardPage.tsx` |

## 2. Qué agregar, mejorar o quitar

**Quitar**

- Versión móvil duplicada de la tabla Pareto (la cubre `DataTable` con `responsiveLayout="stack"`).
- Bloques de severidad duplicados (un solo helper).
- Encabezados de `Card` escritos a mano en el dashboard (un solo componente de sección).
- Clases `tag-app` / `tag-app-neutral` si `Tag` se puede estilar con `pt` o variables del tema.

**Mejorar con componentes PrimeReact**

- `DataTable` para Pareto: orden, filtro global, paginación, selección de fila, exportar CSV.
- `ProgressBar` para acumulado y participación.
- `SelectButton` para cambiar la métrica o la vista de gráficos (p. ej. costo / eventos).
- `Chip` o `Tag` para resúmenes de filtros activos.
- `Badge` en los títulos de sección para conteos (alertas, SKUs).
- `Divider` y `Panel` para separar bloques en móvil.
- `Tooltip` (directiva) para explicar cada KPI.

**Agregar (alcance mínimo)**

- Sparkline dentro de cada KPI usando `serieMensual` (datos ya disponibles).
- Indicador de tendencia (▲/▼) vs. periodo anterior, **solo si la API ya lo expone**; si no, queda como tarea aparte.
- Curva ABC (Pareto acumulado) con Recharts `ComposedChart`.
- Icono PrimeIcons por KPI (`pi-dollar`, `pi-exclamation-triangle`, `pi-box`, `pi-flag`).

**No hacer en este plan**

- Cambiar la paleta ni el tema base (`lara-dark-teal`).
- Cambiar contratos de la API o consultas de TanStack Query.
- Agregar librerías nuevas de gráficos o de UI.

## 3. Fases de implementación

Marcar cada casilla al terminar. Orden recomendado: de la base visual hacia lo funcional.

### Fase 1 — Base de secciones y KPIs
- [x] Crear `components/layout/SectionCard.tsx` (título, subtítulo, acción, `Badge` opcional) basado en `Card` de PrimeReact.
- [x] Reemplazar los `Card` con header manual de `DashboardPage.tsx` (Alertas, Pareto, Matriz) por `SectionCard`.
- [x] Hacer que `ChartCard` use `SectionCard` internamente.
- [x] Pasar iconos PrimeIcons en `KpiStrip` a `KpiCard`.
- [x] Agregar `Tooltip` a las KPI con la definición del indicador.

**Criterio de aceptación:** todas las tarjetas del dashboard tienen el mismo encabezado; los KPIs muestran icono; sin cambios de datos.

### Fase 2 — KPIs con contexto visual
- [x] Agregar sparkline opcional a `KpiCard` (Recharts `AreaChart` mínimo, sin ejes), alimentado por `serieMensual`.
- [x] Mostrar tendencia solo si la API tiene comparación de periodo; si no, dejar nota en este documento.

**Nota de la Fase 2:** la API ya expone `variacion_ultima_semana` (`apps/api/src/services/kpis.ts`): fracción de cambio del costo de la última semana del rango contra la anterior. Por eso la tendencia se muestra como "vs. semana anterior" y no contra un periodo histórico; comparar contra un periodo previo requeriría un campo nuevo en la API. El tooltip de PrimeReact no acepta un `ref`, así que `KpiCard` lo resuelve con estado y el callback de ref del icono.

**Criterio de aceptación:** cada KPI de costo muestra su mini tendencia; en estado de carga se muestra `Skeleton` también para el sparkline.

### Fase 3 — Tabla Pareto con DataTable
- [x] Reemplazar `ParetoTable` (tabla HTML + lista móvil) por `DataTable` de PrimeReact con `responsiveLayout="stack"`.
- [x] Columnas: rank, código, descripción, familia, eventos, costo, participación, acumulado (con `ProgressBar`), clase ABC (`Tag`).
- [x] Unificar la severidad ABC en un único helper (`claseAbcSeveridad`).
- [x] Mantener `onRowClick` → `ParetoDrawer`, con soporte de teclado nativo de `DataTable`.
- [x] Agregar paginador (10 filas) y filtro global.
- [x] Botón exportar CSV (función nativa de `DataTable`).

**Criterio de aceptación:** misma información que hoy; en móvil cada fila se apila; el drawer sigue abriéndose con clic y con Enter.

### Fase 4 — Gráficos: estilo y responsive
- [x] Quitar alturas fijas: usar altura por breakpoint (ej. 220 px móvil, 300 px escritorio) en `ChartCard`.
- [x] Unificar tooltips (`ChartTooltip`) y ejes (tamaño de fuente, colores de `COLORES.muted`).
- [x] Agregar gradiente de área en `WeeklyLine` y `MonthlyBars`.
- [x] En `FamiliaDonut`, mover la leyenda debajo del gráfico en pantallas pequeñas.
- [x] Agregar `SelectButton` para alternar la métrica (costo / eventos) en `MonthlyBars`.

**Criterio de aceptación:** ningún gráfico se corta ni se desborda en 360 px; los tooltips respetan la paleta.

### Fase 5 — Curva ABC
- [x] Nuevo `components/charts/ParetoCurva.tsx`: barras de costo por SKU + línea de acumulado (`ComposedChart`), con línea de referencia al 80 %.
- [x] Colocarlo en la sección Pareto, arriba de la tabla, en la vista de escritorio.

**Criterio de aceptación:** la línea de 80 % coincide con el corte A/B de la tabla.

### Fase 6 — Limpieza de estilos
- [x] Reducir en `styles.css` los selectores `.p-*` a los necesarios, usando variables de PrimeReact (`--primary-color`, `--surface-*`) para el tema.
- [ ] Eliminar clases `tag-app` / `tag-app-neutral` si ya no son necesarias.
- [ ] Revisar contraste de texto `muted` sobre `surface` (WCAG AA).

**Criterio de aceptación:** el aspecto visual no cambia de forma no deseada; el código de estilos es más corto.

### Fase 7 — Verificación final
- [ ] `npm run typecheck` y `npm run build` en `apps/web` sin errores.
- [ ] Revisión visual en 360 px, 768 px, 1280 px y 1920 px (dashboard, Pareto, drawer, sidebar móvil).
- [ ] Estados: carga, error, vacío y arranque en frío.
- [ ] Actualizar `docs/06-PASO-04-FRONTEND-EN-NETLIFY.md` si cambian las instrucciones de despliegue (no debería).

## 4. Riesgos y decisiones

- **Tendencia vs. periodo anterior** depende de la API. No se inventa en el frontend.
- **DataTable con datos grandes:** el Pareto ya viene limitado (top 15 en el dashboard); la paginación evita render pesado.
- **Recharts y PrimeReact conviven:** los gráficos siguen siendo Recharts; PrimeReact solo aporta componentes de UI.
- **Responsive:** las alturas de gráfico y las tablas son el punto más frágil; revisar primero en 360 px.

## 5. Cómo usar este documento

Implementar una fase, verificar su criterio de aceptación, marcar sus casillas y recién después pasar a la siguiente. Cada fase se puede pedir por separado.
