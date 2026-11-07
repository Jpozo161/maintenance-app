const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");

// Los documentos archivados solo se ocultan (eliminado_en): el archivo se conserva en S3.
// mantenimientoId = null devuelve el historial completo de documentos guardados.
const findAll = async (mantenimientoId, page) => {
    const [sql, values] = withPagination(
        `SELECT d.id, d.mantenimiento_id, d.nombre_original, d.tipo_mime, d.tamano_bytes, d.created_at,
                m.tipo AS mantenimiento_tipo, m.descripcion AS mantenimiento_descripcion,
                u.nombre AS subido_por_nombre
         FROM documentos_mantenimiento AS d
         INNER JOIN mantenimientos AS m ON m.id = d.mantenimiento_id
         LEFT JOIN usuarios AS u ON u.id = d.subido_por
         WHERE d.eliminado_en IS NULL AND (? IS NULL OR d.mantenimiento_id = ?)
         ORDER BY d.created_at DESC, d.id DESC`,
        [mantenimientoId, mantenimientoId],
        page
    );
    const [rows] = await pool.query(sql, values);
    return rows;
};

const findById = async (id) => {
    const [rows] = await pool.query(
        `SELECT id, mantenimiento_id, nombre_original, tipo_mime, s3_object_key
         FROM documentos_mantenimiento WHERE id = ? AND eliminado_en IS NULL`,
        [id]
    );
    return rows[0] || null;
};

// true si algún documento (archivado o no) ya usa ese archivo en S3.
const existsByHash = async (sha256) => {
    const [rows] = await pool.query("SELECT 1 FROM documentos_mantenimiento WHERE sha256 = ? LIMIT 1", [sha256]);
    return rows.length > 0;
};

// Solo se asocian documentos a mantenimientos que no estén archivados.
const maintenanceExists = async (mantenimientoId) => {
    const [rows] = await pool.query(
        "SELECT 1 FROM mantenimientos WHERE id = ? AND eliminado_en IS NULL",
        [mantenimientoId]
    );
    return rows.length > 0;
};

const create = async (document) => {
    const [result] = await pool.query(
        `INSERT INTO documentos_mantenimiento
            (mantenimiento_id, nombre_original, tipo_mime, tamano_bytes, s3_object_key, sha256, subido_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            document.mantenimiento_id, document.nombre_original, document.tipo_mime,
            document.tamano_bytes, document.s3_object_key, document.sha256, document.subido_por
        ]
    );
    return result.insertId;
};

// Cambia el mantenimiento asociado. Devuelve false si el documento no existe.
const associate = async (id, mantenimientoId) => {
    const [result] = await pool.query(
        "UPDATE documentos_mantenimiento SET mantenimiento_id = ? WHERE id = ? AND eliminado_en IS NULL",
        [mantenimientoId, id]
    );
    if (result.affectedRows > 0) return true;
    return Boolean(await findById(id));
};

const archive = async (id) => {
    const [result] = await pool.query(
        "UPDATE documentos_mantenimiento SET eliminado_en = CURRENT_TIMESTAMP WHERE id = ? AND eliminado_en IS NULL",
        [id]
    );
    return result.affectedRows > 0;
};

module.exports = { findAll, findById, existsByHash, maintenanceExists, create, associate, archive };
