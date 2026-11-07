const { pool } = require("../../config/db");

const findAll = async () => {
    const [rows] = await pool.query("SELECT * FROM residenciales");
    return rows;
};

const findById = async (id) => {
    const [rows] = await pool.query("SELECT * FROM residenciales WHERE id = ?", [id]);
    return rows[0] || null;
};

const create = async ({ nombre, direccion }) => {
    const [result] = await pool.query("INSERT INTO residenciales (nombre, direccion) VALUES (?, ?)", [nombre, direccion]);
    return findById(result.insertId);
};

// Devuelve el residencial actualizado o null si no existe.
const update = async (id, { nombre, direccion }) => {
    await pool.query("UPDATE residenciales SET nombre = ?, direccion = ? WHERE id = ?", [nombre, direccion, id]);
    return findById(id);
};

const remove = async (id) => {
    const [result] = await pool.query("DELETE FROM residenciales WHERE id = ?", [id]);
    return result.affectedRows > 0;
};

module.exports = { findAll, findById, create, update, remove };
