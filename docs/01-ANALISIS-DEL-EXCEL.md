# 01 · ANÁLISIS COMPLETO DEL EXCEL

**Archivo:** `REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK (1) (6).xlsx`
**Tamaño:** 436,817 bytes · **Hojas:** 6 · **Última modificación:** 25/11/2026 07:52
**Objetivo de este documento:** dejar por escrito qué hace el libro, cómo calcula, qué datos contiene y qué defectos debe corregir la aplicación web.

---

## 1. Inventario de hojas

| # | Hoja | Estado | Rango usado | Filas | Rol |
|---|---|---|---|---|---|
| 1 | `DASHBOARD_GERENCIAL` | Visible | A1:AB60 | 60 | Tablero ejecutivo: KPIs, 5 gráficas, rankings, alertas, matriz de decisiones |
| 2 | `PROYECCION_Y_PARETO` | **Oculta** | A1:K28 | 28 | Parámetros de proyección, 3 escenarios de cierre y Top 15 SKUs (ABC) |
| 3 | `CONSOLIDADO_SEMANAL` | **Oculta** | A1:K33 | 33 | Serie ISO 19–46 con apertura por familia, variación WoW y semáforo |
| 4 | `REGISTRO_MERMAS` | Visible | A1:P1876 | 1,876 | Base transaccional diaria (1,795 registros + 4 filas de cabecera/total) |
| 5 | `MAESTRO_MATERIALES` | **Oculta** | A1:M113 | 113 | Catálogo ERP Frusys: 108 SKUs con costo, grupo, programa y ABC |
| 6 | `CATALOGO_MOTIVOS` | **Oculta** | A1:E17 | 17 | 13 motivos con categoría, área responsable, gestionabilidad y acción |

**Observación:** el usuario final solo ve 2 de 6 hojas. Las hojas ocultas son el motor de cálculo; cualquier cambio en ellas rompe el dashboard sin aviso visual.

---

## 2. Modelo de datos del libro

### 2.1 Tabla de hechos: `REGISTRO_MERMAS`

Cabecera en la fila 4, datos desde la fila 5.

| Col | Campo | Tipo | Origen | Notas |
|---|---|---|---|---|
| A | AÑO | fórmula `YEAR(D)` | calculado | redundante con D |
| B | MES | fórmula `TEXT(D,"yyyy-mm")` | calculado | string `2026-11` |
| C | SEMANA ISO | fórmula `WEEKNUM(D,21)` | calculado | ISO 8601 |
| D | FECHA | fecha | **entrada** | única fuente de verdad temporal |
| E | ID FRUSYS | entero | **entrada** | código de material |
| F | DESCRIPCIÓN | `INDEX/MATCH` al maestro | lookup | fallback `"CÓDIGO NO REGISTRADO"` |
| G | U.M | `INDEX/MATCH` | lookup | UNI / UND / MTS / MIL / ROL |
| H | GRUPO MATERIAL | `INDEX/MATCH` | lookup | familia |
| I | PROGRAMA | `INDEX/MATCH` | lookup | **atributo del material, no del evento** |
| J | CANTIDAD | decimal | **entrada** | |
| K | PALLETS EQUIV. | `J / UNID x PALLET` | calculado | |
| L | MOTIVO | texto | **entrada libre** | sin validación → causa raíz de errores |
| M | GESTIONABILIDAD | `INDEX/MATCH` al catálogo | lookup | fallback `"Por Auditar"` |
| N | ÁREA RESPONSABLE | `INDEX/MATCH` | lookup | |
| O | VALOR UNITARIO | `INDEX/MATCH` al maestro | lookup | |
| P | COSTO TOTAL | `ROUND(J*O,4)` | calculado | moneda de todos los KPIs |

Consecuencia del diseño: **solo se digitan 4 columnas** (D, E, J, L). Todo lo demás se resuelve por búsqueda. Es rápido para capturar, pero cualquier material sin código o motivo mal escrito contamina los reportes en silencio (con `IFERROR` que oculta el error).

### 2.2 Dimensión de materiales: `MAESTRO_MATERIALES`

