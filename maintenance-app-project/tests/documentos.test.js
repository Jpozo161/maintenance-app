// Validación de los PDF que se suben como documentos de mantenimiento (sin BD ni S3).
process.env.JWT_SECRET ||= "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readUploadedFile, contentDisposition } = require("../src/modules/documentos/documentos.service");

const PDF = Buffer.from("%PDF-1.7\n%prueba\n");

// Simula la petición de express.raw con las cabeceras X-File-*.
const request = (body, headers = {}) => ({
    body,
    get: (name) => ({ "X-File-Name": "acta.pdf", "X-File-Type": "application/pdf", ...headers })[name]
});

const rejects = (req, status) => assert.throws(() => readUploadedFile(req), (error) => error.status === status);

test("acepta un PDF y calcula su clave en S3 a partir del sha256", () => {
    const file = readUploadedFile(request(PDF, { "X-File-Name": encodeURIComponent("Informe técnico.pdf") }));
    assert.equal(file.filename, "Informe técnico.pdf");
    assert.equal(file.contentType, "application/pdf");
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.equal(file.objectKey, `documentos/${file.sha256.slice(0, 2)}/${file.sha256}.pdf`);
});

test("rechaza archivos que no son PDF aunque cambien la extensión o el tipo", () => {
    rejects(request(Buffer.from("\x89PNG...")), 400);
    rejects(request(PDF, { "X-File-Name": "foto.png" }), 400);
    rejects(request(PDF, { "X-File-Type": "image/png" }), 400);
});

test("rechaza cuerpos vacíos y nombres inválidos", () => {
    rejects(request(Buffer.alloc(0)), 400);
    rejects(request("no es binario"), 400);
    rejects(request(PDF, { "X-File-Name": "" }), 400);
    rejects(request(PDF, { "X-File-Name": "%E0%A4%A" }), 400);
});

test("Content-Disposition conserva el nombre original con tildes", () => {
    assert.equal(
        contentDisposition("attachment", "Acta de revisión.pdf"),
        "attachment; filename=\"Acta de revision.pdf\"; filename*=UTF-8''Acta%20de%20revisi%C3%B3n.pdf"
    );
    assert.match(contentDisposition("inline", "a\"b.pdf"), /^inline; filename="ab.pdf";/);
});
