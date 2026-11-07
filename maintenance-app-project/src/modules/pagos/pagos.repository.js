const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");

const findAll = async (page) => {
    const [sql, values] = withPagination(
        `SELECT p.id, p.fecha_creacion, p.nombre, p.monto, p.numero_factura, p.apartamento_id,
                a.nombre AS apartamento_nombre, a.tipo AS apartamento_tipo, a.residencial_id,
                r.nombre AS nombre_residencial
         FROM pagos AS p
         LEFT JOIN apartamentos_casas AS a ON a.id = p.apartamento_id
         LEFT JOIN residenciales AS r ON r.id = a.residencial_id
         ORDER BY p.id`,
        [],
        page
    );
    const [rows] = await pool.query(sql, values);
    return rows;
};

const create = async ({ nombre, monto, fechaCreacion, numero_factura, apartamento_id }) => {
    const [result] = await pool.query(
        "INSERT INTO pagos (nombre, monto, fecha_creacion, numero_factura, apartamento_id) VALUES (?, ?, ?, ?, ?)",
        [nombre, monto, fechaCreacion, numero_factura, apartamento_id]
    );
    return result;
};

const update = async (id, { nombre, monto, numero_factura, apartamento_id }) => {
    const [result] = await pool.query(
        "UPDATE pagos SET nombre = ?, monto = ?, numero_factura = ?, apartamento_id = ? WHERE id = ?",
        [nombre, monto, numero_factura, apartamento_id, id]
    );
    return result.affectedRows > 0;
};

const remove = async (id) => {
    const [result] = await pool.query("DELETE FROM pagos WHERE id = ?", [id]);
    return result.affectedRows > 0;
};

module.exports = { findAll, create, update, remove };