108 SKUs (filas 5–112) + fila 113 de totales.

| Col | Campo | Uso |
|---|---|---|
| A | CODIGO FRUSYS | PK del catálogo |
| B | DESCRIPCION | etiqueta en tablas y Pareto |
| C | U.M | unidad de medida |
| D | VALOR UNITARIO | USD por unidad (8 decimales en algunos SKUs) |
| E | COD. SUBGRUPO | `001` Bolsas, `003` Clamshell, `004` Etiquetas… |
| F | GRUPO MATERIAL | 8 familias |
| G | PROGRAMA | 5 programas |
| H | UNID x PALLET | divisor de pallets (1 a 3,000,000) |
| I | CANT. MERMA ACUM. | `SUMIFS` del registro (rango fijo) |
| J | PALLETS EQUIV. | `I/H` |
| K | COSTO MERMA ACUM. | `SUMIFS` |
| L | % PARTICIPACIÓN | `K / total` |
| M | CLASE ABC | `A (Crítico)` ≤80% acumulado, `B (Moderado)` ≤95%, `C (Bajo)`, `Sin Merma` |

Verificado: 79 SKUs con merma y 29 en cero. La columna M **depende del orden de las filas** (usa `SUM($L$5:Ln)`), por lo que si se reordena el maestro, las clases cambian. En la app el ABC se calcula con `ORDER BY costo DESC` y `SUM() OVER (ORDER BY ...)`, sin depender del orden físico.

### 2.3 Dimensión de motivos: `CATALOGO_MOTIVOS`

13 motivos. Columnas: MOTIVO (PK), CATEGORÍA DE PÉRDIDA, ÁREA RESPONSABLE, GESTIONABILIDAD, ACCIÓN CORRECTIVA.

| Motivo | Gestión | Área |
|---|---|---|
| ROTURA DE EMBALAJES | Controlable | Packing / Estiba |
| APILADO | Controlable | Almacén / Despacho |
| REEMPAQUE | Controlable | Aseguramiento Calidad / Packing |
| PRUEBA DE PROCESO | Estándar Técnico | Mantenimiento / Producción |
| ERROR DE IMPRESIÓN | Controlable | Codificación / Trazabilidad |
| ETIQUETADO AL VACÍO | Controlable | Línea de Empaque |
| CONTRAMUESTRA | Estándar Técnico | Aseguramiento de Calidad |
| SUMINISTRO | Controlable | Almacén de Materiales |
| LINEAS A&B | Controlable | Producción Líneas A&B |
| DEFECTO DE FÁBRICA | Recuperable Proveedor | Compras / Proveedores |
| PRUEBA DE CALIDAD | Estándar Técnico | Aseguramiento de Calidad |
| SELLADO | Controlable | Mantenimiento / Línea |
| SIN CLASIFICAR | Por Auditar | Supervisor de Turno |

**No existe** el motivo `MALA IMPRESIÓN`, que sí aparece 3 veces en el registro (ver §6).

---

## 3. Lógica del dashboard

### 3.1 Slicers (4 validaciones de lista)

| Celda | Filtro | Opciones |
|---|---|---|
| B8 | Mes | TODOS, 2026-05 … 2026-11 |
| B11 | Programa | TODOS, GENÉRICO, UNITED EXPORT, UNIFRUTTI, ALPINE FRESH, SUNBELLE |
| B14 | Familia | TODOS, ETIQUETAS, CLAMSHELL, BOLSAS, CAJAS, MOLDES, INTERCONECTORES, RIBBON, PALLETS |
| B17 | Gestionabilidad | TODOS, Controlable, Estándar Técnico, Por Auditar, Recuperable Proveedor |

Truco usado: `IF($B$8="TODOS","*",$B$8)` dentro de `SUMIFS`, convirtiendo el filtro en comodín.

**Lo que los slicers NO filtran** (y el usuario cree que sí):
- La proyección de cierre (`PROYECCION_Y_PARETO` usa totales globales).
- El consolidado semanal (hoja oculta).
- El maestro de materiales.
- Las cajas de texto de alertas.

