# PASO 7 · ROADMAP, RIESGOS Y DECISIONES

**Duración estimada:** 0.5 día (planificación y acuerdos)
**Depende de:** lectura de todo el plan
**Bloquea a:** el inicio del Paso 1

**Objetivo:** ordenar el trabajo en fases, dejar explícito qué se decide y quién, y anticipar lo que puede salir mal.

---

## 1. Fases

### Fase 0 · Preparación (2 días)

| # | Tarea | Salida |
|---|---|---|
| 0.1 | Firmar decisiones D1–D4 | Acta de 1 página |
| 0.2 | Crear repo, ramas, protección de `main` | Repo listo |
| 0.3 | Crear Neon + Render + Netlify con “hola mundo” | 3 URLs verdes |
| 0.4 | Congelar el Excel fuente (copia en `data/source/`) | Hash SHA-256 registrado |
| 0.5 | Definir responsables: producto, datos, operación | Matriz RACI |

### Fase 1 · MVP de solo lectura (11.5 días)

Pasos 1 a 6 de este plan. Entregable: dashboard publicado que reemplaza el Excel para consulta gerencial.

**Incluye:** modelo, ETL, 10 endpoints, 3 pantallas, despliegue, paridad.
**No incluye:** login, escritura, import desde la UI, notificaciones.

### Fase 2 · Operación diaria (8–10 días)

| # | Funcionalidad | Valor | Estimación |
|---|---|---|---|
| 2.1 | Formulario de alta de merma con catálogos obligatorios | Elimina el texto libre (H6) | 2 d |
| 2.2 | Import de Excel desde la UI con vista previa y reporte | Reemplaza el ETL manual | 2 d |
| 2.3 | Edición/anulación con historial (`audit_log`) | Trazabilidad | 1.5 d |
| 2.4 | Autenticación (Google) + roles (lectura/escritura) | Protege costos | 1.5 d |
| 2.5 | Alertas por correo (sin clasificar, pico semanal) | Cierra el ciclo | 1 d |
| 2.6 | Export PDF del tablero para directorio | Reemplaza la impresión | 1 d |

### Fase 3 · Analítica avanzada (backlog, sin fecha)

- Comparativo campaña vs campaña.
- Proyección por programa/familia (no solo global).
- Detección de anomalías (z-score por SKU/semana).
- Integración directa con ERP Frusys (si expone API/BD).
- Metas por área responsable con seguimiento.
- Móvil PWA para jefes de turno.

---

## 2. Backlog priorizado (MVP)

| ID | Historia | Prioridad | Estimación | Depende |
|---|---|---|---|---|
| H-01 | Como gerente quiero ver la merma total del período con filtros | Must | 1 d | API /kpis |
| H-02 | Como gerente quiero comparar meses y semanas | Must | 1 d | /series |
| H-03 | Como jefe de calidad quiero el ranking de motivos | Must | 0.5 d | /cortes |
| H-04 | Como gerente quiero el Pareto de SKUs para priorizar | Must | 1 d | /pareto |
| H-05 | Como directorio quiero el cierre proyectado y el ahorro | Must | 1 d | /proyeccion |
| H-06 | Como analista quiero ver y exportar los registros | Must | 1 d | /registros |
| H-07 | Como jefe de calidad quiero ver datos sospechosos | Should | 0.5 d | /alertas |
| H-08 | Como usuario quiero compartir una vista por URL | Should | 0.5 d | filtros en URL |
| H-09 | Como usuario quiero saber cuándo la API está dormida | Should | 0.25 d | ColdStartNotice |
| H-10 | Como auditor quiero saber cuándo se cargó cada dato | Could | 0.5 d | /meta |
| H-11 | Como usuario quiero registrar una merma | Won't (fase 2) | 2 d | auth |
| H-12 | Como usuario quiero entrar con Google | Won't (fase 2) | 1.5 d | — |

---

## 3. Cronograma sugerido

```text
Semana 1   Fase 0 (2 d) + Paso 1 (0.5 d) + inicio Paso 2 (1.5 d) + Paso 3 (1 d)
Semana 2   Paso 3 (2 d) + Paso 4 (3 d)
Semana 3   Paso 4 (1 d) + Paso 5 (1 d) + Paso 6 (1.5 d) + cierre y capacitación (0.5 d)
```

