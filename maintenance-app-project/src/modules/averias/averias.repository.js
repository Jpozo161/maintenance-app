const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");

// Las averías archivadas tienen eliminada_en; el historial lo guardan los triggers de la BD.

const findActive = async (page) => {

    const [sql, values] = withPagination(
        `SELECT a.id, a.residencial_id, a.descripcion, a.categoria, a.fecha, a.estado,
                r.nombre AS nombre_residencial
         FROM averias AS a
         LEFT JOIN residenciales AS r ON r.id = a.residencial_id
         WHERE a.eliminada_en IS NULL
         ORDER BY a.fecha DESC, a.id DESC`,
        [],
        page
    );
    const [rows] = await pool.query(sql, values);

    return rows;
};

const findById = async (id) => {
    const [rows] = await pool.query(
        "SELECT id, residencial_id, descripcion, categoria, fecha, estado, eliminada_en FROM averias WHERE id = ?",
        [id]
    );
    return rows[0] || null;
};

const create = async ({ residencial_id, descripcion, categoria }) => {
    const [result] = await pool.query(
        "INSERT INTO averias (residencial_id, descripcion, categoria) VALUES (?, ?, ?)",
        [residencial_id, descripcion, categoria]
    );
    const { eliminada_en, ...averia } = await findById(result.insertId);
    return averia;
};

const updateEstado = async (id, estado) => {
    await pool.query(
        "UPDATE averias SET estado = ? WHERE id = ? AND eliminada_en IS NULL", 
        [estado, id]
    );
};

// La condición de estado va en el mismo UPDATE por si cambió entre la consulta y el archivado.
const archiveIfCompleted = async (id) => {
    const [result] = await pool.query(
        "UPDATE averias SET eliminada_en = NOW() WHERE id = ? AND estado = 'Completada' AND eliminada_en IS NULL",
        [id]
    );
    return result.affectedRows > 0;
};

module.exports = { findActive, findById, create, updateEstado, archiveIfCompleted };
