import { useEffect, useMemo, useRef, useState } from "react";
import {
  archiveDocumento,
  associateDocumento,
  getDocumentos,
  getDocumentoUrl,
  getMantenimientos,
  uploadDocumento
} from "../services/api";

import { 
  asArray, 
  formatDate,
  maintenanceNumber } from "../data/modules";

import DataTable from "./DataTable";
import MaintenancePicker from "./MaintenancePicker";

// Debe coincidir con el límite y la validación de documentos.service.js en el backend.
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const columns = ["Documento", "Tamaño", "Subido por", "Fecha de carga", "Mantenimiento"];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isPdf = (file) => file.name.toLowerCase().endsWith(".pdf") && (!file.type || file.type === "application/pdf");

export default function DocumentsModule() {
  const [file, setFile] = useState(null);
  const [uploadMaintenanceId, setUploadMaintenanceId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [documents, setDocuments] = useState(null);
  const [maintenances, setMaintenances] = useState([]);
  const [associationTarget, setAssociationTarget] = useState(null);
  const [associationMaintenanceId, setAssociationMaintenanceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);

  // Vista previa del PDF antes de guardarlo.
  const fileUrl = useMemo(() => 
    file 
    ? URL.createObjectURL(file) 
    : null, 
    [file]
  );
  
  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const refreshDocuments = async () => setDocuments(asArray(await getDocumentos()));

  useEffect(() => {
    let active = true;
    Promise.all([getDocumentos(), getMantenimientos()])
      .then(([saved, maintenanceRows]) => {
        if (!active) return;
        setDocuments(asArray(saved));
        setMaintenances(asArray(maintenanceRows));
      })
      .catch((err) => {
        if (!active) return;
        setError(`No se pudieron cargar los documentos: ${err.message}`);
        setDocuments([]);
      });
    return () => { active = false; };
  }, []);

  const clearFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const pickFile = (selected) => {
    clearFile();
    setNotice(""); setError("");
    if (!selected) return;
    if (!isPdf(selected)) { setError("Solo se permiten archivos PDF."); return; }
    if (selected.size > MAX_FILE_BYTES) { setError("El archivo supera el límite de 20 MB."); return; }
    setFile(selected);
  };

  const dropFile = (event) => {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    pickFile(event.dataTransfer.files?.[0] ?? null);
  };

  const confirmUpload = async (event) => {
    event.preventDefault();
    if (!file || !uploadMaintenanceId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await uploadDocumento(file, Number(uploadMaintenanceId));
      clearFile();
      setUploadMaintenanceId("");
      await refreshDocuments();
      setNotice("Documento guardado y asociado al mantenimiento.");
    } catch (err) { setError(`No se pudo guardar el documento: ${err.message}`); }
    finally { setBusy(false); }
  };

  const saveAssociation = async (event) => {
    event.preventDefault();
    if (!associationTarget || !associationMaintenanceId || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await associateDocumento(associationTarget.id, Number(associationMaintenanceId));
      setAssociationTarget(null);
      await refreshDocuments();
      setNotice("Mantenimiento del documento actualizado.");
    } catch (err) { setError(`No se pudo cambiar el mantenimiento: ${err.message}`); }
    finally { setBusy(false); }
  };

  const archive = async (document) => {
    if (!window.confirm(`¿Eliminar “${document.nombre_original}” de la lista? El archivo se conservará en el almacenamiento.`)) return;
    setError(""); setNotice("");
    try {
      await archiveDocumento(document.id);
      if (associationTarget?.id === document.id) setAssociationTarget(null);
      await refreshDocuments();
      setNotice("Documento eliminado de la lista; el archivo se conservó en el almacenamiento.");
    } catch (err) { setError(`No se pudo eliminar el documento: ${err.message}`); }
  };

  const rows = (documents ?? []).map((document) => ({
    id: document.id,
    item: document,
    cells: [
      document.nombre_original,
      formatBytes(Number(document.tamano_bytes)),
      document.subido_por_nombre ?? "—",
      formatDate(document.created_at),
      `${maintenanceNumber(document.mantenimiento_id)} · ${document.mantenimiento_tipo || "Mantenimiento"}`
    ]
  }));

  const renderActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); window.open(getDocumentoUrl(row.id, "ver"), "_blank", "noopener"); }}>Ver</button>
    <button type="button" role="menuitem" onClick={() => { close(); window.location.assign(getDocumentoUrl(row.id, "descargar")); }}>Descargar</button>
    <button type="button" role="menuitem" onClick={() => { close(); setAssociationTarget(row.item); setAssociationMaintenanceId(String(row.item.mantenimiento_id)); }}>Cambiar mantenimiento</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); archive(row.item); }}>Eliminar</button>
  </>;

  return <section className="content">
    <div className="module-head">
      <div>
        <p>DOCUMENTOS</p>
        <h2>Documentos de mantenimientos</h2>
        <span>Sube archivos PDF y asócialos a un mantenimiento. Se guardan en un almacenamiento privado.</span>
      </div>
    </div>

    <section className="panel document-upload-panel">
      <div className="panel-title">
        <div>
          <h3>Nuevo documento</h3>
          <p>Selecciona el PDF, revísalo y elige el mantenimiento al que pertenece.</p>
        </div>
      </div>

      {!file && <label
        className={`document-dropzone${dragging ? " is-dragging" : ""}`}
        htmlFor="document-file"
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={dropFile}>
        <span className="document-upload-icon" aria-hidden="true">↑</span>
        <strong>{dragging ? "Suelta el archivo aquí" : "Selecciona un documento"}</strong>
        <span>Arrastra el archivo aquí o búscalo en tu dispositivo</span>
        <small>Solo PDF · máximo 20 MB</small>
        <input
          id="document-file"
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
      </label>}

      {file && <form className="document-review-layout" onSubmit={confirmUpload}>
        <div className="document-view">
          {fileUrl && <iframe src={fileUrl} title={`Documento ${file.name}`} />}
        </div>

        <div className="document-upload-form">
          <div>
            <strong>{file.name}</strong>
            <span>{formatBytes(file.size)}</span>
          </div>
          <div className="document-maintenance-field">
            <span>Mantenimiento</span>
            <MaintenancePicker
              maintenances={maintenances}
              value={uploadMaintenanceId}
              onChange={setUploadMaintenanceId}
              disabled={busy || !maintenances.length} />
          </div>
          {!maintenances.length && <p className="form-note">No hay mantenimientos registrados. Crea uno antes de subir documentos.</p>}
          <div className="form-actions">
            <button type="button" onClick={clearFile} disabled={busy}>Quitar archivo</button>
            <button type="submit" disabled={busy || !uploadMaintenanceId}>{busy ? "Guardando…" : "Guardar documento"}</button>
          </div>
        </div>
      </form>}
    </section>

    {error && <p className="load-error" role="alert">{error}</p>}
    {notice && <p className="document-notice" role="status">{notice}</p>}

    <section className="panel document-repository-panel">
      <div className="panel-title">
        <div>
          <h3>Historial de documentos</h3>
          <p>{rows.length} {rows.length === 1 ? "documento guardado" : "documentos guardados"}</p>
        </div>
      </div>

      {associationTarget && <form className="document-association" onSubmit={saveAssociation}>
        <div>
          <strong>
          Cambiar mantenimiento de “{associationTarget.nombre_original}”
          </strong>
          <span>
          Selecciona el mantenimiento al que pertenece este documento.
          </span>
        </div>
        
        <MaintenancePicker
          maintenances={maintenances}
          value={associationMaintenanceId}
          onChange={setAssociationMaintenanceId}
          disabled={busy} />
        <button type="submit" disabled={busy || !associationMaintenanceId}>{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={() => setAssociationTarget(null)}>Cancelar</button>
      </form>}

      {documents === null
        ? <p className="table-loading">Cargando documentos…</p>
        : <DataTable columns={columns} rows={rows} renderActions={renderActions} />}
    </section>
  </section>;
}
