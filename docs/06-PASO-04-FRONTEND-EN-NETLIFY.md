# PASO 4 · FRONTEND EN NETLIFY

**Duración estimada:** 4 días
**Depende de:** Paso 3 (contrato OpenAPI); puede iniciarse en paralelo con datos mock
**Bloquea a:** Paso 5 (publicación) y Paso 6 (QA visual)

**Objetivo:** replicar el tablero oscuro del Excel como SPA rápida, con filtros globales, tres pantallas y estados de carga/error explícitos. Cero cálculos de negocio en el navegador.

---

## 1. Rutas y navegación

| Ruta | Pantalla | Contenido |
|---|---|---|
| `/` | Dashboard ejecutivo | KPIs, 5 gráficas, alertas, Pareto resumido, matriz de gestión |
| `/registros` | Detalle | Tabla paginada, búsqueda, orden, export CSV |
| `/analisis` | Análisis | Pareto ABC completo, proyección con escenarios, comparativa mensual/semanal |
| `/registros/:id` | Ficha (fase 2) | Evento individual; en MVP se abre en un drawer |

Navegación: barra superior con marca, estado “LIVE”, selector de corte y 3 tabs. Sin sidebar permanente para ganar ancho en laptops de 1366 px.

---

## 2. Layout del dashboard

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ● CONTROL DE MERMAS   Lambayeque · Campaña 2026      [corte ▾]  LIVE      │
│ Última carga: 25/11 10:12 · 1,795 eventos · 108 SKUs                      │
├────────────────────────────────────────────────────────────────────────────┤
│ [ Mes ▾ ] [ Programa ▾ ] [ Familia ▾ ] [ Gestión ▾ ]      [Limpiar filtros]│
├────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │ MERMA TOTAL  │ │ CONTROLABE   │ │ VOLUMEN      │ │ CIERRE META  │        │
│ │ $17,999.60   │ │ $11,232.08   │ │ 14.90 pallets│ │ $19,735.03   │        │
│ │ 1,618 ev · $11.12 ticket      │ 62.4%         │ │ 2.40 pallets │ ahorro $2,121.63 │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
├───────────────────────────────────────┬────────────────────────────────────┤
│ Evolución mensual (barras)            │ Alertas de calidad                 │
│ 7 meses                               │ • 7 sin motivo · $1,118.13         │
│                                       │ • 4 posibles duplicados            │
├───────────────────────────────────────┴────────────────────────────────────┤
│ Tendencia semanal (línea) · 28 semanas · pico S40 · promedio ajustado      │
├──────────────────────────┬──────────────────────────┬──────────────────────┤
│ Ranking de motivos       │ Concentración por familia│ Impacto por programa │
│ (barras horizontales)    │ (anillo)                 │ (barras horizontales)│
├──────────────────────────┴──────────────────────────┴──────────────────────┤
│ Pareto Top 15 SKUs (tabla con barra de acumulado y clase ABC)             │
├────────────────────────────────────────────────────────────────────────────┤
│ Matriz de gestionabilidad y acuerdos (4 filas, % y decisión)              │
└────────────────────────────────────────────────────────────────────────────┘
```

Grid de 12 columnas, `gap-4`, contenedor `max-w-[1600px]`, padding `p-4 lg:p-6`.

---

## 3. Componentes

```text
components/
├── layout/
│   ├── Shell.tsx            # header + main + footer
│   ├── Topbar.tsx           # marca, corte, última carga, estado API
│   ├── FilterBar.tsx        # 4 selectores + limpiar + contador de resultados
│   └── Tabs.tsx
├── kpi/
│   ├── KpiCard.tsx          # etiqueta, valor, subtexto, delta, color, icono
│   └── KpiStrip.tsx         # 4 tarjetas + skeletons
├── charts/
│   ├── ChartCard.tsx        # título, subtítulo, acción, alto fijo, estado vacío
│   ├── MonthlyBars.tsx
│   ├── WeeklyLine.tsx
│   ├── MotivoBars.tsx
│   ├── FamiliaDonut.tsx
│   └── ProgramaBars.tsx
├── tables/
│   ├── DataTable.tsx        # genérica, orden y paginación
│   ├── ParetoTable.tsx
│   ├── GestionMatrix.tsx
│   └── RegistrosTable.tsx
├── feedback/
│   ├── AlertList.tsx
│   ├── Skeleton.tsx
│   ├── ErrorState.tsx       # mensaje + reintentar + código
│   ├── EmptyState.tsx
│   └── ColdStartNotice.tsx  # “Despertando el servidor…”
└── ui/
    ├── Card.tsx
    ├── Badge.tsx            # clases ABC, gestión, severidad
    ├── Segmented.tsx
    └── Money.tsx
