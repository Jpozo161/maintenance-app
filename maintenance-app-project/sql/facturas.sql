-- Ejecutar una sola vez en la base de datos mantenimiento.
CREATE TABLE IF NOT EXISTS facturas (
  id INT NOT NULL AUTO_INCREMENT,
  nombre_original VARCHAR(255) NOT NULL,
  tipo_mime VARCHAR(100) NOT NULL,
  tamano_bytes BIGINT UNSIGNED NOT NULL,
  s3_object_key VARCHAR(1024) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  proveedor VARCHAR(255) NULL,
  numero_factura VARCHAR(120) NULL,
  fecha_factura VARCHAR(40) NULL,
  total DECIMAL(14,2) NULL,
  datos_ocr JSON NULL,
  texto_ocr LONGTEXT NULL,
  mantenimiento_id INT NULL,
  subido_por INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_facturas_sha256 (sha256),
  KEY ix_facturas_mantenimiento (mantenimiento_id),
  KEY ix_facturas_created_at (created_at),
  CONSTRAINT fk_facturas_mantenimiento FOREIGN KEY (mantenimiento_id) REFERENCES mantenimientos (id) ON DELETE SET NULL,
  CONSTRAINT fk_facturas_usuario FOREIGN KEY (subido_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
