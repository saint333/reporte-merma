# PASO 6 · CALIDAD Y RECONCILIACIÓN NUMÉRICA

**Duración estimada:** 1.5 días
**Depende de:** Pasos 2, 3, 4 y 5
**Bloquea a:** salida a producción

**Objetivo:** demostrar, con pruebas automáticas, que la app reproduce el Excel al centavo y que cualquier diferencia futura se detecta antes de llegar al directorio.

---

## 1. Principio

> Si un número no tiene una prueba que lo respalde, ese número es una opinión.

La paridad se mide contra **las fórmulas del libro**, no contra los textos del dashboard (que están desactualizados, ver H2 del documento 01). Por eso el fixture se genera leyendo el libro y tomando el **resultado cacheado** de cada celda con fórmula (`cell.value.result` en `exceljs`), no el texto visible.

---

## 2. Fixture de referencia

`apps/api/tests/fixtures/valores_excel.json`:

```json
{
  "fuente": "REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx",
  "generado_en": "2026-11-25",
  "ventana": { "desde": "2026-05-08", "hasta": "2026-11-11", "semanas": 28 },
  "kpis": {
    "merma_total": "17999.6033",
    "eventos": 1618,
    "ticket_promedio": "11.1246",
    "merma_controlable": "11232.0822",
    "controlable_pct": "0.6240",
    "pallets_equiv": "14.898022",
    "skus_con_merma": 79,
    "skus_total": 108
  },
  "mensual": [
    { "mes": "2026-05", "eventos": 84,  "costo": "162.3657" },
    { "mes": "2026-06", "eventos": 172, "costo": "430.1129" },
    { "mes": "2026-07", "eventos": 285, "costo": "1030.5183" },
    { "mes": "2026-08", "eventos": 295, "costo": "1844.8215" },
    { "mes": "2026-09", "eventos": 320, "costo": "9108.9505" },
    { "mes": "2026-10", "eventos": 332, "costo": "3840.7848" },
    { "mes": "2026-11", "eventos": 130, "costo": "1582.0496" }
  ],
  "motivos": [
    { "clave": "CONTRAMUESTRA", "eventos": 37,  "costo": "3594.0076", "participacion": "0.1997" },
    { "clave": "APILADO", "eventos": 407, "costo": "3468.3697", "participacion": "0.1927" },
    { "clave": "ROTURA DE EMBALAJES", "eventos": 698, "costo": "2833.1381", "participacion": "0.1574" },
    { "clave": "ERROR DE IMPRESIÓN", "eventos": 46, "costo": "1530.6745", "participacion": "0.0850" },
    { "clave": "REEMPAQUE", "eventos": 182, "costo": "1278.6451", "participacion": "0.0710" }
  ],
  "familias": [
    { "clave": "ETIQUETAS", "eventos": 732, "costo": "5635.0527" },
    { "clave": "CLAMSHELL", "eventos": 464, "costo": "5132.4603" },
    { "clave": "BOLSAS", "eventos": 7, "costo": "3897.0009" },
    { "clave": "CAJAS", "eventos": 365, "costo": "2024.8598" }
  ],
  "programas": [
    { "clave": "GENÉRICO", "eventos": 663, "costo": "14007.7370" },
    { "clave": "UNITED EXPORT", "eventos": 176, "costo": "2002.3145" },
    { "clave": "UNIFRUTTI", "eventos": 218, "costo": "973.2948" },
    { "clave": "ALPINE FRESH", "eventos": 520, "costo": "872.0374" },
    { "clave": "SUNBELLE", "eventos": 41, "costo": "144.2196" }
  ],
  "gestion": [
    { "clave": "Controlable", "eventos": 1418, "costo": "11232.0822" },
    { "clave": "Estándar Técnico", "eventos": 179, "costo": "4615.5632" },
    { "clave": "Por Auditar", "eventos": 7, "costo": "1118.1265" },
    { "clave": "Recuperable Proveedor", "eventos": 14, "costo": "1033.8314" }
  ],
  "pareto": {
    "top_15_costo": "14596.5068",
    "top_15_participacion": "0.810935",
    "clase_a": 14,
    "clase_a_costo": "14276.9289",
    "clase_a_participacion": "0.793180",
    "primer_sku": { "codigo": 13060001, "costo": "3885.0000", "participacion": "0.215838" }
  },
  "proyeccion": {
    "acumulado": "17999.6033",
    "promedio_global": "642.8430",
    "promedio_ajustado": "342.6986",
    "semanas_excluidas": [39, 40],
    "tendencial": "21856.6611",
    "base": "20055.7947",
    "meta": "19735.0289",
    "ahorro_meta": "2121.6323"
  },
  "volumen_completo": {
    "registros": 1795,
    "costo": "20383.7500",
    "controlable": "13575.6500",
    "pallets": "17.300000",
    "desde": "2026-05-08",
    "hasta": "2026-11-23"
  }
}
```

