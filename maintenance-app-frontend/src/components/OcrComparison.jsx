import { useState } from "react";
import { extractInvoice } from "../services/api";

const uploads = [
  ["facturaA", "Factura 1"], 
  ["facturaB", "Factura 2"]
];

const compareValue = (first, second, key, format = (value) => value) => {
  const a = first?.fields?.[key];
  const b = second?.fields?.[key];

  if (a == null || b == null) 
    return "No detectado en ambas facturas";

  return String(a).toLowerCase() === String(b).toLowerCase()
    ? `Coincide: ${format(a)}`
    : `Diferente: ${format(a)} / ${format(b)}`;
};


export default function OcrComparison() {

  const [files, setFiles] = useState({
     facturaA: null, 
     facturaB: null 
    });

  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const update = (key) => (event) => {
    setFiles((current) => ({ 
      ...current, 
      [key]: event.target.files?.[0] ?? null 
    }));

    setResults(null); 
    setError("");
  };

  const compare = async () => {

    setBusy(true); 
    setError(""); 
    setResults(null);

    try {
      const extracted = [];
      
      for (const [key] of uploads) extracted.push(await extractInvoice(files[key]));
      setResults(extracted);

    } catch (err) { 
      setError(`No se pudieron analizar las facturas: ${err.message}`); }
    finally { setBusy(false); }
  };

  return <section className="content">
    <div className="module-head">
      <div>
        <p>
          HERRAMIENTAS
        </p>
        
        <h2>
          Comparación de facturas con OCR
        </h2>
        <span>Adjunta dos facturas para extraer y comparar su información.</span>
      </div>

    </div>

    <section className="panel ocr-panel">
      <p className="form-note">
        Se admiten PDF, JPG y PNG. El OCR reconoce texto en español e inglés.
      </p>

      <div className="ocr-upload-grid">

        {uploads.map(([key, label]) => 
          <label className="ocr-upload" key={key}>

        <strong>
          {label}
        </strong>

        <span>
          {files[key]?.name ?? "PDF o imagen (JPG, PNG)"}
        </span>

        <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={update(key)} />

        </label>
  )}

    </div>

      <button 
        className="ocr-compare" 
        disabled={!files.facturaA || !files.facturaB || busy} 
        type="button" 
        onClick={compare}>

        {busy ? "Analizando facturas…" : "Comparar facturas"}
      </button>

      <p className="ocr-note">
        Cada archivo puede pesar hasta 20 MB.
      </p>

      {error && 
        <p className="load-error" role="alert">
          {error}
        </p>}

      {results && 
        <div className="ocr-results">
          <h3>Comparación</h3>
            <ul>
              <li>Número de factura: {compareValue(results[0], results[1], "invoiceNumber")}</li>
              <li>Fecha: {compareValue(results[0], results[1], "date")}</li>
              <li>Total: {compareValue(results[0], results[1], "total", (value) => `$${value}`)}</li>
            </ul>

        <div className="ocr-result-grid">
          {results.map((result, index) => 
            <section className="ocr-result" key={uploads[index][0]}>

          <h4>
            {uploads[index][1]}: {files[uploads[index][0]]?.name}
          </h4>

          <p>
            <strong>
              Emisor detectado:
            </strong> 

            {result.fields.supplier ?? "No detectado"}
          </p>

          <p>
            <strong>
              Número:
            </strong>

             {result.fields.invoiceNumber ?? "No detectado"}
          </p>

          <p>
            <strong>
              Fecha:
            </strong> 

            {result.fields.date ?? "No detectada"}
          </p>

          <p>
            <strong>
              Total:
            </strong> 

            {result.fields.total == null ? "No detectado" : `$${result.fields.total}`}
          </p>

          <details>
            <summary>
              Texto reconocido
            </summary>

            <pre>
              {result.text || "No se detectó texto legible."}
            </pre>

          </details>

        </section>
      )}
      </div>

        </div>
        }
    </section>
  </section>
  ;
}