```

### Regla de composición

Cada tarjeta recibe **datos ya calculados** y una función de formato. Ningún componente divide, acumula ni pondera. Si un porcentaje no viene de la API, es un bug.

---

## 4. Estado y datos

```tsx
// lib/api.ts
const BASE = import.meta.env.VITE_API_URL;

export async function getJson<T>(path: string, params: Record<string, string | string[]>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (Array.isArray(v)) v.filter(Boolean).forEach((x) => qs.append(k, x));
    else if (v) qs.set(k, v);
  });
  const res = await fetch(`${BASE}${path}?${qs}`, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json();
}
```

- **Filtros en la URL** (`useSearchParams`): `?desde=2026-05-08&hasta=2026-11-11&programa=GENÉRICO`. Permite compartir una vista exacta y volver atrás sin perder estado.
- `queryKey` = `["kpis", filtros]`, `["series-mensual", filtros]`, etc.
- `staleTime: 60_000`, `retry: 2`, `refetchOnWindowFocus: false`.
- `keepPreviousData` en series y cortes para que las gráficas no parpadeen al cambiar filtros.
- Sin Redux ni Zustand: el estado es la URL + la caché de consultas.

### Manejo de la API dormida (Render free)

```tsx
const { data, error, isPending, failureCount } = useQuery(kpisQuery(filtros));

if (isPending && failureCount > 0) return <ColdStartNotice />;  // tras el primer fallo
if (error) return <ErrorState onRetry={refetch} />;
```

`ColdStartNotice`: “El servidor está despertando (puede tardar ~40 s). Reintentando…”. No mostrar un error rojo en el primer intento.

---

## 5. Tema visual (tokens)

`tailwind.config.ts`:

```ts
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page:    "#0D1526",
        surface: "#111827",
        header:  "#162033",
        border:  "#1E293B",
        ink:     "#F8FAFC",
        muted:   "#94A3B8",
        cyan:    "#22D3EE",
        cyan600: "#06B6D4",
        orange:  "#FB923C",
        purple:  "#A78BFA",
        green:   "#34D399",
        amber:   "#FBBF24",
        red:     "#F43F5E",
      },
      fontFamily: {
        sans: ["Segoe UI", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(148,163,184,.08) inset, 0 8px 24px -12px rgba(0,0,0,.6)",
      },
      borderRadius: { card: "10px" },
    },
  },
} satisfies Config;
```

| Elemento | Especificación |
|---|---|
| Fondo | `bg-page` |
| Tarjeta | `bg-surface border border-border rounded-card shadow-card` |
| Título de sección | 11 px, mayúsculas, `tracking-[0.12em]`, `text-muted` |
| Cifra KPI | 30–36 px, semibold, color semántico |
| Subtexto | 12 px `text-muted` |
| Tabla | header `bg-header`, filas alternas `surface`/`header` con 40% opacidad |
| Badge A | `bg-red-500/15 text-red-300 ring-1 ring-red-500/30` |
| Badge B | `bg-amber-500/15 text-amber-300` |
| Badge C | `bg-slate-500/15 text-slate-300` |
| Foco | `focus-visible:ring-2 ring-cyan-400 ring-offset-2 ring-offset-page` |
| Contraste | Todo texto ≥ 4.5:1 sobre su fondo |

Colores por serie (consistencia con el Excel y con el significado):

| Serie | Color |
|---|---|
| Merma total | cian `#22D3EE` |
| Controlable | naranja `#FB923C` |
| Volumen | violeta `#A78BFA` |
| Meta / ahorro | verde `#34D399` |
| Por auditar | ámbar `#FBBF24` |
| Recuperable | esmeralda `#6EE7B7` |
| Peligro / pico | rojo `#F43F5E` |