En la app esto se resuelve mostrando explícitamente “Proyección global (no responde a filtros)” o haciéndola responder a filtros con una nota. Ver decisión D5.

### 3.2 KPIs superiores

| Celda | KPI | Fórmula |
|---|---|---|
| F7 | Merma total valorizada | `SUMIFS(P; filtros)` |
| L7 | Merma controlable | `SUMIFS(P; filtros; M="Controlable")` |
| R7 | Volumen físico | `SUMIFS(K; filtros)` |
| X7 | Proyección cierre (meta) | `=PROYECCION_Y_PARETO!I8` |
| F8 | Eventos + ticket | `COUNTIFS` + `F7/COUNTIFS` |

### 3.3 Bloques del tablero

| Bloque | Celdas | Contenido |
|---|---|---|
| 02 · Programa / Cliente | F11:I19 | Tabla mensual (eventos, costo, % partic.) |
| 01/03/04 | B7:B17 | Los 4 slicers, apilados a la izquierda |
| Alertas | B19:B45 | 5 cajas de texto: spike, auditoría pendiente, Pareto, meta |
| Ranking de motivos | F27:K42 | 13 motivos + total, con barra de datos |
| Concentración por familia | S27:V37 | 8 familias + total, con escala de color |
| Impacto por programa | F46:K53 | 5 programas + total |
| Matriz de gestionabilidad | S46:X52 | 4 estados, % y decisión/acción |

### 3.4 Gráficas (5)

| # | Tipo | Título | Rango | Series |
|---|---|---|---|---|
| 1 | Columnas | Evolución mensual de mermas (USD) | F11:H18 | 1 serie (costo) |
| 2 | Línea | Tendencia semanal ISO 19–46 | `CONSOLIDADO_SEMANAL` A5:I32 | 1 serie |
| 3 | Barras horizontales | Ranking de merma por motivo | F28:J41 | 1 serie |
| 4 | Anillo (doughnut) | Concentración por familia | S28:U36 | 1 serie |
| 5 | Barras | Impacto por programa/cliente | F47:J52 | 1 serie |

Todas las gráficas son de **una sola serie**; no hay ejes secundarios ni líneas de meta. En la web conviene mantener esa simplicidad y añadir tooltips con eventos + ticket promedio.

---

## 4. Hoja `PROYECCION_Y_PARETO`

### 4.1 Parámetros (C5:C9)

| Celda | Parámetro | Valor | Fórmula |
|---|---|---|---|
| C5 | Merma acumulada real | 17,999.6033 | `=CONSOLIDADO_SEMANAL!I33` |
| C6 | Promedio semanal global | 642.8430 | `=AVERAGE(I5:I32)` |
| C7 | Promedio sin atípicos | 342.6986 | `=AVERAGEIFS(I5:I32; "<3000")` |
| C8 | Semanas restantes | 6 | valor fijo |
| C9 | Meta de reducción | 25% | valor editable |

`C7` excluye las semanas 39 y 40 (las dos por encima de $3,000). Son 26 semanas las que promedian.

### 4.2 Escenarios (F5:K8)

| Escenario | Tasa semanal | 6 semanas | Cierre 2026 | Ahorro vs tendencial |
|---|---:|---:|---:|---:|
| A. Tendencial | 642.84 | 3,857.06 | 21,856.66 | 0 |
| B. Base operativo | 342.70 | 2,056.19 | 20,055.79 | 1,800.87 |
| C. Meta optimizada | 289.24 | 1,735.43 | 19,735.03 | 2,121.63 |

`G8 = C7 × (1 − C9 × 0.624)`. El `0.624` es la proporción de merma **controlable** observada (11,232.08 / 17,999.60 = 62.40%). Está escrito a mano: si cambia la mezcla de motivos, la meta deja de ser válida sin que nadie lo note.

### 4.3 Pareto Top 15 (filas 13–27)

