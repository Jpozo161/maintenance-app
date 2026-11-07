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

    app.use("/", routes);

    app.use(notFound);
    app.use(errorHandler);
    return app;
};

module.exports = { createApp };
