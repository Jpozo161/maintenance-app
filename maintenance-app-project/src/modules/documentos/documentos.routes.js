const express = require("express");
const repository = require("./documentos.repository");
const service = require("./documentos.service");
const { adminOnly } = require("../../middleware/auth");
const HttpError = require("../../utils/HttpError");
const { positiveId, optionalId } = require("../../utils/validators");
const { paginationFrom } = require("../../utils/pagination");

const router = express.Router();

// Recibe el PDF como binario (no JSON) hasta 20 MB.
const rawFile = express.raw({ type: "application/octet-stream", limit: "20mb" });

const requireDocumentId = (value) => {
    const id = positiveId(value);
    if (!id) throw new HttpError(400, "El documento seleccionado no es válido.");
    return id;
};

const requireMaintenanceId = (value) => {
    const id = positiveId(value);
    if (!id) throw new HttpError(400, "Selecciona un mantenimiento válido.");
    return id;
};

// Historial de documentos guardados; ?mantenimiento_id= filtra los de un mantenimiento.
router.get("/documentos", adminOnly, async (req, res) => {
    const mantenimientoId = optionalId(req.query.mantenimiento_id);
    if (mantenimientoId === undefined) throw new HttpError(400, "El mantenimiento seleccionado no es válido.");
    res.json(await repository.findAll(mantenimientoId, paginationFrom(req.query)));
});

// El body es el PDF, así que el mantenimiento llega en la query: POST /documentos?mantenimiento_id=5
router.post("/documentos", adminOnly, rawFile, async (req, res) => {
    const mantenimientoId = requireMaintenanceId(req.query.mantenimiento_id);
    const saved = await service.save(service.readUploadedFile(req), mantenimientoId, req.user.id);
    res.status(201).json(saved);
});

router.patch("/documentos/:id/mantenimiento", adminOnly, async (req, res) => {
    const id = requireDocumentId(req.params.id);
    const mantenimientoId = requireMaintenanceId(req.body?.mantenimiento_id);
    if (!await repository.maintenanceExists(mantenimientoId))
        throw new HttpError(404, "No existe el mantenimiento seleccionado.");

    let updated;
    try {
        updated = await repository.associate(id, mantenimientoId);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") throw new HttpError(409, "Ese mantenimiento ya tiene este mismo documento.");
        throw error;
    }
    if (!updated) throw new HttpError(404, "No se encontró el documento.");
    res.json({ updated: true, mantenimiento_id: mantenimientoId });
});

// Redirigen a un enlace temporal (5 min) del archivo privado en S3.
router.get("/documentos/:id/ver", adminOnly, async (req, res) => {
    res.redirect(302, await service.signedUrl(requireDocumentId(req.params.id), "inline"));
});

router.get("/documentos/:id/descargar", adminOnly, async (req, res) => {
    res.redirect(302, await service.signedUrl(requireDocumentId(req.params.id), "attachment"));
});

// Archivado lógico: sale de la lista, pero el archivo se conserva en S3.
router.delete("/documentos/:id", adminOnly, async (req, res) => {
    if (!await repository.archive(requireDocumentId(req.params.id)))
        throw new HttpError(404, "No se encontró el documento.");
    res.json({ deleted: true, archived: true });
});

module.exports = router;
