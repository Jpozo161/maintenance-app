CREATE TABLE IF NOT EXISTS areas_sociales (
  id INT NOT NULL AUTO_INCREMENT,
  residencial_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  hora_apertura TIME NOT NULL DEFAULT '08:00:00',
  hora_cierre TIME NOT NULL DEFAULT '20:00:00',
  intervalo_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_area_residencial_nombre (residencial_id, nombre),
  KEY ix_areas_sociales_residencial_activa (residencial_id, activa),
  CONSTRAINT fk_areas_sociales_residencial
    FOREIGN KEY (residencial_id) REFERENCES residenciales (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reservas_areas (
  id INT NOT NULL AUTO_INCREMENT,
  area_id INT NOT NULL,
  usuario_id INT NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado ENUM('PENDIENTE','APROBADA','RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reservas_area_fecha_estado (area_id, fecha, estado),
  KEY ix_reservas_usuario_fecha (usuario_id, fecha),
  CONSTRAINT fk_reservas_area
    FOREIGN KEY (area_id) REFERENCES areas_sociales (id),
  CONSTRAINT fk_reservas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO roles (nombre)
SELECT 'RESIDENTE'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE UPPER(nombre) = 'RESIDENTE');
