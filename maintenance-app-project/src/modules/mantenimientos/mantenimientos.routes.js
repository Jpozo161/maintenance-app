const express = require("express");
const repository = require("./mantenimientos.repository");
const { adminOnly, requireRole } = require("../../middleware/auth");
const { ROLES, ESTADOS_MANTENIMIENTO, OPCIONES_MESES_SIGUIENTE } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text, positiveId, optionalId, calendarDate } = require("../../utils/validators");
const { paginationFrom } = require("../../utils/pagination");
const { notify } = require("../../services/notifications");

const router = express.Router();

// Un técnico solo ve los mantenimientos que tiene asignados.
const technicianFilter = (user) => (
    user.role === ROLES.TECNICO ? user.id : null
);

// Traduce errores de llave foránea a un mensaje claro.
const withForeignKeyMessage = async (message, fn) => {
    try {
        return await fn();
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2") 
            throw new HttpError(400, message);
        throw error;
    }
};

const requireMaintenanceId = (value, message) => {
    const id = positiveId(value);
    if (!id) throw new HttpError(400, message);
    return id;
};

// ?vista=activos | historial filtra por estado; sin vista devuelve todos.
const VISTAS_VALIDAS = ["activos", "historial"];

router.get("/mantenimiento", requireRole(ROLES.TECNICO), async (req, res) => {
    const vista = req.query.vista ?? null;

    if (vista !== null && !VISTAS_VALIDAS.includes(vista))
        throw new HttpError(400, "La vista de mantenimientos no es válida.");

    res.json(await repository.findAll(technicianFilter(req.user), 
     paginationFrom(req.query
    ), vista));
});

router.get("/nextmaintenance", requireRole(ROLES.TECNICO), async (req, res) => {
    res.json(await repository.findUpcoming(technicianFilter(req.user)));
});

router.get("/estados-mantenimiento", adminOnly, async (req, res) => {
    res.json(await repository.findStatuses());
});

router.post("/maintenance", adminOnly, async (req, res) => {
    const tipo = text(req.body?.tipo);
    const descripcion = text(req.body?.descripcion);
    const fecha_programada = calendarDate(req.body?.fecha_programada);
    const residencial_id = positiveId(req.body?.residencial_id);

    if (!tipo || !descripcion || !residencial_id || !fecha_programada)
        throw new HttpError(400, "Ingresa actividad, descripción, propiedad y una fecha límite válidas."
    );

    const maintenance = { tipo, descripcion, fecha_programada, residencial_id };
    const id = await withForeignKeyMessage("La propiedad seleccionada ya no existe.",
        () => repository.create(maintenance));
        
    notify("mantenimiento_programado", { id, ...maintenance });
    res.status(201).json({ id, ...maintenance });
});

// Crea un mantenimiento nuevo (estado programado) a partir de uno completado o cancelado.
// El original no se modifica; cada mantenimiento cerrado origina como máximo uno siguiente.
router.post("/mantenimiento/:id/siguiente", adminOnly, async (req, res) => {
    const id = requireMaintenanceId(req.params.id, "El mantenimiento seleccionado no es válido.");
    const meses = Number(req.body?.meses);
    if (!OPCIONES_MESES_SIGUIENTE.includes(meses))
        throw new HttpError(400, `Selecciona cada cuánto será el próximo mantenimiento: ${OPCIONES_MESES_SIGUIENTE.join(", ")} meses.`);

    let created;
    try {
        created = await repository.createNext(id, meses);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY")
            throw new HttpError(409, "Este mantenimiento ya tiene programado su próximo mantenimiento.");
        throw error;
    }
    if (!created)
        throw new HttpError(404, "No se encontró un mantenimiento completado o cancelado con ese identificador.");
    res.status(201).json({ ...created, mantenimiento_origen_id: id, meses_agregados: meses });
});

router.patch("/mantenimiento/:id/estado", adminOnly, async (req, res) => {
    const id = positiveId(req.params.id);
    const estado_id = positiveId(req.body?.estado_id);
    if (!id || !Object.values(ESTADOS_MANTENIMIENTO).includes(estado_id))
        throw new HttpError(400, "Selecciona un mantenimiento y un estado válidos.");

    const updated = await withForeignKeyMessage("El estado seleccionado no existe.",
        () => repository.updateStatus(id, estado_id));
    if (!updated)
         throw new HttpError(404, "No se encontró el mantenimiento.");
    res.json({ updated: true, estado_id });
});

router.patch("/mantenimiento/:id/propiedad", adminOnly, async (req, res) => {
    const id = positiveId(req.params.id);
    const residencial_id = positiveId(req.body?.residencial_id);
    if (!id || !residencial_id)
        throw new HttpError(400, "Selecciona un mantenimiento y una propiedad válidos.");

    const updated = await withForeignKeyMessage("La propiedad seleccionada ya no existe.",
        () => repository.updateProperty(id, residencial_id));
    if (!updated) 
        throw new HttpError(404, "No se encontró el mantenimiento.");
    res.json({ updated: true, residencial_id });
});

// tecnico_id null = dejar el mantenimiento sin técnico.
router.patch("/mantenimiento/:id/tecnico", adminOnly, async (req, res) => {
    const id = positiveId(req.params.id);
    const tecnico_id = optionalId(req.body?.tecnico_id);
    if (!id || tecnico_id === undefined)
        throw new HttpError(400, "Selecciona un mantenimiento y un técnico válidos.");

    const updated = await withForeignKeyMessage("El técnico seleccionado ya no existe.",
        () => repository.updateTechnician(id, tecnico_id));
    if (!updated) 
        throw new HttpError(404, "No se encontró el mantenimiento.");
    res.json({ updated: true, tecnico_id });
});

router.delete("/mantenimiento/:id", adminOnly, async (req, res) => {
    const id = requireMaintenanceId(req.params.id, "El mantenimiento seleccionado no es válido.");
    if (!await repository.archive(id)) 
        throw new HttpError(404, "No se encontró el mantenimiento.");
    res.json({ deleted: true, archived: true });
});

module.exports = router;
