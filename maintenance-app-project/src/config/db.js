require("dotenv").config({ quiet: true });
const mysql = require("mysql2/promise");

// Se aceptan los dos convenios de nombres: DB_HOST/DB_USER/... (el habitual en
// hostings como Render) y host/user/... en minuscula (el que usa el .env local).
// Asi la misma imagen sirve en los dos sitios sin renombrar variables.
const dbConfig = {
    host: process.env.DB_HOST || process.env.host || "localhost",
    port: Number(process.env.DB_PORT || process.env.port) || 17026,
    user: process.env.DB_USER || process.env.user || "root",
    password: process.env.DB_PASSWORD || process.env.password,
    database: process.env.DB_NAME || process.env.database || "mantenimiento"
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
