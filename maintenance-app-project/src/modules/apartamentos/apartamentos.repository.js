const { pool } = require("../../config/db");

// Apartamentos y casas (tabla apartamentos_casas): un residencial tiene muchos apartamentos
// y un apartamento tiene muchos usuarios (usuarios.apartamento_id).
// residencialId = null devuelve los de todos los residenciales.
const findAll = async (residencialId) => {
    const [rows] = await pool.query(
        `SELECT a.id, a.residencial_id, r.nombre AS nombre_residencial, a.nombre, a.tipo, a.created_at,
                COUNT(u.id) AS usuarios_count
         FROM apartamentos_casas AS a
         LEFT JOIN residenciales AS r ON r.id = a.residencial_id
         LEFT JOIN usuarios AS u ON u.apartamento_id = a.id AND COALESCE(u.estado, 1) = 1
         WHERE (? IS NULL OR a.residencial_id = ?)
         GROUP BY a.id, a.residencial_id, r.nombre, a.nombre, a.tipo, a.created_at
         ORDER BY r.nombre, a.nombre`,
        [residencialId, residencialId]
    );
    return rows;
};

const findById = async (id) => {
    const [rows] = await pool.query(
        "SELECT id, residencial_id, nombre, tipo FROM apartamentos_casas WHERE id = ?",
        [id]
    );
    return rows[0] || null;
};

const create = async ({ residencial_id, nombre, tipo }) => {
    const [result] = await pool.query(
        "INSERT INTO apartamentos_casas (residencial_id, nombre, tipo) VALUES (?, ?, ?)",
        [residencial_id, nombre, tipo]
    );
    return findById(result.insertId);
};

// Devuelve el apartamento actualizado o null si no existe.
const update = async (id, { residencial_id, nombre, tipo }) => {
    await pool.query(
        "UPDATE apartamentos_casas SET residencial_id = ?, nombre = ?, tipo = ? WHERE id = ?",
        [residencial_id, nombre, tipo, id]
    );
    return findById(id);
};

const remove = async (id) => {
    const [result] = await pool.query("DELETE FROM apartamentos_casas WHERE id = ?", [id]);
    return result.affectedRows > 0;
};

module.exports = { findAll, findById, create, update, remove };
