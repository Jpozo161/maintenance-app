require("dotenv").config({ quiet: true });
const mysql = require("mysql2/promise");

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: "root",
    password: "12345678",
    database: process.env.DB_NAME || "mantenimiento"
};

// Pool: varias consultas a la vez y reconexión automática si MySQL cierra una conexión.
const pool = mysql.createPool({ ...dbConfig, connectionLimit: 10 });

// Ejecuta fn dentro de una transacción; si fn lanza un error, se deshace todo.
const withTransaction = async (fn) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const result = await fn(connection);

        await connection.commit();

        return result;
    } catch (error) {
        await connection.rollback();
        
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = { pool, withTransaction, dbConfig };
