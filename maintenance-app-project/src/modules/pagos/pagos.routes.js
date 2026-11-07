const express = require("express");
const repository = require("./pagos.repository");
const { adminOnly } = require("../../middleware/auth");
const HttpError = require("../../utils/HttpError");
const { text, calendarDate, optionalId } = require("../../utils/validators");
const { paginationFrom } = require("../../utils/pagination");

const router = express.Router();

// El monto se guarda como entero (pesos, sin decimales).
const validMonto = (value) => {
    const monto = Number(value);
    return Number.isInteger(monto) && monto >= 0 ? monto : null;
};

// Número de factura y apartamento son opcionales (null = sin dato).
const detallesFrom = (body) => {
    const numero_factura = text(body?.numero_factura) || null;
    const apartamento_id = optionalId(body?.apartamento_id);
    if (numero_factura?.length > 120)
        throw new HttpError(400, "El número de factura puede tener máximo 120 caracteres.");
    if (apartamento_id === undefined)
        throw new HttpError(400, "El apartamento seleccionado no es válido.");
    return { numero_factura, apartamento_id };
};

const withForeignKeyMessage = async (fn) => {
    try {
        return await fn();
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2")
            throw new HttpError(400, "El apartamento seleccionado ya no existe.");
        throw error;
    }
};

router.get("/pagos", adminOnly, async (req, res) => {
    res.json(await repository.findAll(paginationFrom(req.query)));
});

router.post("/pagos", adminOnly, async (req, res) => {
    const nombre = text(req.body?.nombre);
    const monto = validMonto(req.body?.monto);
    const fechaCreacion = calendarDate(req.body?.fecha_creacion);
    if (!nombre || monto === null || !fechaCreacion)
        throw new HttpError(400, "Ingresa un propietario, monto y fecha válidos.");
    const detalles = detallesFrom(req.body);

    res.status(201).json(await withForeignKeyMessage(
        () => repository.create({ nombre, monto, fechaCreacion, ...detalles })));
});

router.put("/pagos/:id", adminOnly, async (req, res) => {
    const nombre = text(req.body?.nombre);
    const monto = validMonto(req.body?.monto);
    if (!nombre || monto === null)
        throw new HttpError(400, "Ingresa un propietario y un monto válido.");
    const detalles = detallesFrom(req.body);

    const updated = await withForeignKeyMessage(
        () => repository.update(req.params.id, { nombre, monto, ...detalles }));
    if (!updated) throw new HttpError(404, "No se encontró el pago.");
    res.json({ updated: true });
});

router.delete("/pagos/:id", adminOnly, async (req, res) => {
    const deleted = await repository.remove(req.params.id);
    if (!deleted) throw new HttpError(404, "No se encontró el pago.");
    res.json({ deleted: true });
});

module.exports = router;
