const { pool } = require("../../config/db");

// Las funciones que reciben `db` pueden usarse dentro de una transacción pasando la conexión.

const findById = async (id, db = pool) => {
    const [rows] = await db.query("SELECT * FROM areas_sociales WHERE id = ?", [id]);
    return rows[0] || null;
};

// Bloquea la fila del área hasta terminar la transacción: así dos reservas
// simultáneas sobre la misma área se procesan una después de la otra.
const findByIdForUpdate = async (id, connection) => {
    const [rows] = await connection.query("SELECT * FROM areas_sociales WHERE id = ? FOR UPDATE", [id]);
    return rows[0] || null;
};

const findAll = async ({ residencialId = null, soloActivas = false } = {}) => {
    const conditions = [];
    const values = [];
    if (residencialId != null) {
        conditions.push("a.residencial_id = ?");
        values.push(residencialId);
    }
    if (soloActivas) conditions.push("a.activa = 1");

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await pool.query(
        `SELECT a.*, r.nombre AS residencial_nombre
         FROM areas_sociales AS a
         INNER JOIN residenciales AS r ON r.id = a.residencial_id
         ${where}
         ORDER BY r.nombre, a.nombre`,
        values
    );
    return rows;
};

const create = async (area) => {
    const [result] = await pool.query(
        `INSERT INTO areas_sociales (residencial_id, nombre, descripcion, hora_apertura, hora_cierre, intervalo_minutos, activa)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [area.residencial_id, area.nombre, area.descripcion, area.hora_apertura, area.hora_cierre, area.intervalo_minutos, area.activa]
    );
    return findById(result.insertId);
};

// Devuelve el área actualizada o null si no existe.
const update = async (id, area) => {
    if (!await findById(id)) return null;
    await pool.query(
        `UPDATE areas_sociales
         SET residencial_id = ?, nombre = ?, descripcion = ?, hora_apertura = ?, hora_cierre = ?, intervalo_minutos = ?, activa = ?
         WHERE id = ?`,
        [area.residencial_id, area.nombre, area.descripcion, area.hora_apertura, area.hora_cierre, area.intervalo_minutos, area.activa, id]
    );
    return findById(id);
};

module.exports = { findById, findByIdForUpdate, findAll, create, update };
