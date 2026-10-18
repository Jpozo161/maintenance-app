import { useEffect, useState } from "react";
import { createResidencial, deleteResidencial, getResidenciales, updateResidencial } from "../services/api";
import DataTable from "./DataTable";
import { formatDate } from "../data/modules";

const propertyColumns = ["Residencial", "Dirección", "Creado"];

export default function PropertiesModule() {
  const [items, setItems] = useState(null);
  const [nombre, setNombre] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    try {
      const data = await getResidenciales();
      setItems(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) {
      setError(`No se pudieron cargar los residenciales: ${err.message}`);
      setItems([]);
    }
  };

  useEffect(() => {
    let active = true;
    getResidenciales()
      .then((data) => { if (active) setItems(Array.isArray(data) ? data : data?.data ?? []); })
      .catch((err) => { if (active) { setError(`No se pudieron cargar los residenciales: ${err.message}`); setItems([]); } });
    return () => { active = false; };
  }, []);

  const reset = () => { setEditingId(null); setNombre(""); };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      if (editingId == null) { await createResidencial({ nombre }); setNotice("Residencial guardado en la base de datos."); }
      else { await updateResidencial(editingId, { nombre }); setNotice("Residencial actualizado."); }
      reset(); await load();
    } catch (err) { setError(`No se pudo guardar: ${err.message}`); }
    finally { setSaving(false); }
  };
  const edit = (item) => {
    if (item.residencial_id == null && item.id == null) { setError("El API no devolvió el identificador."); return; }
    setEditingId(item.residencial_id ?? item.id); setNombre(item.nombre || ""); setError(""); setNotice("");
    document.getElementById("property-name")?.focus();
  };
  const remove = async (item) => {
    if (item.residencial_id == null && item.id == null) { setError("El API no devolvió el identificador."); return; }
    if (!window.confirm(`¿Eliminar el residencial “${item.nombre}”?`)) return;
    setError(""); setNotice("");
    try {
      await deleteResidencial(item.residencial_id ?? item.id);
      if (String(editingId) === String(item.residencial_id ?? item.id)) reset();
      setNotice("Residencial eliminado."); await load();
    } catch (err) { setError(`No se pudo eliminar: ${err.message}`); }
  };

  const rows = (items ?? []).map((item) => ({
    id: item.residencial_id ?? item.id,
    item,
    cells: [item.nombre ?? "—", item.direccion ?? "—", formatDate(item.created_at)]
  }));
  const actionsFor = (row, close) => {
    return <>
      <button type="button" role="menuitem" onClick={() => { close(); edit(row.item); }}>Editar</button>
      <button type="button" role="menuitem" className="danger" onClick={() => { close(); remove(row.item); }}>Eliminar</button>
    </>;
  };

  return <section className="content">
    <div className="module-head"><div><p>ADMINISTRACIÓN</p><h2>Propiedades</h2><span>Registra residenciales y consulta los asignados.</span></div></div>
    <form className="panel report-form" onSubmit={submit}>
      <h3>{editingId == null ? "Registrar residencial" : "Editar residencial"}</h3>
      <div className="dynamic-fields"><label htmlFor="property-name"><span>Nombre del residencial</span>
        <input id="property-name" name="nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} required maxLength={150} placeholder="Nombre del residencial" />
      </label></div>
      <div className="form-actions">
        {editingId != null && <button type="button" onClick={reset} disabled={saving}>Cancelar edición</button>}
        <button type="submit" disabled={saving}>{saving ? "Guardando…" : editingId == null ? "Guardar residencial" : "Guardar cambios"}</button>
      </div>
    </form>
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title"><div><h3>Residenciales asignados</h3><p>Registros guardados en la base de datos</p></div></div>
      {error && <p className="load-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {items === null ? <p className="table-loading">Cargando residenciales…</p> : <DataTable columns={propertyColumns} rows={rows} pageSize={8} renderActions={actionsFor} />}
    </section>
  </section>;
}
