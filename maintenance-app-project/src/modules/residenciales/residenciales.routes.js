const express = require("express");
const repository = require("./residenciales.repository");
const { adminOnly } = require("../../middleware/auth");
const HttpError = require("../../utils/HttpError");
const { text } = require("../../utils/validators");

const router = express.Router();

// La dirección es opcional (null = sin dirección).
const residencialFrom = (body) => {
    const nombre = text(body?.nombre);
    const direccion = text(body?.direccion) || null;
    if (!nombre) throw new HttpError(400, "El nombre del residencial es obligatorio.");
    if (direccion?.length > 255) throw new HttpError(400, "La dirección puede tener máximo 255 caracteres.");
    return { nombre, direccion };
};

router.get("/residenciales", adminOnly, async (req, res) => {
    res.json(await repository.findAll());
});

router.post("/residenciales", adminOnly, async (req, res) => {
    res.status(201).json(await repository.create(residencialFrom(req.body)));
});

router.put("/residenciales/:id", adminOnly, async (req, res) => {
    const item = await repository.update(req.params.id, residencialFrom(req.body));
    if (!item) throw new HttpError(404, "No se encontró el residencial.");
    res.json(item);
});

router.delete("/residenciales/:id", adminOnly, async (req, res) => {
    try {
        const deleted = await repository.remove(req.params.id);
        if (!deleted) throw new HttpError(404, "No se encontró el residencial.");
        res.json({ deleted: true });
    } catch (error) {
        // Tiene usuarios, apartamentos, áreas o averías asociadas: MySQL bloquea el borrado.
        if (error.code === "ER_ROW_IS_REFERENCED_2")
            throw new HttpError(409, "No se puede eliminar: el residencial tiene registros asociados.");
        throw error;
    }
});

module.exports = router;
