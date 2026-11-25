# Acta de decisiones D1–D9

Documento para firma. Cada decisión trae la recomendación de `docs/09`, **lo que
hoy hace el sistema** y el cambio concreto que implica la alternativa. Firmar es
rellenar la columna «Decisión» y la fecha; si se elige distinto de lo
implementado, se abre el cambio en el mismo commit que actualiza esta acta.

Estado: **pendiente de firma**. Responsable: gerencia de operaciones.

| # | Tema | Recomendación | Estado actual | Decisión | Fecha |
|---|---|---|---|---|---|
| D1 | Ventana por defecto | B · todo el registro | A · campaña 28 semanas | | |
| D2 | `MALA IMPRESIÓN` | A · alias a `ERROR DE IMPRESIÓN` | A · implementado | | |
| D3 | Duplicados | A · suman y se reportan | A · implementado | | |
| D4 | Programa por evento | B · en fase 2 | A · atributo del material | | |
| D5 | Proyección y filtros | A · global en el MVP | A · solo usa el rango de fechas | | |
| D6 | Acceso | A ahora, C antes de compartir | A · URL privada, `noindex`, carga abierta | | |
| D7 | Tier | A · free para validar | A · free | | |
| D8 | El Excel | A · la app es la fuente | conviven | | |
| D9 | Dueño de datos | Asignar responsable y aprobador | sin asignar | | |

## D1 · ¿Qué ventana se muestra por defecto?

| Opción | Efecto |
|---|---|
| A | Corte de 28 semanas (08/05–11/11): `$17,999.60`, 1,618 eventos. Igual al Excel. |
| B | Todo el registro (08/05–23/11): `$20,383.75`, 1,795 eventos. |

**Hoy:** `apps/web/src/lib/filters.ts` define `CAMPANIA` como rango por defecto, y
`/meta` publica las dos vistas en el selector «Corte».

**Si se firma B:** cambiar `CAMPANIA` por el rango de `/meta` (o pedir a la API
la vista por defecto), ajustar la captura del dashboard y los textos de
`docs/operacion/despliegue.md`. La vista A sigue disponible en el selector.

**Riesgo de dejar A:** el tablero muestra como cifra principal un periodo
incompleto (177 eventos fuera del corte), que es el problema H1 del análisis.

## D2 · ¿Qué hacer con el motivo `MALA IMPRESIÓN`?

| Opción | Efecto |
|---|---|
| A | Alias a `ERROR DE IMPRESIÓN`. Conserva `motivo_original`. |
| B | Crear un motivo nuevo en el catálogo. |
| C | Dejarlo como `SIN CLASIFICAR`. |

**Hoy:** `0003_seeds.sql` inserta el alias `MALA IMPRESIÓN → ERROR DE IMPRESIÓN`;
los 3 eventos (`$39.31`) se agrupan con el motivo canónico y el texto original
queda en `fact_merma.motivo_original`.

**Si se firma B o C:** requiere migración de catálogo, recarga (`replace`) o
recalificación manual, y cambia los totales por motivo del Pareto y las alertas.

## D3 · ¿Los duplicados suman o se excluyen?

| Opción | Efecto |
|---|---|
| A | Suman y se reportan en `/alertas` (4 grupos). |
| B | Se excluyen del cálculo. |

**Hoy:** `fact_merma.es_duplicado` marca la fila; los totales la incluyen y la
alerta de duplicados la expone con el costo extra.

**Si se firma B:** excluir en todas las consultas (`v_registro`, KPIs, series,
cortes, Pareto, CSV) y romper la paridad con el libro; habría que documentar la
nueva cifra de control y actualizar las pruebas.

## D4 · ¿El programa se registra por evento?

| Opción | Efecto |
|---|---|
| A | Atributo del material (como hoy). Un material usado en dos programas se
atribuye siempre al mismo. |
| B | `programa_evento` opcional en `fact_merma`, en fase 2. |

**Hoy:** `dim_material.programa` es la única fuente; el filtro `programa` corta
por el programa del material.

**Si se firma B:** migración `0004` con la columna y su índice, ETL que la lea
del Excel (hoy no existe en el libro), API y UI que la prefieran sobre el
catálogo, y una carga de datos históricos.

## D5–D9 · Resumen

- **D5:** `/proyeccion` solo usa `desde`/`hasta`; ignora mes, programa, familia y
  gestión. Firmar B implica recalcular tasa y acumulado con los filtros activos.
- **D6:** sin `ADMIN_TOKEN` la carga es abierta; `X-Robots-Tag: noindex` y URL
  privada son la única protección. Firmar C implica Google Auth y roles.
- **D7:** Render free (arranque en frío) y Neon free. Firmar B son ~$26/mes.
- **D8:** el Excel sigue siendo la fuente de captura hasta que se acuerde la
  fecha de corte oficial.
- **D9:** falta nombrar responsable de catálogos y aprobador de cargas.

## Cómo cerrar el acta

1. Escribir la opción elegida y la fecha en la tabla.
2. Si la elección difiere de lo implementado, abrir el cambio técnico y
   actualizar `docs/09` en el mismo commit.
3. Commit con el acta firmada. Sin firma, el sistema mantiene el estado actual
   descrito arriba.
