-- El estado "Próximo mantenimiento" (id 5) deja de usarse: el próximo mantenimiento se crea como
-- registro nuevo desde el historial. Los que estaban en ese estado son mantenimientos agendados,
-- así que pasan a "programado" (1). El trigger deja constancia del cambio en historial_mantenimiento.
-- La fila 5 de estados_mantenimiento se conserva porque el historial la referencia.
UPDATE mantenimientos SET estado_id = 1 WHERE estado_id = 5;
