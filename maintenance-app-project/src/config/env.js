// Configuración general de la app. La BD se configura en db.js y S3 en services/s3Storage.js.
require("dotenv").config({ quiet: true });

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
    // Sin esta clave cualquiera podría fabricar un token de ADMIN.
    throw new Error("Falta JWT_SECRET en el archivo .env (ver .env.example).");
}

// NOTIFICATIONS_API_URL es el nombre canonico, el que documenta .env.example.
// APIGATEWAY_URL se sigue aceptando para no romper los .env ya desplegados.
const notificationsUrl =
    process.env.NOTIFICATIONS_API_URL || process.env.APIGATEWAY_URL || "";

// Una invoke URL sin stage ni recurso (solo el host) nunca llega al Lambda:
// API Gateway no encuentra ruta y corta con 403 en el borde. Se avisa una vez al
// arrancar, porque es un error de configuracion y no un fallo puntual de envio.
if (notificationsUrl) {
    try {
        const { pathname } = new URL(notificationsUrl);

        if (pathname === "" || pathname === "/") {
            console.warn(
                "[notificaciones] La URL apunta solo al host, sin la ruta del recurso. " +
                "API Gateway respondera 404 (HTTP API) o 403 (REST API) sin invocar " +
                "el Lambda. Falta el path: .../notifications/email con el stage " +
                "$default de una HTTP API, o .../<stage>/<recurso> en una REST API."
            );
        }
    } catch {
        console.warn(`[notificaciones] La URL configurada no es valida: ${notificationsUrl}`);
    }
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
        url: notificationsUrl,
        apiKey: process.env.NOTIFICATIONS_API_KEY || "",
        recipient: process.env.NOTIFICATIONS_RECIPIENT || "",
        timeoutMs: Number(process.env.NOTIFICATIONS_TIMEOUT_MS) || 5000
    }
};
