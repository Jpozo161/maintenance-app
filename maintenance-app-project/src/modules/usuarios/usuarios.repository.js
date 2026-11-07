const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");
const { ROLES } = require("../../constants");

// usuarios.estado: 1 = activo, 0 = desactivado (nunca se borran para conservar pagos).
const ACTIVE = "COALESCE(u.estado, 1) = 1";

const findForLogin = async (email) => {
    const [rows] = await pool.query(
        `SELECT u.id, u.nombre, u.email, u.password, u.residencial_id, r.nombre AS residencial_nombre,
                roles.nombre AS role_name
         FROM usuarios AS u
         LEFT JOIN roles ON roles.id = u.role_id
         LEFT JOIN residenciales AS r ON r.id = u.residencial_id
         WHERE u.email = ? AND ${ACTIVE}`,
        [email]
    );
    return rows[0] || null;
};

// Datos que viajan en req.user en cada petición autenticada.
const findActiveSessionUser = async (id) => {
    const [rows] = await pool.query(
        `SELECT u.id, u.nombre AS name, u.email, UPPER(TRIM(roles.nombre)) AS role, u.residencial_id,
                r.nombre AS residencial_nombre, u.apartamento_id
         FROM usuarios AS u
         LEFT JOIN roles ON roles.id = u.role_id
         LEFT JOIN residenciales AS r ON r.id = u.residencial_id
         WHERE u.id = ? AND ${ACTIVE}`,
        [id]
    );
    return rows[0] || null;
};

const create = async ({ nombre, email, passwordHash, roleId, residencialId, apartamentoId }) => {
    const [result] = await pool.query(
        "INSERT INTO usuarios (nombre, email, password, role_id, residencial_id, apartamento_id) VALUES (?, ?, ?, ?, ?, ?)",
        [nombre, email, passwordHash, roleId, residencialId, apartamentoId]
    );
    return result;
};

const findAll = async (page) => {
    const [sql, values] = withPagination(
        `SELECT u.id, u.nombre, u.email, u.residencial_id, u.role_id, u.apartamento_id,
                r.nombre AS res_nombre, a.nombre AS apartamento_nombre, roles.nombre AS rol
         FROM usuarios AS u
         LEFT JOIN residenciales AS r ON r.id = u.residencial_id
         LEFT JOIN apartamentos_casas AS a ON a.id = u.apartamento_id
         LEFT JOIN roles ON roles.id = u.role_id
         WHERE ${ACTIVE}
         ORDER BY u.id DESC`,
        [],
        page
    );
    const [rows] = await pool.query(sql, values);
    return rows;
};

const update = async (id, { nombre, email, role_id, residencial_id, apartamento_id }) => {
    const [result] = await pool.query(
        "UPDATE usuarios SET nombre = ?, email = ?, role_id = ?, residencial_id = ?, apartamento_id = ? WHERE id = ?",
        [nombre, email, role_id, residencial_id, apartamento_id, id]
    );
    return result.affectedRows > 0;
};

const deactivate = async (id) => {
    const [result] = await pool.query(
        "UPDATE usuarios SET estado = 0 WHERE id = ? AND COALESCE(estado, 1) = 1",
        [id]
    );
    return result.affectedRows > 0;
};

const findRoles = async () => {
    const [rows] = await pool.query("SELECT id, nombre FROM roles ORDER BY nombre");
    return rows;
};

const findRoleById = async (id) => {
    const [rows] = await pool.query("SELECT id, nombre FROM roles WHERE id = ?", [id]);
    return rows[0] || null;
};

const findTechnicians = async () => {
    const [rows] = await pool.query(
        `SELECT u.id, u.nombre, u.email, roles.nombre AS rol
         FROM usuarios AS u
         INNER JOIN roles ON roles.id = u.role_id
         WHERE ${ACTIVE} AND UPPER(roles.nombre) = ?
         ORDER BY u.nombre`,
        [ROLES.TECNICO]
    );
    return rows;
};

// Residentes activos de un residencial (para visitas y reservas hechas por el personal).
const findResidents = async (residencialId) => {
    const [rows] = await pool.query(
        `SELECT u.id, u.nombre, u.email, u.residencial_id
         FROM usuarios AS u
         INNER JOIN roles ON roles.id = u.role_id
         WHERE ${ACTIVE} AND UPPER(roles.nombre) = ? AND u.residencial_id = ?
         ORDER BY u.nombre`,
        [ROLES.RESIDENTE, residencialId]
    );
    return rows;
};

const findActiveResident = async (id) => {
    const [rows] = await pool.query(
        `SELECT u.id, u.nombre, u.residencial_id
         FROM usuarios AS u
         INNER JOIN roles ON roles.id = u.role_id
         WHERE ${ACTIVE} AND UPPER(roles.nombre) = ? AND u.id = ?`,
        [ROLES.RESIDENTE, id]
    );
    return rows[0] || null;
};

module.exports = {
    findForLogin,
    findActiveSessionUser,
    create,
    findAll,
    update,
    deactivate,
    findRoles,
    findRoleById,
    findTechnicians,
    findResidents,
    findActiveResident
};
