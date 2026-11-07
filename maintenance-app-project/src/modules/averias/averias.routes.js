const express = require("express");
const repository = require("./averias.repository");
const { adminOnly, requireRole } = require("../../middleware/auth");
const { ROLES, ESTADOS_AVERIA } = require("../../constants");
const HttpError = require("../../utils/HttpError");
const { text, positiveId, optionalId } = require("../../utils/validators");
const { paginationFrom } = require("../../utils/pagination");
const { notify } = require("../../services/notifications");

const router = express.Router();

// Una avería archivada se trata como inexistente para el usuario.
const findActiveOr404 = async (id) => {
    const averia = await repository.findById(id);

    if (!averia || averia.eliminada_en) 
        throw new HttpError(404, "No se encontró la avería activa.");
    return averia;
};


router.get("/averias", requireRole(ROLES.SUPERVISOR), async (req, res) => {
    res.json(
        await repository.findActive(paginationFrom(req.query)
    ));
});

router.post("/reportaverias", adminOnly, async (req, res) => {
    const descripcion = text(req.body?.descripcion);
    const categoria = text(req.body?.categoria) || null;
    const residencial_id = optionalId(req.body?.residencial_id);
    if (!descripcion || descripcion.length > 400 || residencial_id === undefined || categoria?.length > 100)
        throw new HttpError(400, "Ingresa una descripción (máx. 400 caracteres) y un residencial válido.");

    try {
        const averia = await repository.create({ residencial_id, descripcion, categoria });
        notify("averia_reportada", averia);
        res.status(200).json(averia);
    } catch (error) {
        if (error.code === "ER_NO_REFERENCED_ROW_2") throw new HttpError(404, "No se encontró el residencial.");
        throw error;
    }
});

router.patch("/averias/:id/estado", adminOnly, async (req, res) => {
    const id = positiveId(req.params.id);
    const estado = text(req.body?.estado);
    if (!id || !ESTADOS_AVERIA.includes(estado))
        throw new HttpError(400, "Selecciona una avería y un estado válidos.");

    await findActiveOr404(id);
    await repository.updateEstado(id, estado);
    res.json({ 
        updated: true, estado 
    });
});

// Solo se archivan averías completadas; el reporte original se conserva.
router.delete("/averias/:id", adminOnly, async (req, res) => {

    const id = positiveId(req.params.id);
    if (!id) 
        throw new HttpError(400, "Selecciona una avería válida.");

    const averia = await repository.findById(id);

    if (!averia) 
        throw new HttpError(404, "No se encontró la avería.");

    if (averia.eliminada_en) 
        throw new HttpError(404, "La avería ya fue eliminada de la lista.");

    const archived = averia.estado === "Completada" && await repository.archiveIfCompleted(id);
    if (!archived)
        throw new HttpError(409, "Solo puedes eliminar una avería cuando su estado sea Completada.");

    res.json({ deleted: true, historial_conservado: true });
});

module.exports = router;
