// Configuración general de la app. La BD se configura en db.js y S3 en services/s3Storage.js.
require("dotenv").config({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
    // Sin esta clave cualquiera podría fabricar un token de ADMIN.
    throw new Error("Falta JWT_SECRET en el archivo .env (ver .env.example).");
}

module.exports = {
    isProduction,
    port: Number(process.env.PORT) || 3000,
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
    timeZone: process.env.APP_TIME_ZONE || "America/Bogota",
    jwtSecret: process.env.JWT_SECRET,
    sessionHours: 2,

    // Notificaciones por correo (API Gateway -> Lambda -> SES).
    // Sin url no se envia nada y la app sigue funcionando con normalidad.
    notifications: {
        url: process.env.APIGATEWAY_URL|| "",
        apiKey: process.env.NOTIFICATIONS_API_KEY || "",
        recipient: process.env.NOTIFICATIONS_RECIPIENT || "",
        timeoutMs: Number(process.env.NOTIFICATIONS_TIMEOUT_MS) || 5000
    }
};
