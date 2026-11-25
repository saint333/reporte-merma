-- ============================================================
-- 0003 · Seeds de catálogo y parámetros
-- Generado desde CATALOGO_MOTIVOS (filas 5-17) del libro fuente.
-- Idempotente: no sobrescribe cambios manuales del catálogo.
-- ============================================================

insert into merma.dim_motivo
  (codigo, categoria, area_responsable, gestionabilidad, accion_correctiva)
values
  ('ROTURA DE EMBALAJES', 'Operativa - Manipulación', 'Packing / Estiba', 'Controlable', 'Capacitación en armado/estiba y revisión de guías en línea'),
  ('APILADO', 'Operativa - Almacenaje', 'Almacén / Despacho', 'Controlable', 'Control de altura máxima de rumas y uso de esquineros'),
  ('REEMPAQUE', 'Operativa - Reproceso', 'Aseguramiento Calidad / Packing', 'Controlable', 'Inspección previa de fruta antes de encajado final'),
  ('PRUEBA DE PROCESO', 'Calibración / Arranque', 'Mantenimiento / Producción', 'Estándar Técnico', 'Estandarizar parámetros de arranque de máquinas'),
  ('ERROR DE IMPRESIÓN', 'Operativa - Etiquetado', 'Codificación / Trazabilidad', 'Controlable', 'Verificación de lote/etiqueta antes de tirada masiva'),
  ('ETIQUETADO AL VACÍO', 'Operativa - Etiquetado', 'Línea de Empaque', 'Controlable', 'Calibración de sensores ópticos de etiquetadoras'),
  ('CONTRAMUESTRA', 'Calidad / Retención', 'Aseguramiento de Calidad', 'Estándar Técnico', 'Ajustar muestreo al plan estadístico AQL'),
  ('SUMINISTRO', 'Logística / Abastecimiento', 'Almacén de Materiales', 'Controlable', 'Mejora en despacho fraccionado y devolución a almacén'),
  ('LINEAS A&B', 'Operativa - Línea', 'Producción Líneas A&B', 'Controlable', 'Auditoría mecánica en puntos de atasco Líneas A&B'),
  ('DEFECTO DE FÁBRICA', 'Calidad Proveedor', 'Compras / Proveedores (Reclamo)', 'Recuperable Proveedor', 'Gestión de Nota de Crédito / Reposición con proveedor'),
  ('PRUEBA DE CALIDAD', 'Inspección / Laboratorio', 'Aseguramiento de Calidad', 'Estándar Técnico', 'Registro de lotes evaluados'),
  ('SELLADO', 'Operativa - Maquinaria', 'Mantenimiento / Línea', 'Controlable', 'Control de temperatura y presión de mordazas'),
  ('SIN CLASIFICAR', 'Auditoría Pendiente', 'Supervisor de Turno', 'Por Auditar', 'Regularizar motivo en cierre de turno (Alerta Oct-S40)')
on conflict (codigo) do nothing;

-- Alias iniciales (decisión D2, ver docs/09)
insert into merma.dim_motivo_alias (alias, motivo_codigo)
values ('MALA IMPRESIÓN', 'ERROR DE IMPRESIÓN')
on conflict (alias) do nothing;

-- Parámetros de escenario (C8, C9 y umbral de C7 del Excel)
insert into merma.parametro (clave, valor, etiqueta, descripcion) values
  ('meta_reduccion_controlable', 0.25, 'Meta de reducción', 'Objetivo sobre la merma controlable (C9 del Excel)'),
  ('semanas_restantes',          6,    'Semanas restantes', 'Horizonte de proyección al cierre (C8 del Excel)'),
  ('umbral_semana_atipica',      3000, 'Umbral de atípico', 'Semanas con costo menor se usan para el promedio ajustado (C7)')
on conflict (clave) do nothing;