### Cómo se genera

`apps/api/scripts/generar-fixture.ts` abre el Excel con `exceljs`, lee los resultados cacheados y arma el JSON (las celdas de control se extraen una por una; las series y cortes, recorriendo sus rangos). Se ejecuta **solo cuando cambia el archivo fuente**, y el diff del JSON se revisa en el PR.

```ts
// apps/api/scripts/generar-fixture.ts
import ExcelJS from "exceljs";

const CELDAS = {
  merma_total: "DASHBOARD_GERENCIAL!F7",
  eventos: "DASHBOARD_GERENCIAL!G19",
  controlable: "DASHBOARD_GERENCIAL!L7",
  pallets: "DASHBOARD_GERENCIAL!R7",
  tendencial: "PROYECCION_Y_PARETO!I6",
  base: "PROYECCION_Y_PARETO!I7",
  meta: "PROYECCION_Y_PARETO!I8",
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(process.argv[2]);

for (const [clave, referencia] of Object.entries(CELDAS)) {
  const [hoja, celda] = referencia.split("!");
  const valor = wb.getWorksheet(hoja)?.getCell(celda).value;
  const cacheado = valor && typeof valor === "object" && "result" in valor ? valor.result : valor;
  if (cacheado == null) throw new Error(`Celda sin resultado cacheado: ${referencia}`);
  console.log(clave, cacheado);
}
```

> Si una celda no tiene resultado cacheado, el script **falla** en vez de escribir un `null`: es la señal de que el libro se guardó sin recalcular.

---

## 3. Reglas de tolerancia

| Tipo | Tolerancia | Justificación |
|---|---|---|
| Dinero | ±$0.01 | Redondeo a 4 decimales en origen |
| Porcentaje | ±0.0001 (0.01 pp) | División y formato |
| Eventos / SKUs | exacto | Son enteros |
| Pallets | ±0.000001 | Unidades por pallet grandes |

Cualquier diferencia mayor se considera **fallo**, no “ruido”.

---

## 4. Matriz de pruebas

| Nivel | Herramienta | Qué prueba | Cantidad |
|---|---|---|---|
| Unitario ETL | Vitest | Reglas de validación, hash, redondeo, alias | 10 |
| Paridad API | Vitest + `fastify.inject()` | Las 8 tablas de cifras | 12 |
| Contrato API | Vitest | Forma de respuesta, tipos, nulos | 10 |
| Filtros | Vitest | Combinaciones y errores 422 | 8 |
| Frontend unitario | Vitest | Formateo de moneda, %, semana, fecha | 8 |
| E2E (opcional) | Playwright | Carga, filtro, navegación, export | 4 |
| Visual | Revisión manual | Dashboard, móvil, estados vacíos | checklist |
| Performance | k6 / Lighthouse | p95 API, LCP web | 2 umbrales |

---

## 5. Pruebas de paridad (código)

