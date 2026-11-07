const express = require("express");
const repository = require("./reservas.repository");
const service = require("./reservas.service");
const { adminOnly, requireRole } = require("../../middleware/auth");
const { ROLES, ESTADOS_RESERVA } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { positiveId, isoDateFormat } = require("../../utils/validators");
const { localToday } = require("../../utils/time");
const { paginationFrom } = require("../../utils/pagination");
const { notify } = require("../../services/notifications");

const router = express.Router();

// Un residente solo ve sus propias reservas; el administrador ve todas.
router.get("/reservas", requireRole(ROLES.RESIDENTE), async (req, res) => {
    const userId = req.user.role === ROLES.RESIDENTE ? req.user.id : null;
    res.json(await repository.findAll(userId, paginationFrom(req.query)));
});

router.post("/reservas", requireRole(ROLES.RESIDENTE), async (req, res) => {
    const areaId = positiveId(req.body?.area_id);
    const fecha = req.body?.fecha;
    if (!areaId || !isoDateFormat(fecha) || fecha < localToday())
        throw new HttpError(400, "Selecciona un área y una fecha válida.");

    // El administrador reserva a nombre de un residente; la reserva nunca queda a su nombre.
    const residenteId = req.user.role === ROLES.RESIDENTE ? null : positiveId(req.body?.usuario_id);
    if (req.user.role !== ROLES.RESIDENTE && !residenteId)
        throw new HttpError(400, "Selecciona el residente para el que se hace la reserva.");

    const reserva = await service.crear({
        user: req.user,
        residenteId,
        areaId,
        fecha,
        hora_inicio: String(req.body?.hora_inicio ?? ""),
        hora_fin: String(req.body?.hora_fin ?? "")
    });
    notify("reserva_creada", reserva);
    res.status(201).json(reserva);
});

router.patch("/reservas/:id", adminOnly, async (req, res) => {
    const estado = String(req.body?.estado || "").toUpperCase();
    if (![ESTADOS_RESERVA.APROBADA, ESTADOS_RESERVA.RECHAZADA].includes(estado))
        throw new HttpError(400, "La solicitud debe aprobarse o rechazarse.");

    res.json({ updated: await service.revisar(req.params.id, estado) });
});

module.exports = router;
