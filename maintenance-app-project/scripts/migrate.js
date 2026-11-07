// Aplica en orden los archivos migrations/NNN_nombre.sql que aún no se han ejecutado.
//   npm run migrate            -> ejecuta las migraciones pendientes
//   npm run migrate:baseline   -> marca todas como aplicadas sin ejecutarlas
//                                 (usar una sola vez en una BD que ya tiene el esquema)
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { dbConfig } = require("../src/config/db");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const baselineOnly = process.argv.includes("--baseline");

const main = async () => {
    const connection = await mysql.createConnection({ ...dbConfig, multipleStatements: true });
    try {
        await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            nombre VARCHAR(255) NOT NULL PRIMARY KEY,
            aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`);

        const [rows] = await connection.query("SELECT nombre FROM schema_migrations");
        const applied = new Set(rows.map((row) => row.nombre));
        const pending = fs.readdirSync(MIGRATIONS_DIR)
            .filter((file) => /^\d+_.+\.sql$/.test(file) && !applied.has(file))
            .sort();

        if (!pending.length) 
            return console.log("No hay migraciones pendientes.");

        for (const file of pending) {
            if (!baselineOnly) {
                console.log(`Aplicando ${file}...`);
                await connection.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
            }
            await connection.query("INSERT INTO schema_migrations (nombre) VALUES (?)", [file]);
        }
        console.log(baselineOnly
            ? `Marcadas como aplicadas: ${pending.join(", ")}`
            : `Listo: ${pending.length} migración(es) aplicada(s).`);
    } finally {
        await connection.end();
    }
};

main().catch((error) => {
    console.error("Error en la migración:", error.message);
    process.exit(1);
});