```ts
// apps/api/tests/paridad.test.ts
import { readFileSync } from "node:fs";

import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/valores_excel.json", import.meta.url), "utf8"),
);
const CAMPANIA = { desde: FIXTURE.ventana.desde, hasta: FIXTURE.ventana.hasta };
const TOL = new Decimal("0.01");
const dinero = (v: string) => new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

const app = await buildApp();
const get = async (url: string, query: Record<string, string> = CAMPANIA) => {
  const res = await app.inject({ url, query });
  expect(res.statusCode).toBe(200);
  return res.json();
};

it("reproduce los KPIs de la campaña", async () => {
  const { data } = await get("/api/v1/kpis");
  expect(dinero(data.merma_total).minus(dinero(FIXTURE.kpis.merma_total)).abs().lte(TOL)).toBe(true);
  expect(data.eventos).toBe(FIXTURE.kpis.eventos);
  expect(new Decimal(data.ticket_promedio).minus(FIXTURE.kpis.ticket_promedio).abs().lt("0.0001")).toBe(true);
});

type FilaMes = { mes: string; eventos: number; costo: string };

describe.each(FIXTURE.mensual as FilaMes[])("serie mensual $mes", (fila) => {
  it("coincide con el libro", async () => {
    const { data } = await get("/api/v1/series/mensual");
    const actual = data.find((x: FilaMes) => x.mes === fila.mes) as FilaMes;
    expect(actual.eventos).toBe(fila.eventos);
    expect(dinero(actual.costo).minus(dinero(fila.costo)).abs().lte(TOL)).toBe(true);
  });
});
```

Casos imprescindibles:

| # | Test | Esperado |
|---|---|---|
| 1 | KPIs ventana 28 semanas | $17,999.60 · 1,618 |
| 2 | KPIs rango completo | $20,383.75 · 1,795 |
| 3 | Serie mensual | 7 filas, suma $17,999.60 |
| 4 | Serie semanal | 28 filas, pico S40 $5,579.31 |
| 5 | Motivos | 13 filas, total 1,618 |
| 6 | Familias | 8 filas, ETIQUETAS $5,635.05 |
| 7 | Programas | 5 filas, GENÉRICO $14,007.74 |
| 8 | Gestión | 4 filas, Controlable $11,232.08 |
| 9 | Pareto | 14 A, top 15 $14,596.51 |
| 10 | Proyección | $21,856.66 / $20,055.79 / $19,735.03 |
| 11 | Filtro `2026-09` | $9,108.95 · 320 |
| 12 | Filtro `familia=ETIQUETAS` | $5,635.05 · 732 |
| 13 | Filtro `gestion=Por Auditar` | $1,118.13 · 7 |
| 14 | Sin filtros (todo) | $20,383.75 |
| 15 | Duplicados | 4 marcados, suman |
| 16 | Movimiento de totales | Suma de cortes = total |

---

## 6. Pruebas de integridad de datos

```sql
-- 1. Todo hecho apunta a un material existente
select count(*) from merma.fact_merma r
left join merma.dim_material m on m.codigo = r.codigo_material
where m.codigo is null;                      -- 0

-- 2. Ningún costo negativo o nulo
select count(*) from merma.fact_merma
where costo_total < 0 or costo_total is null; -- 0

-- 3. Costo recalculado = costo guardado (±0.0001)
select count(*) from merma.fact_merma
where abs(costo_total - round(cantidad * valor_unitario, 4)) > 0.0001; -- 0

-- 4. Semana ISO coherente con la fecha
select count(*) from merma.fact_merma
where semana_iso <> extract(week from fecha);  -- 0

-- 5. Motivos fuera de catálogo
select motivo_original, count(*)
from merma.fact_merma r
left join merma.dim_motivo m on m.codigo = r.motivo_codigo
where m.codigo is null
group by 1;                                   -- 0 (se resuelven por alias/fallback)

-- 6. Suma total
select count(*), round(sum(costo_total), 4) from merma.fact_merma;
-- 1795 | 20383.7500
```

Estas consultas se ejecutan en CI y en el checklist de cada carga.

---

## 7. QA funcional manual (checklist)

### Dashboard

- [ ] Con “corte 28 semanas”: $17,999.60, 1,618 eventos, $11.12 ticket, 62.40% controlable, 14.90 pallets.
- [ ] Con “todo el registro”: $20,383.75, 1,795 eventos.
- [ ] Filtro de mes `2026-09` deja 320 eventos y $9,108.95.
- [ ] Filtro de familia `BOLSAS` deja 7 eventos y $3,897.00.
- [ ] Limpiar filtros vuelve al corte.
- [ ] El pico semanal mostrado es S40, no S39.
- [ ] La alerta de “sin clasificar” dice 7 y $1,118.13.
- [ ] Ninguna cifra del panel contradice a otra.