Hitos:

| Hito | Fecha objetivo | Criterio |
|---|---|---|
| M1 · Datos en Postgres | fin semana 1 | 1,795 filas, $20,383.75 |
| M2 · API completa | fin semana 1 | Swagger con 10 endpoints |
| M3 · Dashboard usable | fin semana 2 | 3 pantallas navegables |
| M4 · Producción | fin semana 3 | URL + paridad verde |
| M5 · Adopción | +2 semanas | 3 usuarios activos/semana |

---

## 4. Riesgos

Escala: probabilidad (P) e impacto (I) de 1 a 5.

| ID | Riesgo | P | I | Mitigación | Dueño |
|---|---|---|---|---|---|
| R1 | **Doble fuente de verdad**: el Excel sigue usándose en paralelo y los números divergen | 4 | 5 | Fecha de corte oficial; la app es la fuente desde el día 1; el Excel pasa a “export” | Producto |
| R2 | Los 177 registros huérfanos no se cargan por error de proceso | 3 | 4 | ETL lee todo el rango; prueba de conteo 1,795 en CI | Datos |
| R3 | Se publica el dashboard con costos en URL abierta | 3 | 5 | `noindex`, URL no adivinable, password protection si el plan lo permite, auth en fase 2 | Producto |
| R4 | Render free duerme y el usuario cree que “no funciona” | 5 | 2 | Aviso de arranque en frío + reintento automático + expectativa escrita | Frontend |
| R5 | La base free se llena o se suspende | 2 | 3 | 0.5 GB para ~2k filas/año; monitoreo mensual; plan pago si crece | Datos |
| R6 | Nuevos motivos mal digitados vuelven a contaminar | 4 | 3 | FK + alias + alerta; formulario con lista cerrada (fase 2) | Calidad |
| R7 | Baja adopción por falta de capacitación | 3 | 4 | Sesión de 15 min + guía de una página + URL en el correo semanal | Producto |
| R8 | Dependencia de una sola persona (bus factor) | 3 | 4 | Documentación en `docs/`, CI reproducible, accesos compartidos | Tech lead |
| R9 | Cambio de precios del maestro altera históricos | 3 | 4 | Snapshot `valor_unitario` en el hecho | Datos |
| R10 | El volumen crece a varias sedes y el modelo se queda corto | 2 | 3 | Esquema ya soporta `sede_id` (agregar en fase 2 si aplica) | Tech lead |
| R11 | Un deploy rompe la API en horario crítico | 2 | 4 | Deploy en viernes prohibido, rollback probado, healthcheck | DevOps |
| R12 | CORS mal configurado tras cambiar dominio | 3 | 2 | Checklist de despliegue + prueba desde el navegador | DevOps |
| R13 | Las cifras “no cuadran” por redondeo de centavos | 2 | 3 | Decimal + half-up + tolerancia documentada | Datos |
| R14 | Proyección mal interpretada por el directorio | 3 | 3 | Etiquetar supuestos, mostrar parámetros y fecha de corte | Producto |

---

## 5. Decisiones abiertas (requieren firma)

Acta para firma, con el estado actual del sistema y el cambio que implica cada
alternativa: [09A · Acta de decisiones](09A-ACTA-DECISIONES.md).

### D1 · ¿Qué ventana se muestra por defecto?

- **A)** Corte de 28 semanas (08/05–11/11): $17,999.60. Coincide con el Excel actual.
- **B)** Todo el registro (08/05–23/11): $20,383.75. Refleja la realidad.

**Recomendación: B por defecto, con la vista A disponible en el selector.** Mostrar datos incompletos como verdad principal reproduce el problema H1. La etiqueta “Campaña 28 semanas” queda como vista guardada para comparar con reportes anteriores.

### D2 · ¿Qué hacer con el motivo `MALA IMPRESIÓN`?

- **A)** Alias a `ERROR DE IMPRESIÓN` (recomendado): 3 eventos, $39.31, sin cambiar el dato original.
- **B)** Crear un motivo nuevo en el catálogo.
- **C)** Dejarlo como `SIN CLASIFICAR`.