Copia por referencia del maestro (`=MAESTRO_MATERIALES!A5`, etc.), asume que el maestro ya viene ordenado por costo. `J` acumula `% PARTICIPACIÓN`; `K` etiqueta `CRÍTICO (A)` si el acumulado ≤ 80%.

Resultado: 14 SKUs clase A (79.32%) y el SKU 15 queda en 81.09%. El subtotal Top 15 es $14,596.51.

---

## 5. Hoja `CONSOLIDADO_SEMANAL`

28 filas (semanas 19 a 46), una por semana ISO, con fecha de inicio, número de registros, apertura por 4 familias principales, total y variación WoW ($ y %).

- `H` (Otros mat.) = `I − SUM(D:G)`: residual, no una familia real.
- `J`/`K` (WoW) comparan contra la fila anterior; la primera semana queda en 0.
- `K33` no es variación sino “Prom. Sem.” (etiqueta engañosa).
- La lista de semanas está **escrita**, no generada: si se cargan datos de la semana 47, no aparecen.

---

## 6. Hallazgos de calidad de datos

### H1 · 177 registros fuera de todos los cálculos — **crítico**

| Concepto | Dashboard (`5:1622`) | Libro completo (`5:1799`) | Diferencia |
|---|---:|---:|---:|
| Registros | 1,618 | 1,795 | +177 |
| Costo | $17,999.60 | $20,383.75 | **+$2,384.15** |
| Pallets equiv. | 14.90 | 17.30 | +2.40 |
| Fecha máxima | 11/11/2026 | 23/11/2026 | +12 días |

Los 177 registros van del 12/11 al 23/11/2026 y ya están digitados. Ninguna fórmula los lee. **Riesgo:** el directorio toma decisiones con un tablero que ignora ~12% de la merma del período.

### H2 · Textos del dashboard desactualizados — **alto**

| Celda | Texto actual | Dato real de las fórmulas |
|---|---|---|
| B45 / X52 / S54 | “ahorro $1,124.21 · cierre meta $20,732.45” | **$2,121.63 · $19,735.03** |
| S39 / B37 | “Etiquetas 44.9% + Clamshell 29.3% = 74.2%” | **31.31% + 28.51% = 59.82%** |
| P10 | “PICO EN SEMANA 39” | El pico es la **semana 40** ($5,579.31) |
| B21 | “Semana 39 registró $5,635” | S39 = **$3,510.14**; S40 = **$5,579.31** |
| B36 | “Pareto Clase A (79.3%)” | Correcto (14 SKUs, 79.32%) |

Son cajas de texto sin vínculo a celdas. **Regla para la app:** ningún número ni conclusión se escribe a mano; todo se deriva de la consulta.

### H3 · Motivo inexistente en el catálogo — **alto**

3 registros con `MALA IMPRESIÓN` (filas 1640, 1741, 1777; 13–20/11/2026; $39.31 en total) no existen en `CATALOGO_MOTIVOS`. El `IFERROR` los convierte en `Por Auditar`, mezclándolos con los `SIN CLASIFICAR`. Es casi seguro un duplicado semántico de `ERROR DE IMPRESIÓN`.

### H4 · 7 registros sin motivo — **medio**

Todos del **02/10/2026** (semana 40), materiales de etiquetas, total **$1,118.13** (6.21% de la merma). El propio dashboard lo declara como “auditoría pendiente”. Deben quedar como alerta de calidad, no desaparecer.

### H5 · 4 registros duplicados — **medio**

Pares idénticos en fecha + código + cantidad + motivo:

| Fecha | Código | Cantidad | Motivo |
|---|---|---:|---|
| 10/07/2026 | 28100022 | 90 | ETIQUETADO AL VACÍO |
| 10/07/2026 | 28100023 | 365 | ETIQUETADO AL VACÍO |
| 25/07/2026 | 28100023 | 925 | ETIQUETADO AL VACÍO |
| 25/07/2026 | 28100038 | 666 | ETIQUETADO AL VACÍO |

Impacto en costo: **$24.36**. La app debe **detectar y reportar**, no borrar en silencio.

### H6 · Sin validación en el motivo — **alto (causa de H3/H4)**

