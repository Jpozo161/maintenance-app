-- Esquema completo de la base "mantenimiento" (generado desde la BD de desarrollo).
-- Crea todas las tablas, triggers de historial y datos fijos (roles y estados).
-- Los ids de roles y estados deben coincidir con src/constants/index.js.

CREATE TABLE IF NOT EXISTS `residenciales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `estados_mantenimiento` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `apartamentos_casas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `residencial_id` int DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `tipo` varchar(50) DEFAULT NULL,
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `residencial_id` (`residencial_id`),
  CONSTRAINT `apartamentos_casas_ibfk_1` FOREIGN KEY (`residencial_id`) REFERENCES `residenciales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `activos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unidad_id` int DEFAULT NULL,
  `nombre` varchar(200) DEFAULT NULL,
  `tipo` varchar(100) DEFAULT NULL,
  `modelo` varchar(100) DEFAULT NULL,
  `fecha_instalacion` date DEFAULT NULL,
  `estado` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `unidad_id` (`unidad_id`),
  CONSTRAINT `activos_ibfk_1` FOREIGN KEY (`unidad_id`) REFERENCES `apartamentos_casas` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `residencial_id` int DEFAULT NULL,
  `role_id` int DEFAULT NULL,
  `nombre` varchar(200) NOT NULL,
  `email` varchar(200) NOT NULL,
  `password` varchar(255) NOT NULL,
  `estado` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `apartamento_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `residencial_id` (`residencial_id`),
  KEY `role_id` (`role_id`),
  KEY `fk_usuario_apartamento` (`apartamento_id`),
  CONSTRAINT `fk_usuario_apartamento` FOREIGN KEY (`apartamento_id`) REFERENCES `apartamentos_casas` (`id`),
  CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`residencial_id`) REFERENCES `residenciales` (`id`),
  CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mantenimientos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipo_id` int DEFAULT NULL,
  `residencial_id` int DEFAULT NULL,
  `tecnico_id` int DEFAULT NULL,
  `estado_id` int NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `fecha_programada` datetime DEFAULT NULL,
  `descripcion` text,
  `costo` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_cierre` datetime DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `equipo_id` (`equipo_id`),
  KEY `tecnico_id` (`tecnico_id`),
  KEY `estado_id` (`estado_id`),
  KEY `idx_mantenimientos_residencial_id` (`residencial_id`),
  CONSTRAINT `fk_mantenimientos_residencial` FOREIGN KEY (`residencial_id`) REFERENCES `residenciales` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `mantenimientos_ibfk_1` FOREIGN KEY (`equipo_id`) REFERENCES `activos` (`id`),
  CONSTRAINT `mantenimientos_ibfk_2` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `mantenimientos_ibfk_3` FOREIGN KEY (`estado_id`) REFERENCES `estados_mantenimiento` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pagos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `monto` int NOT NULL,
  `fecha_creacion` date DEFAULT (curdate()),
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `pagos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `averias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `residencial_id` int DEFAULT NULL,
  `descripcion` varchar(400) NOT NULL,
  `categoria` varchar(100) DEFAULT NULL,
  `fecha` date DEFAULT (curdate()),
  `estado` varchar(30) NOT NULL DEFAULT 'Reportada',
  `eliminada_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `residencial_id` (`residencial_id`),
  CONSTRAINT `averias_ibfk_1` FOREIGN KEY (`residencial_id`) REFERENCES `residenciales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `facturas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_original` varchar(255) NOT NULL,
  `tipo_mime` varchar(100) NOT NULL,
  `tamano_bytes` bigint unsigned NOT NULL,
  `s3_object_key` varchar(1024) NOT NULL,
  `sha256` char(64) NOT NULL,
  `proveedor` varchar(255) DEFAULT NULL,
  `numero_factura` varchar(120) DEFAULT NULL,
  `fecha_factura` varchar(40) DEFAULT NULL,
  `total` decimal(14,2) DEFAULT NULL,
  `datos_ocr` json DEFAULT NULL,
  `texto_ocr` longtext,
  `mantenimiento_id` int DEFAULT NULL,
  `subido_por` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_facturas_sha256` (`sha256`),
  KEY `ix_facturas_mantenimiento` (`mantenimiento_id`),
  KEY `ix_facturas_created_at` (`created_at`),
  KEY `fk_facturas_usuario` (`subido_por`),
  CONSTRAINT `fk_facturas_mantenimiento` FOREIGN KEY (`mantenimiento_id`) REFERENCES `mantenimientos` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_facturas_usuario` FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `historial_averias` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `averia_id` int NOT NULL,
  `accion` varchar(30) NOT NULL,
  `estado` varchar(30) NOT NULL,
  `descripcion` varchar(400) NOT NULL,
  `categoria` varchar(100) DEFAULT NULL,
  `residencial_id` int DEFAULT NULL,
  `fecha_averia` date DEFAULT NULL,
  `fecha_evento` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_historial_averia_fecha` (`averia_id`,`fecha_evento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `historial_mantenimiento` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mantenimiento_id` int DEFAULT NULL,
  `estado_id` int DEFAULT NULL,
  `usuario_id` int DEFAULT NULL,
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `comentario` text,
  PRIMARY KEY (`id`),
  KEY `mantenimiento_id` (`mantenimiento_id`),
  KEY `estado_id` (`estado_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `historial_mantenimiento_ibfk_1` FOREIGN KEY (`mantenimiento_id`) REFERENCES `mantenimientos` (`id`),
  CONSTRAINT `historial_mantenimiento_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estados_mantenimiento` (`id`),
  CONSTRAINT `historial_mantenimiento_ibfk_3` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `areas_sociales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `residencial_id` int NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text,
  `hora_apertura` time NOT NULL DEFAULT '08:00:00',
  `hora_cierre` time NOT NULL DEFAULT '20:00:00',
  `intervalo_minutos` smallint unsigned NOT NULL DEFAULT '60',
  `activa` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_area_residencial_nombre` (`residencial_id`,`nombre`),
  KEY `ix_areas_sociales_residencial_activa` (`residencial_id`,`activa`),
  CONSTRAINT `fk_areas_sociales_residencial` FOREIGN KEY (`residencial_id`) REFERENCES `residenciales` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `reservas_areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `area_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `fecha` date NOT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `estado` enum('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_reservas_area_fecha_estado` (`area_id`,`fecha`,`estado`),
  KEY `ix_reservas_usuario_fecha` (`usuario_id`,`fecha`),
  CONSTRAINT `fk_reservas_area` FOREIGN KEY (`area_id`) REFERENCES `areas_sociales` (`id`),
  CONSTRAINT `fk_reservas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Historial automático de averías y de cambios de estado de mantenimientos.
DROP TRIGGER IF EXISTS `historial_averias_insert`;
CREATE TRIGGER `historial_averias_insert` AFTER INSERT ON `averias` FOR EACH ROW BEGIN
      INSERT INTO historial_averias (averia_id, accion, estado, descripcion, categoria, residencial_id, fecha_averia)
      VALUES (NEW.id, 'REPORTADA', NEW.estado, NEW.descripcion, NEW.categoria, NEW.residencial_id, NEW.fecha);
    END;

DROP TRIGGER IF EXISTS `historial_averias_update`;
CREATE TRIGGER `historial_averias_update` AFTER UPDATE ON `averias` FOR EACH ROW BEGIN
      IF NOT (NEW.estado <=> OLD.estado) THEN
        INSERT INTO historial_averias (averia_id, accion, estado, descripcion, categoria, residencial_id, fecha_averia)
        VALUES (NEW.id, 'ESTADO_CAMBIADO', NEW.estado, NEW.descripcion, NEW.categoria, NEW.residencial_id, NEW.fecha);
      END IF;
      IF OLD.eliminada_en IS NULL AND NEW.eliminada_en IS NOT NULL THEN
        INSERT INTO historial_averias (averia_id, accion, estado, descripcion, categoria, residencial_id, fecha_averia)
        VALUES (NEW.id, 'ELIMINADA', NEW.estado, NEW.descripcion, NEW.categoria, NEW.residencial_id, NEW.fecha);
      END IF;
    END;

DROP TRIGGER IF EXISTS `historial_estado_mantenimiento_insert`;
CREATE TRIGGER `historial_estado_mantenimiento_insert` AFTER INSERT ON `mantenimientos` FOR EACH ROW INSERT INTO historial_mantenimiento(mantenimiento_id,estado_id,fecha) VALUES(NEW.id,NEW.estado_id,CURRENT_TIMESTAMP);

DROP TRIGGER IF EXISTS `historial_estado_mantenimiento_update`;
CREATE TRIGGER `historial_estado_mantenimiento_update` AFTER UPDATE ON `mantenimientos` FOR EACH ROW INSERT INTO historial_mantenimiento(mantenimiento_id,estado_id,fecha) SELECT NEW.id,NEW.estado_id,CURRENT_TIMESTAMP WHERE NOT (OLD.estado_id <=> NEW.estado_id);

-- Datos fijos.
INSERT IGNORE INTO roles (id, nombre) VALUES (1, 'ADMIN'), (2, 'TECNICO'), (3, 'SUPERVISOR'), (4, 'RESIDENTE');
INSERT IGNORE INTO estados_mantenimiento (id, nombre) VALUES
    (1, 'programado'), (2, 'proceso'), (3, 'completado'), (4, 'cancelado'), (5, 'Próximo mantenimiento');
