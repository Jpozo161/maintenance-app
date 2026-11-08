const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { corsOrigin } = require("./config/env");
const routes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// Crea la app sin arrancar el servidor, para poder usarla también en los tests.
const createApp = () => {
    const app = express();

    app.use(helmet());
    
    app.use(cors({ 
        origin: corsOrigin, 
        credentials: true 
    }));

    app.use(express.json());
    app.use(cookieParser());

    // El frontend siempre llama con el prefijo /api. Algunos despliegues lo quitan
    // en el proxy (el rewrite de vite.config.js y el nginx del frontend) y otros lo
    // dejan pasar tal cual (el rewrite de Render), asi que el router se monta en los
    // dos sitios: /api/login y /login llegan ambos al mismo sitio.
    app.use("/api", routes);
    app.use("/", routes);

    app.use(notFound);
    app.use(errorHandler);
    return app;
};

module.exports = { createApp };
