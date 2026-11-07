-- Documentos PDF asociados a un mantenimiento. El archivo vive en un bucket S3 privado
-- (s3_object_key) y aquí se guardan sus metadatos. Reemplaza a la tabla facturas (OCR), que estaba vacía.
CREATE TABLE IF NOT EXISTS `documentos_mantenimiento` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mantenimiento_id` int NOT NULL,
  `nombre_original` varchar(255) NOT NULL,
  `tipo_mime` varchar(100) NOT NULL DEFAULT 'application/pdf',
  `tamano_bytes` bigint unsigned NOT NULL,
  `s3_object_key` varchar(1024) NOT NULL,
  `sha256` char(64) NOT NULL,
  `subido_por` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `eliminado_en` datetime DEFAULT NULL,
  -- 1 mientras no esté archivado; NULL al archivar, para que el índice único ignore los archivados
  -- y el mismo PDF se pueda volver a subir al mantenimiento.
  `activo` tinyint GENERATED ALWAYS AS (IF(`eliminado_en` IS NULL, 1, NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documentos_mantenimiento_archivo` (`mantenimiento_id`, `sha256`, `activo`),
  KEY `ix_documentos_mantenimiento_sha256` (`sha256`),
  KEY `ix_documentos_mantenimiento_created_at` (`created_at`),
  KEY `fk_documentos_mantenimiento_usuario` (`subido_por`),
  CONSTRAINT `fk_documentos_mantenimiento_mantenimiento` FOREIGN KEY (`mantenimiento_id`) REFERENCES `mantenimientos` (`id`),
  CONSTRAINT `fk_documentos_mantenimiento_usuario` FOREIGN KEY (`subido_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `facturas`;
