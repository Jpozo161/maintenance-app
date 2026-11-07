-- Rol FRONTDESK (recepción), tabla de visitas y reservas sin aprobación.
-- Los ids de roles deben coincidir con src/constants/index.js.

INSERT IGNORE INTO roles (id, nombre) VALUES (5, 'FRONTDESK');

CREATE TABLE IF NOT EXISTS `visitas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `residencial_id` int NOT NULL,
  `residente_id` int NOT NULL,
  `registrado_por` int NOT NULL,
  `nombre_visitante` varchar(200) NOT NULL,
  `tipo_documento` enum('CEDULA','PASAPORTE') NOT NULL,
  `numero_documento` varchar(50) NOT NULL,
  `motivo` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_visitas_residencial_fecha` (`residencial_id`,`created_at`),
  KEY `ix_visitas_residente_fecha` (`residente_id`,`created_at`),
  CONSTRAINT `fk_visitas_residencial` FOREIGN KEY (`residencial_id`) REFERENCES `residenciales` (`id`),
  CONSTRAINT `fk_visitas_residente` FOREIGN KEY (`residente_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_visitas_registrado_por` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Las reservas ya no se aprueban: quedan registradas al crearse.
UPDATE reservas_areas SET estado = 'APROBADA' WHERE estado = 'PENDIENTE';
ALTER TABLE reservas_areas MODIFY `estado` enum('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'APROBADA';
