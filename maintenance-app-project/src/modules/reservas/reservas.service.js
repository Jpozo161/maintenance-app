const repository = require("./reservas.repository");
const areasRepository = require("../areasSociales/areasSociales.repository");
const usuariosRepository = require("../usuarios/usuarios.repository");
const { calcularHorarios } = require("../areasSociales/disponibilidad");
const { withTransaction } = require("../../config/db");
const { ESTADOS_RESERVA } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { timeToMinutes } = require("../../utils/time");

// Todo ocurre en una transacción con el área bloqueada: si dos residentes piden
// el mismo horario a la vez, el segundo espera y luego ve el horario ocupado.
// residenteId: residente para el que reserva el administrador (null = el propio usuario).
// La solicitud de un residente queda PENDIENTE; la que crea el administrador queda APROBADA.
const crear = ({ user, residenteId = null, areaId, fecha, hora_inicio, hora_fin }) => withTransaction(async (connection) => {
    let titular = user;
    if (residenteId != null) {
        titular = await usuariosRepository.findActiveResident(residenteId);
        if (!titular) throw new HttpError(400, "El residente seleccionado no existe o no está activo.");
    }

    const area = await areasRepository.findByIdForUpdate(areaId, connection);
    if (!area || !area.activa || Number(area.residencial_id) !== Number(titular.residencial_id))
        throw new HttpError(404, "El área no está disponible para el residencial del residente.");

    const reservas = await repository.findActiveForDate(area.id, fecha, null, connection);
    const horarioLibre = calcularHorarios(area, fecha, reservas).some((slot) =>
        slot.disponible && slot.hora_inicio === hora_inicio && slot.hora_fin === hora_fin);
    if (!horarioLibre)
        throw new HttpError(409, "Ese horario ya no está disponible. Actualiza la disponibilidad.");

    const id = await repository.create({
        area_id: area.id, usuario_id: titular.id, fecha, hora_inicio, hora_fin,
        estado: residenteId != null ? ESTADOS_RESERVA.APROBADA : ESTADOS_RESERVA.PENDIENTE
    }, connection);
    return repository.findWithDetails(id, connection);
});

// Aprobar vuelve a comprobar que el horario siga libre; rechazar no necesita validación.
const revisar = (id, estado) => withTransaction(async (connection) => {
    
    const reserva = await repository.findByIdForUpdate(id, connection);
    if (!reserva) 
        throw new HttpError(404, "No se encontró la solicitud.");
    if (reserva.estado !== ESTADOS_RESERVA.PENDIENTE)
         throw new HttpError(409, "Esta solicitud ya fue revisada.");

    if (estado === ESTADOS_RESERVA.APROBADA) {
        const area = await areasRepository.findByIdForUpdate(reserva.area_id, connection);
        if (!area) 
            throw new HttpError(500, "No se pudo validar el horario del área.");

        const otras = await repository.findActiveForDate(area.id, reserva.fecha, reserva.id, connection);
        const inicio = timeToMinutes(reserva.hora_inicio);
        const fin = timeToMinutes(reserva.hora_fin);
        const conflicto = calcularHorarios(area, reserva.fecha, otras).some((slot) =>
            !slot.disponible && timeToMinutes(slot.hora_inicio) < fin && timeToMinutes(slot.hora_fin) > inicio);
        if (conflicto) throw new HttpError(409, "El horario ya fue ocupado por otra solicitud.");
    }

    return repository.updateEstado(id, estado, connection);
});

module.exports = { crear, revisar };
