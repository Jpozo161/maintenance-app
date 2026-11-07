-- Las visitas se registran al apartamento del residencial, no a un residente.
-- residente_id queda opcional: solo se guarda cuando el propio residente registra la visita.
-- Las visitas existentes toman el apartamento que tenía asignado su residente.

ALTER TABLE visitas
  ADD COLUMN `apartamento_id` int DEFAULT NULL AFTER `residencial_id`,
  ADD KEY `ix_visitas_apartamento_fecha` (`apartamento_id`, `fecha_visita`),
  ADD CONSTRAINT `fk_visitas_apartamento` FOREIGN KEY (`apartamento_id`) REFERENCES `apartamentos_casas` (`id`);

UPDATE visitas v
  INNER JOIN usuarios u ON u.id = v.residente_id
  SET v.apartamento_id = u.apartamento_id
  WHERE v.apartamento_id IS NULL;

ALTER TABLE visitas MODIFY `residente_id` int DEFAULT NULL;