### Registros

- [ ] Total de páginas coherente con el contador (1,618 / 50 = 33).
- [ ] Ordenar por costo cambia el orden y respeta el filtro.
- [ ] Buscar “CLAMSHELL” filtra por descripción.
- [ ] Export CSV respeta filtros y abre bien en Excel (tildes, coma decimal).

### Análisis

- [ ] Pareto: 14 filas clase A; la #15 es “ALTO IMPACTO”.
- [ ] El acumulado de la fila 14 es 79.32%.
- [ ] Proyección: mover el slider de meta recalcula escenario C (solo si se habilita en fase 2).
- [ ] La nota “proyección global, no responde a filtros” es visible.

### Transversal

- [ ] 375 px: sin scroll horizontal, filtros en drawer.
- [ ] 1366 px: 4 KPIs en una fila, gráficas legibles.
- [ ] Teclado: se puede llegar a todos los filtros y tablas.
- [ ] Zoom 200%: no se solapa texto.
- [ ] API caída: mensaje claro, no pantalla blanca.
- [ ] Primera carga del día (API dormida): aviso de arranque y recuperación automática.

---

## 8. Pruebas de rendimiento

| Prueba | Herramienta | Umbral |
|---|---|---|
| `GET /kpis` con dataset completo | k6, 20 VUs, 1 min | p95 < 300 ms |
| `GET /registros?per_page=100` | k6 | p95 < 400 ms |
| Carga inicial de la SPA | Lighthouse (móvil) | LCP < 2.5 s, CLS < 0.05 |
| Bundle inicial | `vite build --report` | < 250 KB gzip |

Se documenta el resultado en `docs/qa/rendimiento.md` (fecha, equipo, red, números). **Sin medición no se afirma una mejora.**

---

## 9. Seguridad y privacidad

- [ ] `CORS_ORIGINS` sin `*`.
- [ ] Ningún secreto en el bundle (`grep -r "postgres" dist/` vacío).
- [ ] `X-Robots-Tag: noindex` en Netlify.
- [ ] Rate limit activo (60 req/min/IP).
- [ ] Errores 500 no exponen stack ni SQL.
- [ ] Dependencias sin vulnerabilidades críticas (`npm audit --omit=dev`).
- [ ] Backups con acceso restringido.

---

## 10. Gestión de defectos

| Severidad | Ejemplo | SLA |
|---|---|---|
| S1 · Bloqueante | Totales no cuadran, app no carga | Corregir antes de publicar |
| S2 · Alta | Filtro devuelve datos incorrectos | 24 h |
| S3 · Media | Gráfica sin tooltip, texto truncado | 3 días |
| S4 · Baja | Espaciado, copy | Próximo release |

Todo defecto de cálculo se acompaña de un test que lo reproduce antes de corregirlo.

---

## 11. Definición de “terminado” (DoD)

Un paso se considera terminado solo si:

1. Cumple sus criterios de aceptación.
2. Tiene pruebas automatizadas que pasan en CI.
3. La documentación del paso está actualizada.
4. Fue revisado por otra persona (PR aprobado).
5. No introduce diferencias > $0.01 contra el fixture.
6. Funciona en el ambiente desplegado, no solo en local.

---

## 12. Criterios de aceptación finales (gate de producción)

| # | Criterio | Evidencia |
|---|---|---|
| 1 | 16 pruebas de paridad verdes | CI |
| 2 | 6 consultas de integridad en 0 | CI |
| 3 | Checklist funcional completo | PR firmado |
| 4 | Lighthouse ≥ 90 / ≥ 95 | Reporte adjunto |
| 5 | p95 API < 300 ms | Reporte k6 |
| 6 | Rollback probado | Registro en `docs/operacion/rollback.md` |
| 7 | Usuarios capacitados | Acta de 15 min |

---

**Siguiente paso:** [`09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md`](./09-PASO-07-ROADMAP-RIESGOS-Y-DECISIONES.md).
