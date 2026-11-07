-- Ejecutar una sola vez sobre la base de datos mantenimiento.
-- El técnico es opcional; al borrar un usuario, el mantenimiento queda sin asignación.
ALTER TABLE mantenimientos
    ADD COLUMN tecnico_id INT NULL AFTER residencial_id,
    ADD INDEX idx_mantenimientos_tecnico_id (tecnico_id),
    ADD CONSTRAINT fk_mantenimientos_tecnico
        FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
