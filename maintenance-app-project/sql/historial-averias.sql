-- Ejecutar una sola vez sobre la base de datos mantenimiento.
-- Las averías completadas se archivan con eliminada_en; no se borra el reporte original.
ALTER TABLE averias
    ADD COLUMN estado VARCHAR(30) NOT NULL DEFAULT 'Reportada',
    ADD COLUMN eliminada_en DATETIME NULL;

CREATE TABLE IF NOT EXISTS historial_averias (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    averia_id INT NOT NULL,
    accion VARCHAR(30) NOT NULL,
    estado VARCHAR(30) NOT NULL,
    descripcion VARCHAR(400) NOT NULL,
    categoria VARCHAR(100) NULL,
    residencial_id INT NULL,
    fecha_averia DATE NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_historial_averia_fecha (averia_id, fecha_evento)
);

DROP TRIGGER IF EXISTS historial_averias_insert;
DROP TRIGGER IF EXISTS historial_averias_update;

DELIMITER $$
CREATE TRIGGER historial_averias_insert
AFTER INSERT ON averias
FOR EACH ROW
BEGIN
    INSERT INTO historial_averias
        (averia_id, accion, estado, descripcion, categoria, residencial_id, fecha_averia)
    VALUES
        (NEW.id, 'REPORTADA', NEW.estado, NEW.descripcion, NEW.categoria, NEW.residencial_id, NEW.fecha);
END$$

CREATE TRIGGER historial_averias_update
AFTER UPDATE ON averias
FOR EACH ROW
BEGIN
    IF NOT (NEW.estado <=> OLD.estado) THEN
        INSERT INTO historial_averias
            (averia_id, accion, estado, descripcion, categoria, residencial_id, fecha_averia)
        VALUES
            (NEW.id, 'ESTADO_CAMBIADO', NEW.estado, NEW.descripcion, NEW.categoria, NEW.residencial_id, NEW.fecha);
    END IF;
    IF OLD.eliminada_en IS NULL AND NEW.eliminada_en IS NOT NULL THEN
        INSERT INTO historial_averias
            (averia_id, accion, estado, descripcion, categoria, residencial_id, fecha_averia)
        VALUES
            (NEW.id, 'ELIMINADA', NEW.estado, NEW.descripcion, NEW.categoria, NEW.residencial_id, NEW.fecha);
    END IF;
END$$
DELIMITER ;
