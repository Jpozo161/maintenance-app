import { useEffect, useMemo, useState } from "react";
import { associateFactura, getFacturas, getMantenimientos, getOriginalFacturaUrl, previewInvoice, uploadFactura } from "../services/api";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const formatBytes = (size) => size < 1024 * 1024 ? `${(size / 1024).toFixed(0)} KB` : `${(size / (1024 * 1024)).toFixed(2)} MB`;
const display = (value) => value == null || value === "" ? "No detectado" : value;
const money = (value) => value == null ? "No detectado" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(value);

export default function OcrComparison() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [associationTarget, setAssociationTarget] = useState(null);
  const [maintenanceId, setMaintenanceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const refreshInvoices = async () => {
    const result = await getFacturas();
    setInvoices(Array.isArray(result) ? result : []);
  };

  useEffect(() => {
    let active = true;
    Promise.all(
      [getFacturas(), 
      getMantenimientos()
      ])
      .then(([saved, maintenanceRows]) => {
        if (!active) return;
        setInvoices(Array.isArray(saved) ? saved : []);
        setMaintenances(Array.isArray(maintenanceRows) ? maintenanceRows : []);
      })
      .catch((err) => { if (active) 
        setError(`No se pudo cargar el repositorio: ${err.message}`); 
      })
      .finally(() => { if (active) 
        setLoading(false); 
      });
    return () => { 
      active = false; 
    };
  }, []);

  const visibleInvoices = useMemo(() => invoices.filter((invoice) =>
    [invoice.nombre_original, 
      invoice.proveedor, 
      invoice.numero_factura, 
      invoice.mantenimiento_tipo
    ]
      .some((value) => String(value ?? "")
      .toLocaleLowerCase("es-CO")
      .includes(search.trim()
      .toLocaleLowerCase("es-CO")
    ))
  ), [invoices, search]);
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(visibleInvoices.length / pageSize));
  const pageInvoices = visibleInvoices.slice(page * pageSize, (page + 1) * pageSize);

  const selectFile = (event) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(null);
    setPreview(null);
    setNotice("");
    setError("");
    if (!selected) 
      return;
    if (selected.size > MAX_FILE_BYTES) { 
      setError("El archivo supera el límite de 20 MB."); 
      event.target.value = ""; 
      return; 
    }
    const acceptedTypes = { 
      pdf: "application/pdf", 
      jpg: "image/jpeg", 
      jpeg: "image/jpeg", 
      png: "image/png" 
    };

    const extension = selected.name.toLowerCase().split(".").pop();
    if (!acceptedTypes[extension] || (selected.type && selected.type !== acceptedTypes[extension])) { 
      setError("Selecciona un PDF, JPG o PNG."); 
      event.target.value = ""; 
      return; 
    }
    setFile(selected);
  };

  const analyze = async () => {
    if (!file) 
      return;
    setBusy(true); 
    setError(""); 
    setNotice("");
    try { 
      setPreview(await previewInvoice(file)); 
    }
    catch (err) { 
      setError(`No se pudo preparar la factura: ${err.message}`); 
    }
    finally { setBusy(false); }
  };

  const confirmUpload = async () => {
    if (!file || !preview) 
      return;
    setBusy(true); 
    setError(""); 
    setNotice("");
    try {
      await uploadFactura(file);
      setFile(null); 
      setPreview(null);

      await refreshInvoices();
      setNotice("Factura guardada en el repositorio.");
      const input = document.getElementById("invoice-file");
      if (input) 
        input.value = "";
    } catch (err) { 
      setError(`No se pudo guardar la factura: ${err.message}`); 
    }
    finally { 
      setBusy(false); 
    }
  };

  const saveAssociation = async (event) => {
    event.preventDefault();
    if (!associationTarget) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await associateFactura(associationTarget.id, maintenanceId ? Number(maintenanceId) : null);
      setAssociationTarget(null); setMaintenanceId("");
      await refreshInvoices();
      setNotice("Asociación de mantenimiento actualizada.");
    } catch (err) { setError(`No se pudo actualizar la asociación: ${err.message}`); }
    finally { setBusy(false); }
  };

  return <section className="content invoice-content">
    <div className="module-head">
      <div>
        <p>DOCUMENTOS</p>
        <h2>Repositorio de facturas</h2>
        <span>Analiza, revisa y guarda cada documento. La asociación al mantenimiento es opcional y manual.</span>
        </div>
    </div>

    <section className="panel invoice-upload-panel">
      <div className="panel-title">

        <div>
          <h3>Nueva factura</h3>
          <p>Primero revisa los datos detectados. El documento se guarda solo cuando confirmas.</p>
        </div>

      </div>

      <label className="invoice-dropzone" htmlFor="invoice-file">
        <span className="invoice-upload-icon" aria-hidden="true">
          ↑
        </span>

        <strong>
          {file?.name ?? "Selecciona una factura"}
        </strong>

        <span>
          Arrastra el archivo aquí o búscalo en tu dispositivo
        </span>

        <small>
          PDF, JPG o PNG · máximo 20 MB
        </small>

        <input id="invoice-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={selectFile} />
      </label>
      {file && 
        <div className="invoice-file-summary">
          <span>
            {file.type || "Tipo no identificado"}
          </span>

          <span>
            {formatBytes(file.size)}
          </span>

          <button 
            type="button" 
            onClick={() => { 
              setFile(null); 
              setPreview(null); 
              const input = document.getElementById("invoice-file"); 
              if (input) 
              input.value = ""; 
            }}>
              Quitar archivo
          </button>
        </div>
        }


      {file && 
        !preview && 
        <button 
          className="invoice-primary-action" 
          type="button" 
          disabled={busy} 
          onClick={analyze}>
            {busy ? 
              "Analizando documento…" : 
                "Analizar y revisar datos"
            }
        </button>
        }

      {preview && <div className="invoice-preview" aria-live="polite">
        <div className="invoice-preview-heading">
          <div>
            <span className="invoice-step-label">
              VISTA PREVIA
            </span>

            <h3>
              Esto se guardará
            </h3>

            <p>
              Verifica el archivo y los datos detectados antes de confirmar.
            </p>
          </div>

          <span className="invoice-status-pill">
            Pendiente de confirmar
          </span>
        </div>

        <div className="invoice-preview-grid">
          <div>
            <span>
              Nombre original
            </span>

            <strong>
              {file.name}
            </strong>
          </div>

          <div>
            <span>
              Tipo MIME
            </span>

            <strong>
              {file.type || "No identificado"}
            </strong>
          </div>

          <div>
            <span>
              Tamaño
            </span>

            <strong>
              {formatBytes(file.size)}
            </strong>
          </div>

          <div>
            <span>
              Clave prevista en S3
            </span>

            <strong className="invoice-mono">
              {preview.objectKey}
            </strong>

          </div>

          <div>
            <span>
              SHA-256 para duplicados
            </span>

            <strong className="invoice-mono">
              {preview.sha256}
            </strong>
          </div>

          <div>
            <span>
              Proveedor detectado
            </span>

            <strong>
              {display(preview.fields?.supplier)}
            </strong>
          </div>

          <div>
            <span>
              Número de factura
            </span>

            <strong>
              {display(preview.fields?.invoiceNumber)}
            </strong>
          </div>

          <div>
            <span>
              Fecha de emisión
            </span>
            <strong>
              {display(preview.fields?.date)}
            </strong>
          </div>

          <div>
            <span>
              Total detectado
              </span>
              <strong>
                {money(preview.fields?.total)}
              </strong>
          </div>

          <div>
            <span>
              Mantenimiento
            </span>
            <strong>
              Sin asociar · la asignación es manual
            </strong>
          </div>

        </div>

        <details className="invoice-ocr-text">
          <summary>
            Ver texto completo detectado por OCR
          </summary>

          <pre>
            {preview.text || "No se detectó texto legible."}
          </pre>
        </details>

        <div className="invoice-confirm-note">
          <span aria-hidden="true">
            ⓘ
          </span>
          <p>
            Al confirmar, el original se subirá al bucket privado de S3 y los datos se guardarán en la base de datos. No se asignará ningún mantenimiento automáticamente.
          </p>
        </div>

        <div className="invoice-preview-actions">
          <button type="button" onClick={() => setPreview(null)} disabled={busy}>
            Volver
          </button>

          <button className="invoice-primary-action" 
            type="button" 
            onClick={confirmUpload} 
            disabled={busy}>
              {busy ? "Guardando factura…" : "Confirmar y guardar factura"}
          </button>
        </div>
      </div>
      }
    </section>

    {error && <p className="load-error" role="alert">{error}</p>}
    {notice && <p className="invoice-notice" role="status">{notice}</p>}

    <section className="panel invoice-repository-panel">
      <div className="panel-title">
        <div>
          <h3>
            Facturas almacenadas
          </h3>

          <p>
            {invoices.length} 
            {invoices.length === 1 ? "documento" : "documentos"} 
            en el repositorio
          </p>
        </div>

        <label className="invoice-search">⌕ 
          <input 
            value={search} 
            onChange={(event) => { 
              setSearch(event.target.value); 
              setPage(0); 
              }} 
            placeholder="Buscar factura…" 
            aria-label="Buscar facturas" />
        </label>
      </div>

      {associationTarget && 
        <form 
          className="invoice-association" 
          onSubmit={saveAssociation}>

        <div>
          <strong>
            Asociar “{associationTarget.nombre_original}”
          </strong>

          <span>
            Selecciona un mantenimiento existente. Puedes dejarlo sin asociación.
          </span>
        </div>

        <select 
          value={maintenanceId} 
          onChange={(event) => setMaintenanceId(event.target.value)} 
          aria-label="Mantenimiento asociado">
            <option value="">
              Sin mantenimiento asociado
            </option>

            {maintenances.map((item) => 
              <option 
                key={item.id} 
                value={item.id}>
                  #{item.id} · {item.tipo || item.descripcion || "Mantenimiento"}
              </option>
            )}
          </select>

        <button type="submit" disabled={busy}>
          {busy ? "Guardando…" : 
            "Guardar asociación"
            }
        </button>

        <button type="button" onClick={() => setAssociationTarget(null)}>
          Cancelar
        </button>
      </form>
      }
      {loading ? 
        <p className="table-loading">
            Cargando facturas…
        </p> : <div className="table-wrap">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>
                  Documento
                </th>

                <th>
                  Proveedor / número
                </th>

                <th>
                  Fecha
                </th>
                
                <th>
                  Total
                </th>

                <th>
                  Mantenimiento
                </th>
                <th>
                  Acciones
                </th>
              </tr>
            </thead>
          <tbody>

        {pageInvoices.length ? pageInvoices.map((invoice) => <tr key={invoice.id}>

          <td>
            <strong>
              {invoice.nombre_original}
            </strong>
            
            <small>
              {invoice.tipo_mime} 
              · 
              {formatBytes(Number(invoice.tamano_bytes))}
            </small>
          </td>

          <td>
              {invoice.proveedor || "—"}
            <small>
              {invoice.numero_factura || "Sin número detectado"}
            </small>
          </td>

          <td>
            {invoice.fecha_factura || "—"}
          </td>

          <td>
            {money(invoice.total)}
          </td>

          <td>
            {invoice.mantenimiento_id ? 
            `#${invoice.mantenimiento_id} · 
            ${invoice.mantenimiento_tipo || "Mantenimiento"}` : 
              <span className="invoice-unassigned">
                Sin asociar
              </span>}
            </td>

          <td className="invoice-row-actions">

            <a 
              href={getOriginalFacturaUrl(invoice.id)} 
              target="_blank" 
              rel="noreferrer">
                Abrir original
            </a>

            <button 
              type="button" 
              onClick={() => { setAssociationTarget(invoice); 
              setMaintenanceId(invoice.mantenimiento_id ? 
              String(invoice.mantenimiento_id) : ""); }}>
                Asociar
            </button>
          </td>

        </tr>
      ) : 
        <tr>
          <td colSpan="6" className="invoice-empty">
            {invoices.length ? "No hay facturas que coincidan con la búsqueda." : 
              "Todavía no hay facturas guardadas."
            }
          </td>
        </tr>
        }
      </tbody>
      </table>
    </div>
    }
      {!loading && visibleInvoices.length > 0 && 
        <div className="pagination">
          <span>
            Mostrando 
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, visibleInvoices.length)} de {visibleInvoices.length}
          </span>
        
        <div>
          <button 
            type="button" 
            disabled={page === 0} 
            onClick={() => setPage((current) => Math.max(0, current - 1))}>
              Anterior
          </button>

          <span>
            Página {page + 1} de {pageCount}
          </span>

          <button 
            type="button" 
            disabled={page + 1 >= pageCount} 
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1)
            )}>
              Siguiente
          </button>

          </div>

          </div>
          }
    </section>
  </section>;
}
