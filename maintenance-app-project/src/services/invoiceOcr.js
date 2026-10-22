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
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const match = (pattern) => text.match(pattern)?.[1]?.trim() ?? null;
    const amountFor = (pattern) => parseAmount(match(pattern));
    const datePattern = "(\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2})";
    const labeled = (label) => new RegExp(`(?:${label})\\s*[:#-]?\\s*([^\\n\\r]+)`, "i");
    const invoiceNumber = match(/(?:n[uú]mero\s*(?:de\s*)?(?:factura|invoice)|(?:factura|invoice)\s*(?:n(?:[uú]mero|[oº°.]*)?)?)\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
    const date = match(new RegExp(`(?:fecha(?:\\s+de\\s+(?:emisi[oó]n|factura))?|invoice date)\\s*[:#-]?\\s*${datePattern}`, "i"));
    const dueDate = match(new RegExp(`(?:fecha de vencimiento|vencimiento|due date)\\s*[:#-]?\\s*${datePattern}`, "i"));
    const total = amountFor(/(?:total(?:\s+(?:a pagar|general))?|monto total|valor total|importe total)\s*[:-]?\s*(?:(?:cop|usd|eur)\s*)?\$?\s*([\d][\d., ]*)/i);
    const subtotal = amountFor(/(?:subtotal|sub-total)\s*[:-]?\s*\$?\s*([\d][\d., ]*)/i);
    const tax = amountFor(/(?:impuestos?|\biva\b|tax)\s*[:-]?\s*\$?\s*([\d][\d., ]*)/i);
    const currency = match(/\b(COP|USD|EUR|MXN|DOP|CRC|PEN|CLP|ARS)\b/i)
        ?? (text.includes("€") ? "EUR" : text.includes("$") ? "COP" : null);
    const paymentTerms = match(labeled("condiciones? de pago|t[eé]rminos? de pago|payment terms"));
    const supplier = match(labeled("proveedor|supplier|vendedor"))
        ?? lines.find((line) => !/(factura|invoice|nit|fecha|total|subtotal)/i.test(line))
        ?? null;

    // Recognize common one-line item rows ending in a line total. Avoid promoting
    // summary rows (subtotal/tax/total) into products.
    const items = lines.flatMap((line) => {
        if (/\b(subtotal|impuesto|iva|total|descuento)\b/i.test(line)) return [];
        const amounts = [...line.matchAll(/(?:\$\s*)?(\d[\d.,]*)(?=\s|$)/g)]
            .map((entry) => ({ raw: entry[1], index: entry.index }))
            .filter((entry) => parseAmount(entry.raw) != null);
        if (!amounts.length) return [];
        const last = amounts[amounts.length - 1];
        const description = line.slice(0, last.index).replace(/[|•-]+\s*$/, "").trim();
        if (description.length < 3 || /^(cantidad|cant\.?|qty|precio|amount|valor)$/i.test(description)) return [];
        const quantity = amounts.length > 1 && /^\d+(?:[.,]\d+)?$/.test(amounts[0].raw)
            ? parseAmount(amounts[0].raw) : null;
        const unitPrice = amounts.length > 1 ? parseAmount(amounts[amounts.length - 2].raw) : null;
        return [{ product: description, description, quantity, unitPrice, total: parseAmount(last.raw) }];
    });

    return { supplier, invoiceNumber, date, dueDate, paymentTerms, currency, subtotal, tax, total, items };
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
