-- La base existente ya contiene historial_mantenimiento con las FK a
-- mantenimientos, estados_mantenimiento y usuarios. En instalaciones limpias,
-- esta definición crea la tabla con las mismas columnas.
CREATE TABLE IF NOT EXISTS historial_mantenimiento (
    id INT NOT NULL AUTO_INCREMENT,
    mantenimiento_id INT NOT NULL,
    estado_id INT NOT NULL,
    usuario_id INT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    comentario TEXT NULL,
    PRIMARY KEY (id),
    INDEX idx_historial_mantenimiento_fecha (mantenimiento_id, fecha),
    CONSTRAINT fk_historial_mantenimiento
        FOREIGN KEY (mantenimiento_id) REFERENCES mantenimientos(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT fk_historial_estado
        FOREIGN KEY (estado_id) REFERENCES estados_mantenimiento(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT fk_historial_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS historial_estado_mantenimiento_insert;
CREATE TRIGGER historial_estado_mantenimiento_insert
AFTER INSERT ON mantenimientos
FOR EACH ROW
INSERT INTO historial_mantenimiento (mantenimiento_id, estado_id, fecha)
VALUES (NEW.id, NEW.estado_id, CURRENT_TIMESTAMP);

DROP TRIGGER IF EXISTS historial_estado_mantenimiento_update;
CREATE TRIGGER historial_estado_mantenimiento_update
AFTER UPDATE ON mantenimientos
FOR EACH ROW
INSERT INTO historial_mantenimiento (mantenimiento_id, estado_id, fecha)
SELECT NEW.id, NEW.estado_id, CURRENT_TIMESTAMP
WHERE NOT (OLD.estado_id <=> NEW.estado_id);
