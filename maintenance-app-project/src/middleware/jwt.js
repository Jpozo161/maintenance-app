const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET = process.env.JWT_SECRET || "secret";

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "Inicia sesión para continuar." });

    jwt.verify(token, SECRET, (error, decoded) => {
        if (error) return res.status(401).json({ error: "La sesión expiró. Inicia sesión nuevamente." });
        req.user = decoded;
        next();
    });
};

module.exports = { verifyToken, SECRET };
