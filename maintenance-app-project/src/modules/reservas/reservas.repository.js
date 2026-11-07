const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");
const { ESTADOS_RESERVA } = require("../../constants");

// Las funciones que reciben `db` pueden usarse dentro de una transacción pasando la conexión.

const SELECT_WITH_DETAILS = `
    SELECT b.id, b.area_id, b.usuario_id, DATE_FORMAT(b.fecha, '%Y-%m-%d') AS fecha,
           TIME_FORMAT(b.hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(b.hora_fin, '%H:%i') AS hora_fin,
           b.estado, b.created_at, a.nombre AS area_nombre, r.nombre AS residencial_nombre, u.nombre AS usuario_nombre
    FROM reservas_areas b
    INNER JOIN areas_sociales a ON a.id = b.area_id
    INNER JOIN residenciales r ON r.id = a.residencial_id
    INNER JOIN usuarios u ON u.id = b.usuario_id`;

// Reservas que ocupan horario (pendientes y aprobadas). excludeId ignora una reserva concreta.
const findActiveForDate = async (areaId, fecha, excludeId = null, db = pool) => {
    let sql = "SELECT id, hora_inicio, hora_fin, estado FROM reservas_areas WHERE area_id = ? AND fecha = ? AND estado IN (?, ?)";
    const values = [areaId, fecha, ESTADOS_RESERVA.PENDIENTE, ESTADOS_RESERVA.APROBADA];
    if (excludeId != null) {
        sql += " AND id <> ?";
        values.push(excludeId);
    }
    const [rows] = await db.query(sql, values);
    return rows;
};

// userId = null devuelve todas; con un id, solo las de ese usuario.
const findAll = async (userId, page) => {
    const values = [];
    let sql = SELECT_WITH_DETAILS;
    if (userId != null) {
        sql += " WHERE b.usuario_id = ?";
        values.push(userId);
    }
    sql += " ORDER BY b.fecha DESC, b.hora_inicio DESC";

    const [rows] = await pool.query(...withPagination(sql, values, page));
    return rows;
};

const findWithDetails = async (id, db = pool) => {
    const [rows] = await db.query(`${SELECT_WITH_DETAILS} WHERE b.id = ?`, [id]);
    return rows[0] || null;
};

// Bloquea la reserva para que dos administradores no la revisen a la vez.
const findByIdForUpdate = async (id, connection) => {
    const [rows] = await connection.query(
        `SELECT id, area_id, usuario_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, estado
         FROM reservas_areas WHERE id = ? FOR UPDATE`,
        [id]
    );
    return rows[0] || null;
};

const create = async ({ area_id, usuario_id, fecha, hora_inicio, hora_fin, estado }, db = pool) => {
    const [result] = await db.query(
        "INSERT INTO reservas_areas (area_id, usuario_id, fecha, hora_inicio, hora_fin, estado) VALUES (?, ?, ?, ?, ?, ?)",
        [area_id, usuario_id, fecha, hora_inicio, hora_fin, estado]
    );
    return result.insertId;
};

const updateEstado = async (id, estado, db = pool) => {
    const [result] = await db.query("UPDATE reservas_areas SET estado = ? WHERE id = ?", [estado, id]);
    return result.affectedRows > 0;
};

module.exports = { findActiveForDate, findAll, findWithDetails, findByIdForUpdate, create, updateEstado };
