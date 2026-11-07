const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { ROLES } = require("../constants");
const usuariosRepository = require("../modules/usuarios/usuarios.repository");
const HttpError = require("../utils/HttpError");

// Lee el token de la cookie y vuelve a cargar el usuario desde la BD,
// así un usuario desactivado o con rol cambiado pierde el acceso al instante.
const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) 
        throw new HttpError(401, "Inicia sesión para continuar.");

    let payload;
    try {
        payload = jwt.verify(token, jwtSecret);
    } catch {
        throw new HttpError(401, "La sesión expiró. Inicia sesión nuevamente.");
    }

    const user = await usuariosRepository.findActiveSessionUser(payload.id);
    if (!user) 
        throw new HttpError(401, "Tu cuenta ya no está activa. Inicia sesión nuevamente.");

    req.user = user;
    next();
};

// ADMIN siempre tiene acceso; los demás roles deben aparecer en la lista.
const requireRole = (...roles) => {
    const allowed = new Set([ROLES.ADMIN, ...roles]);

    const middleware = (req, res, next) => { 
        if (!allowed.has(req.user?.role)) 
            throw new HttpError(403, "No tienes permiso para acceder a esta sección.");
        next();
    };
    middleware.allowedRoles = [...allowed]; // usado por tests/permisos.test.js
    return middleware;
};

const adminOnly = requireRole();

module.exports = { verifyToken, requireRole, adminOnly };
