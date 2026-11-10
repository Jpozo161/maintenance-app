const crypto = require("crypto");
const repository = require("./documentos.repository");
const s3Storage = require("../../services/s3Storage");
const HttpError = require("../../utils/HttpError");

const MAX_BYTES = 20 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const PDF_SIGNATURE = Buffer.from("%PDF-");

const requireS3 = () => {
    if (!s3Storage.isConfigured())
        throw new HttpError(503, "El almacenamiento de documentos no está configurado. Faltan AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY en el .env.");
};

// El frontend envía el PDF crudo en el body y el nombre/tipo en cabeceras X-File-*.
const readUploadedFile = (req) => {
    const buffer = req.body;

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) 
        throw new HttpError(400, "Adjunta un archivo PDF.");
    if (buffer.length > MAX_BYTES) 
        throw new HttpError(413, "El archivo supera el límite de 20 MB.");

    let filename;

    try {
        filename = decodeURIComponent(req.get("X-File-Name") || "");
    } catch {
        filename = "";
    }
    if (!filename || filename.length > 255) 
        throw new HttpError(400, "El nombre del archivo no es válido.");

    // Se valida la extensión, el tipo declarado y el contenido real (los PDF empiezan por "%PDF-").
    const isPdfName = filename.toLowerCase().endsWith(".pdf");

    const contentType = req.get("X-File-Type") || PDF_MIME;
    
    if (!isPdfName || contentType !== PDF_MIME || !buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE))
        throw new HttpError(400, "Solo se permiten archivos PDF.");

    // El hash identifica el archivo: en S3 se guarda una sola copia aunque se asocie a varios mantenimientos.
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    return { buffer, filename, contentType, sha256, objectKey: `documentos/${sha256.slice(0, 2)}/${sha256}.pdf` };
};

// Guarda el PDF en S3 y sus metadatos en la BD. Si la BD falla y el archivo era nuevo, lo borra de S3.
const save = async (file, mantenimientoId, userId) => {
    requireS3();
    if (!await repository.maintenanceExists(mantenimientoId))
        throw new HttpError(404, "No existe el mantenimiento seleccionado.");

    const alreadyStored = await repository.existsByHash(file.sha256);
    if (!alreadyStored) {
        try {
            await s3Storage.putObject(file.objectKey, file.buffer, file.contentType);
        } catch (error) {
            console.error("Falló la subida a S3:", error.message);
            throw new HttpError(502, "No se pudo guardar el archivo en el almacenamiento. Intenta de nuevo.");
        }
    }

    try {
        const id = await repository.create({
            mantenimiento_id: mantenimientoId,
            nombre_original: file.filename,
            tipo_mime: file.contentType,
            tamano_bytes: file.buffer.length,
            s3_object_key: file.objectKey,
            sha256: file.sha256,
            subido_por: userId
        });
        return { id, mantenimiento_id: mantenimientoId, nombre_original: file.filename };
    } catch (error) {
        // El objeto S3 puede estar en uso por otro documento: solo se borra si se subió en esta petición.
        if (!alreadyStored && !await repository.existsByHash(file.sha256)) {
            await s3Storage.deleteObject(file.objectKey).catch((cleanupError) =>
                console.error("No se pudo eliminar el objeto S3 después de fallar la base de datos:", cleanupError.message));
        }
        if (error.code === "ER_DUP_ENTRY") 
            throw new HttpError(409, "Este documento ya está asociado a ese mantenimiento.");
        throw error;
    }
};

// Cabecera Content-Disposition con el nombre original (versión ASCII + UTF-8 para tildes y ñ).
const contentDisposition = (type, filename) => {
    const ascii = filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "documento.pdf";
    return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

// Enlace temporal (5 min) al archivo privado: "inline" lo abre en el navegador y "attachment" lo descarga.
const signedUrl = async (id, type) => {
    requireS3();
    const document = await repository.findById(id);
    if (!document) 
        throw new HttpError(404, "No se encontró el documento.");
    return s3Storage.getSignedUrl(document.s3_object_key, 300, {
        contentType: document.tipo_mime,
        contentDisposition: contentDisposition(type, document.nombre_original)
    });
};

module.exports = { readUploadedFile, save, signedUrl, contentDisposition };
