const express = require("express");
const repository = require("./areasSociales.repository");
const reservasRepository = require("../reservas/reservas.repository");
const { calcularHorarios } = require("./disponibilidad");
const { adminOnly, requireRole } = require("../../middleware/auth");
const { ROLES } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text, positiveId, isoDateFormat } = require("../../utils/validators");
const { timeToMinutes, localToday } = require("../../utils/time");

const router = express.Router();

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const withSeconds = (time) => (time.length === 5 ? `${time}:00` : time);

// Valida el body de crear/editar un área. Intervalos de 15 min a 12 h.
const parseArea = (body) => {
    const residencial_id = positiveId(body?.residencial_id);
    const nombre = text(body?.nombre);
    const hora_apertura = typeof body?.hora_apertura === "string" ? body.hora_apertura : "";
    const hora_cierre = typeof body?.hora_cierre === "string" ? body.hora_cierre : "";
    const intervalo_minutos = Number(body?.intervalo_minutos);


    const valid = residencial_id && nombre && nombre.length <= 150 &&
        TIME_PATTERN.test(hora_apertura) && TIME_PATTERN.test(hora_cierre) &&
        timeToMinutes(hora_cierre) > timeToMinutes(hora_apertura) &&
        Number.isInteger(intervalo_minutos) && intervalo_minutos >= 15 && intervalo_minutos <= 720;
    if (!valid) 
        throw new HttpError(400, "Revisa el nombre, residencial y horario del área.");

    return {
        residencial_id,
        nombre,
        descripcion: text(body?.descripcion) || null,
        hora_apertura: withSeconds(hora_apertura),
        hora_cierre: withSeconds(hora_cierre),
        intervalo_minutos,
        activa: body?.activa === false || Number(body?.activa) === 0 ? 0 : 1
    };
};

const duplicateNameMessage = async (fn) => {
    try {
        return await fn();
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") 
            throw new HttpError(409, "Ya existe un área con ese nombre en el residencial.");
        throw error;
    }
};

// Un residente solo ve las áreas activas de su propio residencial.
router.get("/areas-sociales", requireRole(ROLES.RESIDENTE), async (req, res) => {
    const isResident = req.user.role === ROLES.RESIDENTE;
    if (isResident && !req.user.residencial_id)
        throw new HttpError(403, "Tu cuenta no tiene un residencial asignado.");

    res.json(await repository.findAll(isResident
        ? { residencialId: req.user.residencial_id, soloActivas: true }
        : {}));
});

router.post("/areas-sociales", adminOnly, async (req, res) => {
    const area = parseArea(req.body);
    res.status(201).json(await duplicateNameMessage(() => repository.create(area)));
});

router.put("/areas-sociales/:id", adminOnly, async (req, res) => {
    const area = parseArea(req.body);
    const updated = await duplicateNameMessage(() => repository.update(req.params.id, area));
    if (!updated) throw new HttpError(404, "No se encontró el área social.");
    res.json(updated);
});

router.get("/areas-sociales/:id/disponibilidad", requireRole(ROLES.RESIDENTE), async (req, res) => {
    const fecha = req.query.fecha;
    if (!isoDateFormat(fecha) || fecha < localToday())
        throw new HttpError(400, "Selecciona una fecha válida a partir de hoy.");

    const area = await repository.findById(req.params.id);
    const otherResidential = req.user.role === ROLES.RESIDENTE &&
        Number(area?.residencial_id) !== Number(req.user.residencial_id);
    if (!area || !area.activa || otherResidential)
        throw new HttpError(404, "El área no está disponible para tu residencial.");

    const reservas = await reservasRepository.findActiveForDate(area.id, fecha);
    res.json({ 
        area_id: area.id, 
        fecha, 
        slots: calcularHorarios(area, fecha, reservas) 
    });
});

module.exports = router;
