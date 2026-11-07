const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");

const SELECT_WITH_DETAILS = `
    SELECT v.id, v.residencial_id, v.apartamento_id, v.residente_id, v.registrado_por, v.nombre_visitante,
           v.tipo_documento, v.numero_documento, v.motivo, v.created_at,
           DATE_FORMAT(v.fecha_visita, '%Y-%m-%d %H:%i') AS fecha_visita,
           r.nombre AS residencial_nombre, a.nombre AS apartamento_nombre, a.tipo AS apartamento_tipo,
           res.nombre AS residente_nombre, reg.nombre AS registrado_por_nombre
    FROM visitas v
    INNER JOIN residenciales r ON r.id = v.residencial_id
    LEFT JOIN apartamentos_casas a ON a.id = v.apartamento_id
    LEFT JOIN usuarios res ON res.id = v.residente_id
    INNER JOIN usuarios reg ON reg.id = v.registrado_por`;

// Filtros opcionales: residenteId/apartamentoId (historial de un residente: las que registró
// y las de su apartamento) o residencialId (recepción).
const findAll = async ({ residenteId = null, apartamentoId = null, residencialId = null } = {}, page) => {
    const conditions = [];
    const values = [];
    if (residenteId != null && apartamentoId != null) {
        conditions.push("(v.residente_id = ? OR v.apartamento_id = ?)");
        values.push(residenteId, apartamentoId);
    } else if (residenteId != null) {
        conditions.push("v.residente_id = ?");
        values.push(residenteId);
    }
    if (residencialId != null) {
        conditions.push("v.residencial_id = ?");
        values.push(residencialId);
    }

    let sql = SELECT_WITH_DETAILS;
    if (conditions.length) sql += ` WHERE ${conditions.join(" AND ")}`;
    sql += " ORDER BY v.fecha_visita DESC, v.id DESC";

    const [rows] = await pool.query(...withPagination(sql, values, page));
    return rows;
};

const findWithDetails = async (id) => {
    const [rows] = await pool.query(`${SELECT_WITH_DETAILS} WHERE v.id = ?`, [id]);
    return rows[0] || null;
};

const create = async (visita) => {
    const [result] = await pool.query(
        `INSERT INTO visitas (residencial_id, apartamento_id, residente_id, registrado_por, nombre_visitante, tipo_documento, numero_documento, motivo, fecha_visita)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [visita.residencial_id, visita.apartamento_id, visita.residente_id, visita.registrado_por, visita.nombre_visitante,
            visita.tipo_documento, visita.numero_documento, visita.motivo, visita.fecha_visita]
    );
    return result.insertId;
};

module.exports = { findAll, findWithDetails, create };
