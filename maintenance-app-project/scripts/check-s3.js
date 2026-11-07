// Comprueba la conexión con el bucket S3 de documentos usando las variables del .env:
//   npm run s3:check
// Sube un archivo de prueba, lo lee con un enlace firmado y lo borra. No toca los documentos reales.
require("dotenv").config({ quiet: true });
const s3Storage = require("../src/services/s3Storage");

const REQUIRED = ["AWS_REGION", "S3_BUCKET", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
const TEST_KEY = `documentos/_prueba-conexion-${Date.now()}.txt`;
const TEST_BODY = Buffer.from("Prueba de conexión del sistema de mantenimiento.");

const step = async (label, fn) => {
    process.stdout.write(`${label}… `);
    try {
        const result = await fn();
        console.log("OK");
        return result;
    } catch (error) {
        console.log("FALLÓ");
        throw error;
    }
};

const main = async () => {
    const missing = REQUIRED.filter((name) => !process.env[name]);
    if (missing.length) throw new Error(`Faltan variables en el .env: ${missing.join(", ")}`);
    console.log(`Bucket: ${process.env.S3_BUCKET} (${process.env.AWS_REGION})`);

    await step("Subiendo archivo de prueba (PutObject)", () => s3Storage.putObject(TEST_KEY, TEST_BODY, "text/plain"));
    try {
        await step("Leyéndolo con enlace firmado (GetObject)", async () => {
            const response = await fetch(s3Storage.getSignedUrl(TEST_KEY, 60));
            if (!response.ok) throw new Error(`S3 respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
            if (!Buffer.from(await response.arrayBuffer()).equals(TEST_BODY)) throw new Error("El contenido leído no coincide.");
        });
    } finally {
        await step("Borrando archivo de prueba (DeleteObject)", () => s3Storage.deleteObject(TEST_KEY));
    }
    console.log("Conexión con S3 lista: ya se pueden subir documentos.");
};

main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
});
