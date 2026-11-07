const express = require("express");
const repository = require("./visitas.repository");
const apartamentosRepository = require("../apartamentos/apartamentos.repository");
const { requireRole } = require("../../middleware/auth");
const { ROLES, TIPOS_DOCUMENTO } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text, positiveId, calendarDate } = require("../../utils/validators");
const { paginationFrom } = require("../../utils/pagination");
const { notify } = require("../../services/notifications");

const router = express.Router();

// "YYYY-MM-DDTHH:MM" (input datetime-local) en hora de Bogotá -> "YYYY-MM-DD HH:MM:00" para MySQL.
const visitDateTime = (value) => {
    const match = typeof value === "string" && value.match(/^(\d{4}-\d{2}-\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match || !calendarDate(match[1])) 
        return null;
    return `${match[1]} ${match[2]}:${match[3]}:00`;
};

// Residente: las que registró y las de su apartamento. Recepción: las de su residencial. Administrador: todas.
const scopeFor = (user) => {
    if (user.role === ROLES.RESIDENTE) 
        return { residenteId: user.id, apartamentoId: user.apartamento_id ?? null };

    if (user.role === ROLES.FRONTDESK) {
        if (!user.residencial_id) 
            throw new HttpError(403, "Tu cuenta no tiene un residencial asignado.");
        return { 
            residencialId: user.residencial_id 
        };
    }
    return {};
};

// La visita va a un apartamento del residencial. Un residente la registra a su apartamento;
// recepción y administrador eligen el apartamento.
const resolveDestination = async (user, body) => {
    if (user.role === ROLES.RESIDENTE) {
        if (!user.residencial_id) 
            throw new HttpError(403, "Tu cuenta no tiene un residencial asignado.");
        return { apartamento_id: user.apartamento_id ?? null, residente_id: user.id, residencial_id: user.residencial_id };
    }

    const residencialId = user.role === ROLES.FRONTDESK
        ? positiveId(user.residencial_id)
        : positiveId(body?.residencial_id);
    const apartamentoId = positiveId(body?.apartamento_id);

    if (!residencialId || !apartamentoId)
        throw new HttpError(400, "Selecciona el residencial y el apartamento que recibe la visita.");

    const apartamento = await apartamentosRepository.findById(apartamentoId);

    if (!apartamento || Number(apartamento.residencial_id) !== Number(residencialId))
        throw new HttpError(400, "El apartamento seleccionado no pertenece a ese residencial.");
    
    return { apartamento_id: apartamento.id, residente_id: null, residencial_id: residencialId };
};

router.get("/visitas", requireRole(ROLES.RESIDENTE, ROLES.FRONTDESK), async (req, res) => {
    res.json(await repository.findAll(scopeFor(req.user), paginationFrom(req.query)));
});

router.post("/visitas", requireRole(ROLES.RESIDENTE, ROLES.FRONTDESK), async (req, res) => {
    const nombre_visitante = text(req.body?.nombre_visitante);
    const tipo_documento = String(req.body?.tipo_documento || "").toUpperCase();
    const numero_documento = text(req.body?.numero_documento);
    const motivo = text(req.body?.motivo);
    const fecha_visita = visitDateTime(req.body?.fecha_visita);

    if (!nombre_visitante || nombre_visitante.length > 200 ||
        !TIPOS_DOCUMENTO.includes(tipo_documento) ||
        !numero_documento || numero_documento.length > 50 ||
        !motivo || motivo.length > 255 || !fecha_visita)
        throw new HttpError(400, "Ingresa nombre, tipo y número de documento, fecha y hora y motivo de la visita.");

    const destino = await resolveDestination(req.user, req.body);
    const id = await repository.create({
        ...destino,
        registrado_por: req.user.id,
        nombre_visitante,
        tipo_documento,
        numero_documento,
        motivo,
        fecha_visita
    });
    const visita = await repository.findWithDetails(id);
    notify("visita_registrada", visita);
    res.status(201).json(visita);
});

module.exports = router;
