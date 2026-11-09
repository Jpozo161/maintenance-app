-- =====================================================================
-- Usuario ADMIN inicial, para poder entrar a una base recién creada.
--
-- Correo:     admin@maintenance.local
-- Contraseña: Admin1234*
--
-- CAMBIA LA CONTRASEÑA DESDE LA APP EN CUANTO ENTRES. El hash de abajo
-- es público (está en el repo), así que esta clave no es secreta.
--
-- Ejecutar con "Execute script" (Alt+X / Opt+X) en DBeaver.
-- =====================================================================

USE `maintenance`;

-- Datos fijos. Normalmente los crea esquema_completo.sql, pero se repiten
-- aqui por si ese script no llego al final: sin la fila roles.id = 1 la clave
-- foranea usuarios_ibfk_2 rechaza el INSERT del admin.
INSERT IGNORE INTO roles (id, nombre) VALUES
  (1, 'ADMIN'), (2, 'TECNICO'), (3, 'SUPERVISOR'), (4, 'RESIDENTE'), (5, 'FRONTDESK');

INSERT IGNORE INTO estados_mantenimiento (id, nombre) VALUES
  (1, 'programado'), (2, 'proceso'), (3, 'completado'), (4, 'cancelado'), (5, 'Próximo mantenimiento');

-- Residencial de arranque. El admin puede ir sin residencial (el login usa
-- LEFT JOIN), pero casi todo el resto del sistema cuelga de uno.
INSERT IGNORE INTO residenciales (id, nombre, direccion)
VALUES (1, 'Residencial Principal', 'Por definir');

-- role_id = 1 (ADMIN), segun los datos fijos de esquema_completo.sql.
-- El hash es bcrypt coste 10, el mismo formato que genera la app.
INSERT IGNORE INTO usuarios (nombre, email, password, role_id, residencial_id, estado)
VALUES (
  'Administrador',
  'admin@maintenance.local',
  '$2b$10$q/XhE0mSwr3tCJsnXT4dlOwyV3voPWwfLDreAejUqsXEOwzIO5oCC',
  1,
  1,
  1
);

-- Comprobacion 1: deben existir los 5 roles y los 5 estados.
SELECT (SELECT COUNT(*) FROM roles) AS roles,
       (SELECT COUNT(*) FROM estados_mantenimiento) AS estados;

-- Comprobacion 2: debe devolver una fila con role_name = ADMIN.
SELECT u.id, u.nombre, u.email, roles.nombre AS role_name, u.residencial_id, u.estado
FROM usuarios AS u
LEFT JOIN roles ON roles.id = u.role_id
WHERE u.email = 'admin@maintenance.local';