---

## 6. Especificación de cada gráfica

| Gráfica | Tipo Recharts | Eje X | Eje Y | Detalles |
|---|---|---|---|---|
| Evolución mensual | `BarChart` vertical | `mes` (`2026-05`) formateado `may-26` | USD abreviado (`$9.1k`) | Barra `<Cell>` cian; tooltip: eventos, costo, %; radio 3 px arriba |
| Tendencia semanal | `LineChart` | `semana_iso` (`S19`) | USD | Línea `#22D3EE` 2 px, puntos 3 px; `ReferenceLine` en promedio ajustado (punteada, `#94A3B8`); puntos atípicos en `#FB923C`; etiqueta del pico |
| Ranking de motivos | `BarChart` horizontal (`layout="vertical"`) | costo | motivo | Orden descendente; color según gestión; tooltip con eventos y % |
| Concentración por familia | `PieChart` con `innerRadius={60}` | — | — | 8 colores; centro: total del rango; leyenda a la derecha con % |
| Impacto por programa | `BarChart` horizontal | costo | programa | Etiqueta de % al final de la barra |

Reglas comunes:

- `ResponsiveContainer` con altura fija (280–320 px) para evitar saltos de layout.
- `Tooltip` personalizado con fondo `#162033`, borde `#1E293B`, texto `#F8FAFC`.
- Sin animaciones largas: `isAnimationActive` solo en la primera carga, 400 ms.
- Sin `Legend` cuando hay una sola serie; el título ya lo dice.
- Eje Y con `tickFormatter` compacto (`$1.2k`), no con 6 decimales.

---

## 7. Tablas

### Pareto (`/analisis`)

| Columna | Formato | Ancho |
|---|---|---|
| # | entero | 40 px |
| Código | monoespaciado | 90 px |
| Descripción | truncada con tooltip | flexible |
| Familia | badge neutro | 120 px |
| Eventos | entero | 80 px |
| Costo | USD | 110 px |
| % part. | 2 decimales | 80 px |
| Acumulado | barra + % | 140 px |
| Clase | badge A/B/C | 110 px |

- Fila clase A con borde izquierdo rojo de 2 px.
- Click en fila → drawer con eventos del SKU (usa `/registros?codigo=…`).

### Registros

- Columnas: fecha, semana, código, descripción, familia, programa, cantidad + UM, motivo, gestión, costo, origen.
- Orden por `fecha desc` por defecto; header clickeable con `aria-sort`.
- Paginación server-side con selector 25/50/100 y texto “1–50 de 1,618”.
- Búsqueda con debounce 300 ms.
- Badge “dup” en filas con `es_duplicado`.
- Botón “Exportar CSV” que llama a `/registros.csv` con los filtros activos.
- En móvil: tarjetas apiladas, no scroll horizontal de 12 columnas.

### Matriz de gestionabilidad

| Estado | Eventos | Costo | % | Decisión |
|---|---:|---:|---:|---|
| Controlable | 1,418 | $11,232.08 | 62.40% | Reforzar estiba y calibrar etiquetadoras (meta −25%) |
| Estándar Técnico | 179 | $4,615.56 | 25.64% | Auditar AQL en contramuestras |
| Por Auditar | 7 | $1,118.13 | 6.21% | Regularizar motivos del 02/10 con Jefatura |
| Recuperable Proveedor | 14 | $1,033.83 | 5.74% | Emitir reclamo y nota de crédito |

La columna Decisión es **texto de negocio**, no un número: se mantiene como constante del frontend en un archivo `content/decisiones.ts`, revisable por el área. Todo lo demás viene de la API.

---

## 8. Estados y feedback

| Estado | UI |
|---|---|
| Cargando inicial | Skeletons con la misma altura que las tarjetas (sin layout shift) |
| Cambio de filtro | Datos anteriores atenuados (`opacity-60`) + spinner en la barra |
| Sin resultados | `EmptyState`: “No hay registros para estos filtros” + botón limpiar |
| Error 4xx | Mensaje del backend + código + “Reintentar” |
| Error 5xx / red | “No pudimos conectar con la API” + “Reintentar” + enlace a estado |
| API dormida | Aviso ámbar de arranque en frío (ver §4) |
| Datos parciales | Si falla una consulta, el resto se muestra y la tarjeta fallida muestra su error |