**Recomendación: A**, conservando `motivo_original` para auditoría.

### D3 · ¿Los duplicados suman o se excluyen?

- **A)** Suman y se reportan (recomendado): mantiene paridad y visibilidad.
- **B)** Se excluyen del cálculo.

**Recomendación: A.** Excluirlos en silencio rompe la conciliación y esconde un error operativo.

### D4 · ¿El programa se registra por evento?

- **A)** Se mantiene como atributo del material (como hoy).
- **B)** Se agrega `programa_evento` opcional en el hecho (fase 2).

**Recomendación: B en fase 2**, porque hoy un material usado en dos programas se atribuye siempre al mismo (H9).

### D5 · ¿La proyección responde a los filtros?

- **A)** No: es global, con nota visible (recomendado, igual que el Excel).
- **B)** Sí: recalcula tasa y acumulado con los filtros activos.

**Recomendación: A en el MVP**, B en fase 3. Recalcular la proyección con un filtro de familia puede inducir a error si hay pocas semanas.

### D6 · ¿Cómo se protege el acceso?

- **A)** URL privada + `noindex` (MVP, costo $0).
- **B)** Netlify Password Protection (según plan).
- **C)** Google Auth + roles (fase 2, recomendado como destino).

**Recomendación: A ahora, C antes de compartir fuera de la gerencia.**

### D7 · ¿Tier gratuito o pago?

- **A)** Free: $0, con arranque en frío y riesgo de suspensión de la BD.
- **B)** Render Starter + Neon Launch: ~$26/mes, sin suspensión.

**Recomendación: A para validar adopción; B cuando el tablero sea de uso diario del directorio.**

### D8 · ¿El Excel desaparece?

- **A)** Sí: la app es la fuente; el Excel queda como respaldo histórico.
- **B)** No: conviven; la app solo lee.

**Recomendación: A**, con exportación a Excel/CSV desde la app para no perder la costumbre. Una fecha de corte oficial (ej. 01/12/2026) evita la doble captura.

### D9 · ¿Quién es el dueño de los datos?

Asignar un responsable de catálogos (materiales y motivos) y un aprobador de cargas. Sin dueño, los motivos vuelven a degradarse.

---

## 6. Métricas de éxito del producto

| Métrica | Línea base (Excel) | Meta a 60 días |
|---|---|---|
| Tiempo de generar el reporte gerencial | 1–2 h manuales | < 1 min |
| Exactitud vs libro | — | 100% en 16 pruebas |
| Cobertura de datos | 1,618/1,795 (90.1%) | 100% |
| Registros sin motivo | 10 (0.6%) | < 0.2% |
| Duplicados detectados | No se detectan | 100% reportados |
| Usuarios activos/semana | — | ≥ 3 |
| Alertas de calidad resueltas en ≤ 7 días | — | ≥ 80% |
| Reducción de merma controlable | $11,232 acumulado | −25% al cierre (meta del negocio) |

---

## 7. Qué hacer en las próximas 48 horas

1. **Aprobar D1, D2 y D3** (las que cambian el ETL y la UI).
2. **Crear el repo** y subir el libro a `data/source/` con su hash.
3. **Levantar Neon + Render + Netlify** con un “hola mundo” para validar credenciales, CORS y TLS.
4. **Ejecutar el ETL en local** y comprobar los dos números que mandan: 1,795 y $20,383.75.
5. **Congelar el Excel** como fuente hasta que la app esté en producción.

---

## 8. Resumen final

- El Excel es una **especificación funcional valiosa** y un **sistema frágil**: rangos fijos, narrativa desactualizada y 177 registros invisibles.
- La app propuesta **no inventa métricas**: reproduce las fórmulas, corrige la cobertura y hace visible la calidad del dato.
- La arquitectura **Netlify + Render + Postgres** es suficiente para el volumen actual y deja espacio para crecer.
- El MVP se entrega en **~2.5 semanas** y cuesta **$0/mes** en planes gratuitos (más dominio).
- El riesgo principal no es técnico: es **seguir alimentando dos fuentes**. La fecha de corte es la decisión más importante.

---

**Fin del plan.** Volver al [`00-INDICE-Y-RESUMEN.md`](./00-INDICE-Y-RESUMEN.md).
