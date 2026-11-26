# 12 · REVISIÓN DEL FRONTEND DESDE EL ALMACÉN

**Enfoque:** revisar la aplicación web como la usaría el almacenero en su día de trabajo, sabiendo que antes el control se hacía en el Excel `REPORTE_MERMA_DIARIA_GERENCIAL_V7_DARK` (ver `01-ANALISIS-DEL-EXCEL.md`).

**Alcance:** lectura del código de las pantallas. No se probó en navegador ni con datos reales; los puntos marcados como “verificar” necesitan confirmarse en uso.

---

## 1. Qué hacía el Excel y qué hace la app ahora

| Tarea del día | En el Excel | En la app |
|---|---|---|
| Registrar una merma | Escribir fecha, código, cantidad y motivo en una fila de `REGISTRO_MERMAS` | Pantalla **Nuevo registro** con 4 campos; semana, costo y unidad se calculan solos |
| Buscar el material | Escribir el código; el resto se resolvía con `INDEX/MATCH` | Desplegable con filtro por texto en el maestro |
| Corregir un error | Editar la fila a mano | Editar o eliminar desde **Registros**, con historial por producto |
| Ver el día o la semana | Abrir `DASHBOARD_GERENCIAL` | **Panel gerencial** con KPIs, gráficas, alertas y filtros globales |
| Ver qué SKU pesa más | Hoja oculta `PROYECCION_Y_PARETO` | **Análisis** con Pareto ABC |
| Cargar el reporte completo | Pegar datos en el libro | **Cargas** con `.xlsx`, modo agregar o reemplazar |

**Lo que mejoró:** el costo y la semana ya no se digitan; los motivos mal escritos se clasifican igual que en la carga; hay historial y exportación CSV.

**Lo que el Excel hacía y la app todavía no muestra con claridad** (ver sección 3).

---

## 2. Lo que funciona bien para el almacén

- **Captura corta.** Solo 4 campos, con validación antes de enviar.
- **Material con buscador.** Evita el error de código que el Excel no detectaba.
- **Errores visibles.** Cuando el registro falla, la API devuelve un mensaje y un código; no se oculta como el `IFERROR` del Excel.
- **Duplicados rechazados.** Un evento igual (fecha, material, cantidad, motivo) no entra dos veces.
- **Corrección sin tocar el Excel.** Editar y eliminar están en la tabla de registros.
- **Historial por producto** para ver quién cambió qué.

---

## 3. Hallazgos y mejoras, priorizados para el día a día

Prioridad **Alta** = impide o retrasa el trabajo diario. **Media** = ahorra tiempo o evita errores. **Baja** = pulido.

### Alta

**H1. Captura seguida: ya conserva fecha, material y motivo.**
- Al guardar, `NuevoRegistroPage` solo limpia la cantidad. Sin cambios de código.
- Pendiente: confirmar en uso si el almacén necesita además conservar el motivo entre registros del mismo tipo.

**H2. El motivo es un desplegable sin texto libre para lo frecuente.**
- El Excel aceptaba cualquier texto y lo normalizaba con `IFERROR`. La app exige elegir del catálogo o alias.
- Mejora: que los 13 motivos del catálogo aparezcan primero, en orden de uso, para que la captura sea de un toque.
- Verificar: cuántos motivos usa el almacén en realidad.

**H3. No se ve de un vistazo lo registrado hoy.**
- El panel muestra el corte de un rango; no hay un resumen “hoy” o “esta semana” en la pantalla de captura.
- Mejora: en **Nuevo registro**, mostrar los últimos registros cargados por el propio usuario y el total del día.
- Esto reemplaza la hoja `REGISTRO_MERMAS` como lugar donde el almacenero confirma lo que ya cargó.

### Media

**M1. La pantalla de Registros es densa para el almacén.**
- Muchas columnas y filtros (mes, programa, familia, gestión). El almacenero busca casi siempre por fecha o por material.
- Mejora: un atajo “Hoy / Esta semana / Este mes” y una búsqueda por código o descripción visible sin abrir filtros.

**M2. Al eliminar, la confirmación muestra el id y la descripción, pero no el costo.**
- `RegistrosPage` muestra el diálogo con el número de registro y la descripción del material. Conviene añadir cantidad y costo para evitar borrar el evento equivocado.

**M3. Falta una vista de “pendientes de auditar”.**
- El Excel marcaba “Por Auditar” cuando el motivo no tenía gestionabilidad. En la app ese caso se resuelve en la API, pero no hay una lista para revisarlo.
- Mejora: un filtro o tarjeta en el panel con los registros “SIN CLASIFICAR” o sin área responsable.

**M4. Las alertas del panel no dicen qué hacer.**
- La lista de alertas de calidad indica el hallazgo, pero el almacenero necesita la acción sugerida (la del `CATALOGO_MOTIVOS`: “Acción correctiva”).
- Mejora: mostrar la acción correctiva junto a cada alerta cuando exista en el catálogo.

**M5. Carga de Excel: el modo “reemplazar” es riesgoso en el día.**
- Exige marcar una confirmación, lo cual es correcto, pero el texto no dice cuántos hechos se van a borrar antes de confirmar.
- Mejora: mostrar el conteo de la carga anterior del mismo archivo antes de confirmar.

### Baja

**B1. Textos técnicos en pantalla.** Mensajes como “merma.carga”, “Registro manual” o códigos de error se leen bien para el equipo técnico, pero no para el almacén. Mejor una línea en lenguaje llano y el detalle técnico plegado.

**B2. Fechas en formato largo en tablas.** Revisar que las fechas de la tabla usen `dd/mm/aaaa` en todas las pantallas, como el Excel.

**B3. Accesibilidad de los formularios.** Ya se añadió `aria-describedby` en el registro. Falta probar con teclado y lector de pantalla.

---

## 4. Qué necesito del almacén para priorizar

1. ¿Cuántos registros manuales hacen en un día normal, y cuántos son del mismo material?
2. ¿Cuáles son los 5 motivos que más usan?
3. ¿Qué dato del Excel miran primero cada mañana?
4. ¿Hay algo del Excel que hoy no encuentren en la app?

---

## 5. Siguientes pasos sugeridos

1. Confirmar con el almacén las respuestas de la sección 4.
2. Atacar H1 y H2 primero: son captura diaria.
3. Verificar M2 y M5 leyendo el código de los diálogos antes de cambiar nada.
4. Probar la app en navegador con un usuario de almacén antes de dar por cerrado cada punto.
