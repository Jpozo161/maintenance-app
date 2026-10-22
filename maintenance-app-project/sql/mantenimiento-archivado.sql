-- Ejecutar una sola vez en la base de datos mantenimiento.
-- Quita mantenimientos de las listas sin perder historial ni facturas asociadas.
ALTER TABLE mantenimientos
    ADD COLUMN eliminado_en DATETIME NULL DEFAULT NULL;
