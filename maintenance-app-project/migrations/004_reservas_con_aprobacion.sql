-- Vuelve la aprobación de reservas: las que pide un residente quedan PENDIENTE
-- hasta que el administrador las revise. Las que crea el administrador se insertan ya aprobadas.
ALTER TABLE reservas_areas MODIFY `estado` enum('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE';
