const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const usuariosRepository = require("../usuarios/usuarios.repository");
const { verifyToken } = require("../../middleware/auth");
const { jwtSecret, isProduction, sessionHours } = require("../../config/env");
const { ROLES } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text } = require("../../utils/validators");

const router = express.Router();

const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
};

// Máximo 10 intentos fallidos por IP cada 15 minutos (frena ataques de fuerza bruta).
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }
});

router.post("/login", loginLimiter, async (req, res) => {
    const email = text(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) throw new HttpError(400, "Ingresa correo y contraseña.");

    const user = await usuariosRepository.findForLogin(email);
    const valid = user && await bcrypt.compare(password, user.password);
    if (!valid) throw new HttpError(401, "Correo o contraseña incorrectos.");

    const role = String(user.role_name || "").trim().toUpperCase();
    if (!Object.values(ROLES).includes(role))
        throw new HttpError(403, "Tu rol no tiene acceso a este sistema.");

    const sessionUser = {
        id: user.id, name: user.nombre, email: user.email, role,
        residencial_id: user.residencial_id, residencial_nombre: user.residencial_nombre
    };
    const token = jwt.sign(sessionUser, jwtSecret, { expiresIn: `${sessionHours}h` });
    res.cookie("token", token, { ...cookieOptions, maxAge: sessionHours * 60 * 60 * 1000 });
    res.json({ user: sessionUser });
});

router.post("/logout", (req, res) => {
    res.clearCookie("token", cookieOptions);
    res.json({ signedOut: true });
});

router.get("/me", verifyToken, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
