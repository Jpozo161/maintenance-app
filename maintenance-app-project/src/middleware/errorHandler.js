const HttpError = require("../utils/HttpError");

const notFound = (req, res) => {
    res.status(404).json({ error: "La ruta solicitada no existe." });
};

// Último middleware: todos los errores terminan aquí.
// Los HttpError se muestran tal cual; el resto se registra y se oculta al cliente.
// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
    if (error instanceof HttpError) {
        return res.status(error.status).json({ error: error.message });
    }
    // Errores de express (JSON mal formado, archivo demasiado grande, etc.).
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
    }
    if (error.type === "entity.too.large") {
        return res.status(413).json({ error: "El archivo supera el límite de 20 MB." });
    }

    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, error);
    res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo." });
};

module.exports = { notFound, errorHandler };