Accesibilidad:

- Skip link “Ir al contenido”.
- `aria-live="polite"` en el contador de resultados.
- Filtros con `<label>` visible; no solo placeholder.
- Gráficas con `<figure>` + `<figcaption>` y tabla de datos alternativa accesible (visualmente oculta).
- Navegación completa con teclado; foco visible.

---

## 9. Responsive

| Breakpoint | Layout |
|---|---|
| `< 640px` | 1 columna; filtros en drawer; KPIs en carrusel horizontal con snap; tablas como tarjetas |
| `640–1024px` | 2 columnas; KPIs 2×2; gráficas a ancho completo |
| `≥ 1024px` | 12 columnas según §2; KPIs 4×1 |
| `≥ 1536px` | Contenedor 1600 px, tipografía KPI 36 px |

---

## 10. Rendimiento

- Rutas con `React.lazy` + `Suspense`.
- Recharts en chunk propio (`manualChunks`), fuera del bundle inicial.
- Sin librería de fechas (usar `Intl.DateTimeFormat`).
- Sin icon-font: 8 iconos SVG inline.
- Presupuesto: JS inicial ≤ 250 KB gzip; LCP ≤ 2.5 s en 4G; CLS ≤ 0.05.
- `preconnect` a `VITE_API_URL` en `index.html`.

---

## 11. Configuración de Netlify

```toml
# netlify.toml (raíz del repo)
[build]
  base    = "apps/web"
  command = "npm ci && npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
  NPM_FLAGS    = "--no-audit --no-fund"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options        = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy        = "strict-origin-when-cross-origin"
    X-Robots-Tag           = "noindex, nofollow"

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

`.env.example`:

```bash
VITE_API_URL=https://merma-api.onrender.com
VITE_APP_TITLE=Control de Mermas · Lambayeque
```

---

## 12. Entregables

- [ ] SPA con 3 rutas funcionales y responsive.
- [ ] 5 gráficas + Pareto + matriz + alertas.
- [ ] Filtros persistidos en URL.
- [ ] Export CSV funcionando.
- [ ] `netlify.toml` y `.env.example`.
- [ ] Storybook o página `/dev/ui` con los componentes base (opcional, 2 h).
- [x] Pruebas unitarias de `formatters.ts` (moneda, porcentaje, semana, fecha).

---

## 13. Criterios de aceptación

| # | Criterio |
|---|---|
| 1 | El dashboard con “corte 28 semanas” muestra $17,999.60 / 1,618 / $11.12 / 62.40% |
| 2 | Cambiar a “todo el registro” muestra $20,383.75 / 1,795 |
| 3 | Filtrar `2026-09` deja la merma en $9,108.95 y el 50.61% |
| 4 | Filtrar `familia=ETIQUETAS` deja $5,635.05 y 732 eventos |
| 5 | La URL refleja los filtros y al recargar se mantiene la vista |
| 6 | Ningún texto de alerta o insight está escrito a mano con cifras |
| 7 | Sin scroll horizontal en 375 px de ancho |
| 8 | Lighthouse: Performance ≥ 90, Accessibility ≥ 95 en desktop |
| 9 | La API caída muestra ErrorState, no pantalla en blanco |
| 10 | Todas las gráficas tienen tooltip y tabla alternativa accesible |

---

## 14. Riesgos del paso

| Riesgo | Mitigación |
|---|---|
| Recharts no escala a 108 puntos | El Pareto se muestra como tabla, no como gráfica |
| Los decimales llegan como string y se concatenan | `Money` parsea con `Number()` solo para mostrar; nunca recalcula |
| Filtros múltiples generan URLs largas | Se limitan a 1 valor por dimensión en el MVP |
| Colores de gestión inconsistentes | Un único mapa `gestion → color` en `theme.ts` |

---

**Siguiente paso:** [`07-PASO-05-DESPLIEGUE-Y-CI-CD.md`](./07-PASO-05-DESPLIEGUE-Y-CI-CD.md).
