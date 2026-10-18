const { createCanvas, DOMMatrix, ImageData, Path2D } = require("@napi-rs/canvas");
const path = require("path");

const MAX_PDF_PAGES = 25;

function parseAmount(raw) {

    if (!raw) 
        return null;

    let value = raw.replace(
        /[^0-9.,-]/g, ""
    );

    if (value.includes(",") && value.includes(".")) {
        value = value.lastIndexOf(",") > value.lastIndexOf(".")
            ? value.replace(/\./g, "").replace(",", ".")
            : value.replace(/,/g, "");

    } else if (value.includes(",")) {

        value = /,\d{1,2}$/.test(value) ? value.replace(",", ".") : value.replace(/,/g, "");
    } else if ((value.match(/\./g) || []).length > 1) {
        value = value.replace(/\./g, "");
    }
    const amount = Number(value);

    return Number.isFinite(amount) ? amount : null;
}

function parseFields(text) {
    const date = text.match(
        /(?:fecha(?:\s+de\s+(?:emisi[oó]n|factura))?)\s*[:#-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/i);

    const invoiceNumber = text.match(
        /(?:factura|invoice)\s*(?:n(?:[úu]mero|[oº°.]*)?)?\s*[:#-]?\s*([A-Z0-9-]{3,})/i);

    const total = text.match(
        /(?:total(?:\s+(?:a pagar|general))?|monto total|valor total|importe total)\s*[:-]?\s*(?:cop\s*)?\$?\s*([\d][\d., ]*)/i);

    const supplier = text.split(/\r?\n/).map((line) => 
        line.trim()).find(Boolean) ?? null;

    return { 
        supplier, 
        invoiceNumber: invoiceNumber?.[1] ?? null, 
        date: date?.[1] ?? null, 
        total: parseAmount(total?.[1]) 
    };
}

async function createOcrWorker() {

    const { createWorker } = await import("tesseract.js");

    return  createWorker("spa+eng");
    
    
}

async function extractPdfText(buffer, worker) {
    globalThis.DOMMatrix ??= DOMMatrix;

    globalThis.ImageData ??= ImageData;

    globalThis.Path2D ??= Path2D;

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const fontDirectory = `${path.resolve(path.dirname(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")), 
        "../../standard_fonts")}${path.sep}`;
    
    const document = await pdfjs.getDocument({ 
        data: new Uint8Array(buffer), 
        standardFontDataUrl: fontDirectory 
    }).promise;

    if (document.numPages > MAX_PDF_PAGES) {
        throw new Error(`El PDF supera el máximo de ${MAX_PDF_PAGES} páginas.`);
    }

    const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) {
        const page = await document.getPage(number);

        const content = await page.getTextContent();

        const embeddedText = content.items.map((item) => item.str).join(" ").trim();

        if (embeddedText.length > 30) {
            pages.push(embeddedText);
            continue;
        }
        const viewport = page.getViewport({ scale: 2 });

        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        
        const { data } = await worker.recognize(canvas.toBuffer("image/png"));
        pages.push(data.text);
    }
    return pages.join("\n");
}

async function extractInvoice(buffer, filename) {

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) 
        throw new Error("Adjunta un archivo para analizar.");

    const extension = String(filename).toLowerCase().split(".").pop();

    if (!["pdf", "png", "jpg", "jpeg"].includes(extension)) {
        throw new Error("Formato no admitido. Usa PDF, JPG o PNG.");
    }
    const worker = await createOcrWorker();

    try {
        const text = extension === "pdf"
            ? await extractPdfText(buffer, worker)
            : (
                await worker.recognize(buffer)).data.text;
        return { 
            text, 
            fields: parseFields(text) 
        };
    } finally {
        await worker.terminate();
    }
}

module.exports = { 
    extractInvoice 
};