La columna L es texto libre. El catálogo solo se usa para *leer* (lookup), nunca para *validar* la entrada.

### H7 · Rangos fijos repetidos — **alto (deuda estructural)**

`$5:$1622` aparece en ~40 fórmulas de dashboard, maestro y consolidado. Agregar filas al registro no actualiza nada. Es la razón principal para migrar a base de datos.

### H8 · Métrica de pallets heterogénea — **medio**

`UNID x PALLET` va de **1** (malla antiafida, ROL) a **3,000,000** (etiquetas). El indicador sirve para comparar capacidad, pero no es un conteo físico. Además, las cantidades vienen en 4 unidades distintas (UNI, UND, MTS, MIL), por lo que sumar “pallets” mezcla unidades.

### H9 · Programa a nivel de material, no de evento — **medio**

`REGISTRO.I` es un `INDEX/MATCH` a `MAESTRO.G`. Si un mismo material se usa en dos programas, todos los eventos se atribuyen al programa del maestro. La dimensión “programa/cliente” no es auditable contra la operación real.

### H10 · Semanas 47 y 48 no existen en el consolidado — **medio**

Los datos llegan a la semana 48, pero `CONSOLIDADO_SEMANAL` solo lista 19–46 y su total (`I33`) alimenta la proyección. Cualquier dato posterior al 11/11 queda fuera de la serie.

### H11 · Hoja oculta con fórmulas que dependen del orden — **bajo**

`MAESTRO.M` (ABC) usa acumulados por posición. Reordenar el maestro cambia las clases A/B/C.

### H12 · Problemas menores

- `REGISTRO` tiene el panel congelado en `A1777` (celda suelta al final, no en la cabecera).
- Fila 1800 usa `SUBTOTAL(109; J5:J1622)`: el “total general” ignora las 177 filas finales.
- `AÑO`, `MES` y `SEMANA ISO` se recalculan con fórmula fila a fila (~5,400 fórmulas) para 1,795 filas.
- `K33` del consolidado se rotula “Prom. Sem.” dentro de una columna de variación porcentual.
- Los importes usan 4 decimales internos; el dashboard muestra 2. Diferencias de centavos al sumar por partes son esperables.

---

## 7. Lo que se debe conservar (especificación funcional)

No todo se descarta. Estos comportamientos son valiosos y deben replicarse:

1. **Filtros globales** por mes, programa, familia y gestionabilidad, aplicados a KPIs, tablas y gráficas del tablero.
2. **KPIs de cabecera** con eventos y ticket promedio, no solo el monto.
3. **Ranking de motivos con % de participación** y el estado de gestión al lado.
4. **Pareto ABC con clase A/B/C** y prioridad de acción.
5. **Tres escenarios de cierre** (tendencial, base, meta) con ahorro explícito.
6. **Matriz de gestionabilidad con decisión** (controlable, estándar, por auditar, recuperable).
7. **Alertas de calidad** (sin clasificar, auditoría pendiente, pico semanal).
8. **Tema oscuro** con jerarquía visual por color: cian = merma total, naranja = controlable, violeta = volumen, verde = meta.

---

## 8. Contraste con la app propuesta

| Dimensión | Excel | App web |
|---|---|---|
| Fuente de verdad | Celdas + fórmulas | Postgres |
| Rango de cálculo | Filas 5–1622 | Fechas (parámetro) |
| Filtros | 4 slicers, solo dashboard | 4 filtros globales, toda la app |
| Cálculo | ~40 SUMIFS por vista | 1 consulta agregada por endpoint |
| Altas de datos | Digitación manual | Import Excel / formulario (fase 2) |
| Validación de motivo | Ninguna | FK + alias + alerta |
| Duplicados | No detecta | Hash de fila + reporte |
| Narrativa | Texto fijo | Generada desde datos |
| Histórico | Snapshot | Serie completa + versionado de cargas |
| Acceso | Archivo local | URL + API |

---

**Siguiente documento:** [`02-ARQUITECTURA-Y-STACK.md`](./02-ARQUITECTURA-Y-STACK.md).
