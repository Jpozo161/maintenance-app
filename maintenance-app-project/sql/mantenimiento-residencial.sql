-- Relaciona cada mantenimiento nuevo con una propiedad existente.
-- Las filas históricas quedan con residencial_id = NULL porque no existe
-- información para determinar a qué propiedad pertenece cada registro.
ALTER TABLE mantenimientos
    ADD COLUMN residencial_id INT NULL AFTER equipo_id,
    ADD INDEX idx_mantenimientos_residencial_id (residencial_id),
    ADD CONSTRAINT fk_mantenimientos_residencial
        FOREIGN KEY (residencial_id) REFERENCES residenciales(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
