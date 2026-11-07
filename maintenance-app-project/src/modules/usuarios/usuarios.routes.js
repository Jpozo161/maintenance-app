const express = require("express");
const bcrypt = require("bcrypt");
const repository = require("./usuarios.repository");
const apartamentos = require("../apartamentos/apartamentos.repository");
const { adminOnly, requireRole } = require("../../middleware/auth");
const { ROLES } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text, positiveId, optionalId } = require("../../utils/validators");
const { paginationFrom } = require("../../utils/pagination");
const { notify } = require("../../services/notifications");

const router = express.Router();
const BCRYPT_ROUNDS = 10;

// Un residencial o apartamento que ya no existe es un dato invalido del cliente
// (400), no un fallo del servidor. Sin esto MySQL devolvia ER_NO_REFERENCED_ROW_2
// y terminaba en el errorHandler como 500.
const withForeignKeyMessage = async (message, fn) => {
    try {
        return await fn();
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2")
            throw new HttpError(400, message);
        throw error;
    }
};

// "/propietarios" lista todos los usuarios (no solo propietarios); se mantiene el nombre por el frontend.

// El apartamento es opcional, pero debe pertenecer al residencial del usuario.
const apartamentoFrom = async (value, residencialId) => {
    const apartamentoId = optionalId(value);
    if (apartamentoId === undefined) 
        throw new HttpError(400, "El apartamento seleccionado no es válido.");
    if (!apartamentoId) 
        return null;
    const apartamento = await apartamentos.findById(apartamentoId);
    if (!apartamento || !residencialId || apartamento.residencial_id !== residencialId)
        throw new HttpError(400, "El apartamento seleccionado no pertenece al residencial del usuario.");
    return apartamentoId;
};

router.post("/register", 
    adminOnly, async (req, res) => {

    const nombre = text(req.body?.nombre);
    const email = text(req.body?.email);
    const contrasena = req.body?.contrasena;
    const roleId = positiveId(req.body?.role);
    const residencialId = optionalId(req.body?.residencial_id);

    if (!nombre || !email || typeof contrasena !== "string" || !contrasena || !roleId)
        throw new HttpError(400, "Faltan nombre, correo, contraseña o rol.");
    if (residencialId === undefined)
        throw new HttpError(400, "El residencial seleccionado no es válido.");

    const role = await repository.findRoleById(roleId);
    const roleName = String(role?.nombre || "").toUpperCase();
    if (!roleName) 
        throw new HttpError(400, "Selecciona un rol existente.");

    if ([ROLES.RESIDENTE, ROLES.FRONTDESK].includes(roleName) && !residencialId)
        throw new HttpError(400, "Asigna un residencial a la cuenta residente o de recepción.");

    const apartamentoId = await apartamentoFrom(req.body?.apartamento_id, residencialId);

    const passwordHash = await bcrypt.hash(contrasena, BCRYPT_ROUNDS);

    try {
        const result = await withForeignKeyMessage(
            "El residencial o el apartamento seleccionado ya no existe.",
            () => repository.create({
                nombre,
                email,
                passwordHash,
                roleId,
                residencialId,
                apartamentoId
            }));

        // Best-effort y no bloqueante: notify nunca lanza, asi que un fallo de
        // SES no convierte en error una creacion de usuario que si funciono.
        notify("usuario_creado", {
            nombre,
            email,
            rol: roleName,
            password: `contrasena: ${contrasena}`
        });

        res.status(201).json(result);

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") 
            throw new HttpError(409, "Ya existe un usuario con ese correo.");
        throw error;
    }
});



router.get("/propietarios", adminOnly, async (req, res) => {
    res.json(await repository.findAll(paginationFrom(req.query)));
});

router.put("/propietarios/:id", adminOnly, async (req, res) => {
    const nombre = text(req.body?.nombre);
    const email = text(req.body?.email);
    const roleId = positiveId(req.body?.role_id);
    const residencialId = optionalId(req.body?.residencial_id);

    if (!nombre || !email || !roleId || residencialId === undefined)
        throw new HttpError(400, "Revisa el nombre, correo, tipo de rol y residencial.");
    const apartamentoId = await apartamentoFrom(req.body?.apartamento_id, residencialId);

    const updated = await withForeignKeyMessage(
        "El residencial o el apartamento seleccionado ya no existe.",
        () => repository.update(req.params.id, {
            nombre, email, role_id: roleId, residencial_id: residencialId, apartamento_id: apartamentoId
        }));
    if (!updated) 
        throw new HttpError(404, "No se encontró el usuario.");
    res.json({ updated: true });
});

// No se borra: se desactiva para conservar su historial de pagos.
router.delete("/propietarios/:id", adminOnly, async (req, res) => {
    const deleted = await repository.deactivate(req.params.id);
    if (!deleted) throw new HttpError(404, "No se encontró el usuario.");
    res.json({ deleted: true });
});

router.get("/roles", adminOnly, async (req, res) => {
    res.json(await repository.findRoles());
});

router.get("/tecnicos", adminOnly, async (req, res) => {
    res.json(await repository.findTechnicians());
});

// Residentes de un residencial. Recepción (FRONTDESK) solo puede consultar el suyo.
router.get("/residentes", requireRole(ROLES.FRONTDESK), async (req, res) => {
    const residencialId = req.user.role === ROLES.FRONTDESK
        ? positiveId(req.user.residencial_id)
        : positiveId(req.query.residencial_id);
    if (!residencialId) throw new HttpError(400, "Selecciona un residencial válido.");
    res.json(await repository.findResidents(residencialId));
});

module.exports = router;
