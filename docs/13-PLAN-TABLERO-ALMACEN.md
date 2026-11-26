# 13 · PLAN PARA EL TABLERO DEL ALMACÉN

**Origen:** hallazgos de `12-REVISION-ALMACENERO.md` (H1–H3, M1–M5, B1–B3).
**Regla de trabajo:** un paso por commit, sin push. Cada paso se verifica con el typecheck del área tocada y las pruebas que cubren el cambio.

---

## Principios de diseño

- **Dos audiencias, dos lecturas.** El almacén captura y confirma en segundos; gerencia lee tendencias y prioridades. Cada pantalla responde una pregunta principal.
- **Lo importante arriba.** KPIs y pendientes antes que las gráficas.
- **Lenguaje llano en español.** El detalle técnico queda plegado.
- **Una acción clara por pantalla.** Sin menús que compitan.
- **Estados vacíos y de error con siguiente paso.**
- **Colores de `lib/theme.ts` con significado fijo.** Rojo solo para lo que exige acción.

**Fuera de alcance:** roles de usuario. El acceso es una cuenta por variables de entorno; separar perfiles sería una funcionalidad nueva.

---

## Fase 0 · Validar antes de programar (lo hace el equipo)

- **0.1 Responder las 4 preguntas del almacén** (sección 4 de `12-REVISION-ALMACENERO.md`): registros diarios, top 5 de motivos, dato que miran primero, qué no encuentran en la app.
  - Criterio de salida: respuestas anotadas aquí.
- **0.2 Prueba de uso con una persona de almacén** en tablet y celular, con 5 tareas: registrar, corregir, ver lo de hoy, eliminar un error y revisar una alerta.
  - Criterio de salida: lista de puntos donde se detienen.

*Estado:* pendiente. No se puede completar desde código.

---

## Fase 1 · Captura diaria (prioridad alta)

- **1.1 Resumen "Hoy" en Nuevo registro** (H3). Muestra los registros del día y su costo total. Solo lectura.
- **1.2 Motivos más usados primero** (H2). Ordena el desplegable por frecuencia del último mes; el resto queda después.
- **1.3 Enlace al registro guardado** en la tarjeta de éxito, para ir a Registros con ese evento.

## Fase 2 · Corregir sin miedo (prioridad media)

- **2.1 Diálogo de eliminar con cantidad y costo** (M2).
- **2.2 Atajos "Hoy / Esta semana / Este mes" en Registros** (M1), con búsqueda por material visible y filtros avanzados plegados.

## Fase 3 · Gerencia ve lo que requiere acción (prioridad media)

- **3.1 Tarjeta "Pendientes de clasificar" en el panel** (M3). Si la API no expone el conteo, se revisa antes de tocar la web.
- **3.2 Acción correctiva en las alertas** (M4). Confirmar si la API ya la devuelve.
- **3.3 Conteo de hechos antes de reemplazar en Cargas** (M5). Es el paso de mayor riesgo; va al final.

## Fase 4 · Pulido y accesibilidad (prioridad baja)

- **4.1 Textos técnicos plegados** (B1).
- **4.2 Formato `dd/mm/aaaa` en todas las tablas** (B2).
- **4.3 Revisión de teclado y lector de pantalla** en registro y eliminar (B3).

---

## Decisiones abiertas

- ¿Las fases 3.1 y 3.2 pueden tocar la API, o se empieza por la web (fases 1, 2 y 4)?
- ¿Quién hace el paso 0.2 con el almacén?

## Estado de ejecución

| Paso | Estado | Commit |
|---|---|---|
| 0.1 | Pendiente (almacén) | – |
| 0.2 | Pendiente (almacén) | – |
| 1.1 | En curso | – |
| 1.2 | Pendiente | – |
| 1.3 | Pendiente | – |
| 2.1 | Pendiente | – |
| 2.2 | Pendiente | – |
| 3.1 | Pendiente | – |
| 3.2 | Pendiente | – |
| 3.3 | Pendiente | – |
| 4.1 | Pendiente | – |
| 4.2 | Pendiente | – |
| 4.3 | Pendiente | – |
