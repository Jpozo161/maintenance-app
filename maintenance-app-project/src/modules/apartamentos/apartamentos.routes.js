const express = require("express");
const repository = require("./apartamentos.repository");
const { adminOnly, requireRole } = require("../../middleware/auth");
const { ROLES, TIPOS_APARTAMENTO } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text, positiveId, optionalId } = require("../../utils/validators");

const router = express.Router();

const apartamentoFrom = (body) => {
    const residencial_id = positiveId(body?.residencial_id);
    const nombre = text(body?.nombre);
    const tipo = text(body?.tipo);
    if (!residencial_id || !nombre || nombre.length > 100 || !TIPOS_APARTAMENTO.includes(tipo))
        throw new HttpError(400, `Ingresa residencial, nombre o número y un tipo válido (${TIPOS_APARTAMENTO.join(" o ")}).`);
    return { residencial_id, nombre, tipo };
};

// Traduce errores de llave foránea a un mensaje claro.
const withForeignKeyMessage = async (fn) => {
    try {
        return await fn();
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2")
            throw new HttpError(400, "El residencial seleccionado ya no existe.");
        throw error;
    }
};

// ?residencial_id= filtra por residencial. Recepción (FRONTDESK) solo ve los de su residencial (para visitas).
router.get("/apartamentos", requireRole(ROLES.FRONTDESK), async (req, res) => {
    const residencialId = req.user.role === ROLES.FRONTDESK
        ? positiveId(req.user.residencial_id)
        : optionalId(req.query.residencial_id);
    if (residencialId === undefined || (req.user.role === ROLES.FRONTDESK && !residencialId))
        throw new HttpError(400, "El residencial seleccionado no es válido.");
    res.json(await repository.findAll(residencialId));
});

router.post("/apartamentos", adminOnly, async (req, res) => {
    const apartamento = apartamentoFrom(req.body);
    res.status(201).json(await withForeignKeyMessage(() => repository.create(apartamento)));
});

router.put("/apartamentos/:id", adminOnly, async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) throw new HttpError(400, "El apartamento seleccionado no es válido.");
    const apartamento = apartamentoFrom(req.body);
    const item = await withForeignKeyMessage(() => repository.update(id, apartamento));
    if (!item) throw new HttpError(404, "No se encontró el apartamento.");
    res.json(item);
});

router.delete("/apartamentos/:id", adminOnly, async (req, res) => {
    try {
        const deleted = await repository.remove(req.params.id);
        if (!deleted) throw new HttpError(404, "No se encontró el apartamento.");
        res.json({ deleted: true });
    } catch (error) {
        // Tiene usuarios, pagos o equipos asociados: MySQL bloquea el borrado.
        if (error.code === "ER_ROW_IS_REFERENCED_2")
            throw new HttpError(409, "No se puede eliminar: el apartamento tiene usuarios, pagos o equipos asociados.");
        throw error;
    }
});

module.exports = router;
