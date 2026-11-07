-- Próximo mantenimiento como registro nuevo: cada mantenimiento cerrado (completado o cancelado)
-- puede originar como máximo un mantenimiento siguiente. El índice UNIQUE evita duplicados
-- aunque lleguen varias peticiones a la vez.
-- Solo se crea si no existe (una ejecución anterior pudo dejar la columna creada sin registrar la migración).
SET @existe_origen := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mantenimientos' AND COLUMN_NAME = 'mantenimiento_origen_id'
);
SET @sql_origen := IF(@existe_origen = 0,
    'ALTER TABLE mantenimientos
       ADD COLUMN `mantenimiento_origen_id` int DEFAULT NULL AFTER `fecha_cierre`,
       ADD UNIQUE KEY `uq_mantenimientos_origen` (`mantenimiento_origen_id`),
       ADD CONSTRAINT `fk_mantenimientos_origen` FOREIGN KEY (`mantenimiento_origen_id`) REFERENCES `mantenimientos` (`id`)',
    'DO 0');
PREPARE stmt_origen FROM @sql_origen;
EXECUTE stmt_origen;
DEALLOCATE PREPARE stmt_origen;

-- fecha_cierre no se llenaba hasta ahora: se recupera del historial de estados (triggers)
-- para los mantenimientos que ya estaban completados (3) o cancelados (4).
-- Se copia primero a una tabla temporal: el trigger de UPDATE escribe en historial_mantenimiento
-- y MySQL no permite que la misma sentencia lo lea (error 1442).
DROP TEMPORARY TABLE IF EXISTS tmp_fecha_cierre;
CREATE TEMPORARY TABLE tmp_fecha_cierre AS
    SELECT m.id, MAX(h.fecha) AS fecha_cierre
    FROM mantenimientos AS m
    INNER JOIN historial_mantenimiento AS h ON h.mantenimiento_id = m.id AND h.estado_id = m.estado_id
    WHERE m.estado_id IN (3, 4) AND m.fecha_cierre IS NULL
    GROUP BY m.id;

UPDATE mantenimientos AS m
INNER JOIN tmp_fecha_cierre AS t ON t.id = m.id
SET m.fecha_cierre = t.fecha_cierre;

DROP TEMPORARY TABLE tmp_fecha_cierre;
