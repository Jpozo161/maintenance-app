-- Fecha y hora de la visita (hora local de Bogotá), elegida en el formulario.
-- Las visitas existentes toman su fecha de registro.

ALTER TABLE visitas ADD COLUMN `fecha_visita` datetime NULL AFTER `motivo`;
UPDATE visitas SET fecha_visita = CONVERT_TZ(created_at, @@session.time_zone, '-05:00') WHERE fecha_visita IS NULL;
ALTER TABLE visitas MODIFY `fecha_visita` datetime NOT NULL;
ALTER TABLE visitas ADD KEY `ix_visitas_fecha_visita` (`fecha_visita`);
