import { useEffect, useState } from "react";
import { createApartamento, createResidencial, deleteApartamento, deleteResidencial, getApartamentos, getResidenciales, updateApartamento, updateResidencial } from "../services/api";
import DataTable from "./DataTable";
import { formatDate } from "../data/modules";

const propertyColumns = ["Residencial", "Dirección", "Creado"];
const apartmentColumns = ["Apartamento", "Residencial", "Usuarios", "Tipo"];
// Debe coincidir con TIPOS_APARTAMENTO del backend.
const apartmentTypes = ["Apartamento", "Casa"];
const emptyApartment = { residencial_id: "", nombre: "", tipo: "Apartamento" };
const asList = (data) => Array.isArray(data) ? data : data?.data ?? [];

export default function PropertiesModule() {
  const [items, setItems] = useState(null);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  // Pestañas: "residenciales" o "apartamentos".
  const [section, setSection] = useState("residenciales");
  const [apartments, setApartments] = useState(null);
  const [apartmentForm, setApartmentForm] = useState(emptyApartment);
  const [editingApartmentId, setEditingApartmentId] = useState(null);
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
      .then((data) => { if (active) 
        setItems(Array.isArray(data) ? data : data?.data ?? []);
       })
      .catch((err) => { if (active) { 
        setError(
          `No se pudieron cargar los residenciales: ${err.message}`); setItems([]); 
        } });
    return () => { 
      active = false; 
    };
  }, []);

  const loadApartments = async () => {
    try {
      setApartments(asList(await getApartamentos()));
    } catch (err) {
      setError(`No se pudieron cargar los apartamentos: ${err.message}`);
      setApartments([]);
    }
  };

  useEffect(() => {
    if (section !== "apartamentos") return undefined;
    let active = true;
    getApartamentos()
      .then((data) => { if (active) setApartments(asList(data)); })
      .catch((err) => { if (active) { setError(`No se pudieron cargar los apartamentos: ${err.message}`); setApartments([]); } });
    return () => { active = false; };
  }, [section]);

  const changeSection = (next) => {
    if (next === section) return;
    setSection(next); setError(""); setNotice("");
    reset(); resetApartment();
  };

  const reset = () => { setEditingId(null); setNombre(""); setDireccion(""); };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      if (editingId == null) { 
        await createResidencial({ nombre, direccion }); 
        setNotice("Residencial guardado en la base de datos."); 
      }
      else { 
        await updateResidencial(editingId, { nombre, direccion }); 
        setNotice("Residencial actualizado."); 
      }
      reset(); 
      await load();

    } catch (err) { 
      setError(`No se pudo guardar: ${err.message}`); 
    }
    finally { 
      setSaving(false); 
    }
  };
  const edit = (item) => {
    if (item.residencial_id == null && item.id == null) { 
      setError("El API no devolvió el identificador."); 
      return; 
    }
    setEditingId(item.residencial_id ?? item.id); setNombre(item.nombre || ""); setDireccion(item.direccion || ""); setError(""); setNotice("");
    document.getElementById("property-name")?.focus();
  };

  const remove = async (item) => {
    if (item.residencial_id == null && item.id == null) { 
      setError("El API no devolvió el identificador."); 
      return; 
    }
    if (!window.confirm(`¿Eliminar el residencial “${item.nombre}”?`)) 
      return;
    setError("");
    setNotice("");

    try {
      await deleteResidencial(item.residencial_id ?? item.id);
      if (String(editingId) === String(item.residencial_id ?? item.id)) 
        reset();
      setNotice("Residencial eliminado."); 
      await load();
    } catch (err) { 
      setError(`No se pudo eliminar: ${err.message}`); }
  };

  const resetApartment = () => { setEditingApartmentId(null); setApartmentForm(emptyApartment); };

  const submitApartment = async (event) => {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    const payload = { ...apartmentForm, residencial_id: Number(apartmentForm.residencial_id), nombre: apartmentForm.nombre.trim() };
    try {
      if (editingApartmentId == null) {
        await createApartamento(payload);
        setNotice("Apartamento guardado en la base de datos.");
      } else {
        await updateApartamento(editingApartmentId, payload);
        setNotice("Apartamento actualizado.");
      }
      resetApartment();
      await loadApartments();
    } catch (err) {
      setError(`No se pudo guardar el apartamento: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const editApartment = (item) => {
    setEditingApartmentId(item.id);
    setApartmentForm({ residencial_id: String(item.residencial_id ?? ""), nombre: item.nombre ?? "", tipo: item.tipo || "Apartamento" });
    setError(""); setNotice("");
    document.getElementById("apartment-name")?.focus();
  };

  const removeApartment = async (item) => {
    if (!window.confirm(`¿Eliminar el apartamento “${item.nombre}”?`)) return;
    setError(""); setNotice("");
    try {
      await deleteApartamento(item.id);
      if (editingApartmentId === item.id) resetApartment();
      setNotice("Apartamento eliminado.");
      await loadApartments();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    }
  };

  const apartmentRows = (apartments ?? []).map((item) => ({
    id: item.id,
    item,
    cells: [item.nombre ?? "—", item.nombre_residencial ?? "—", Number(item.usuarios_count) || 0, item.tipo ?? "—"]
  }));

  const apartmentActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); editApartment(row.item); }}>Editar</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); removeApartment(row.item); }}>Eliminar</button>
  </>;

  const rows = (items ?? []).map((item) => ({
    id: item.residencial_id ?? item.id,
    item,
    cells: [item.nombre ?? "—", item.direccion ?? "—", formatDate(item.created_at)]
  }));
  const actionsFor = (row, close) => {
    return <>
      <button 
        type="button" 
        role="menuitem" 
        onClick={() => { 
          close(); 
          edit(row.item); 
          }}>
            Editar
      </button>

      <button 
        type="button" 
        role="menuitem" 
        className="danger" 
        onClick={() => { 
          close(); 
          remove(row.item); 
          }}>
            Eliminar
      </button>
      
    </>;
  };

  return <section className="content">
    <div className="module-head">
      <div>
        <p>ADMINISTRACIÓN</p>
        <h2>Propiedades</h2>
        <span>Registra residenciales y sus apartamentos.</span>
      </div>
    </div>

    <div className="social-admin-tabs" role="tablist" aria-label="Secciones de propiedades">
      <button type="button" role="tab" aria-selected={section === "residenciales"} className={section === "residenciales" ? "active" : ""} onClick={() => changeSection("residenciales")}>Residenciales</button>
      <button type="button" role="tab" aria-selected={section === "apartamentos"} className={section === "apartamentos" ? "active" : ""} onClick={() => changeSection("apartamentos")}>Apartamentos</button>
    </div>

    {section === "apartamentos" && <>
      <form className="panel report-form" onSubmit={submitApartment}>
        <h3>{editingApartmentId == null ? "Registrar apartamento" : "Editar apartamento"}</h3>
        <div className="dynamic-fields">
          <label htmlFor="apartment-property"><span>Residencial</span>
            <select id="apartment-property" value={apartmentForm.residencial_id} onChange={(event) => setApartmentForm({ ...apartmentForm, residencial_id: event.target.value })} required>
              <option value="" disabled>Selecciona un residencial</option>
              {(items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </label>
          <label htmlFor="apartment-name"><span>Nombre o número</span>
            <input id="apartment-name" value={apartmentForm.nombre} onChange={(event) => setApartmentForm({ ...apartmentForm, nombre: event.target.value })} required maxLength={100} placeholder="Ej.: Torre 1 - 302" />
          </label>
          <label htmlFor="apartment-type"><span>Tipo</span>
            <select id="apartment-type" value={apartmentForm.tipo} onChange={(event) => setApartmentForm({ ...apartmentForm, tipo: event.target.value })} required>
              {apartmentTypes.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
        </div>
        <div className="form-actions">
          {editingApartmentId != null && <button type="button" onClick={resetApartment} disabled={saving}>Cancelar edición</button>}
          <button type="submit" disabled={saving}>{saving ? "Guardando…" : editingApartmentId == null ? "Guardar apartamento" : "Guardar cambios"}</button>
        </div>
      </form>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-title"><div><h3>Apartamentos registrados</h3><p>Cada apartamento pertenece a un residencial y puede tener varios usuarios.</p></div></div>
        {error && <p className="load-error" role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {apartments === null
          ? <p className="table-loading">Cargando apartamentos…</p>
          : <DataTable columns={apartmentColumns} rows={apartmentRows} pageSize={8} renderActions={apartmentActions} />}
      </section>
    </>}

    {section === "residenciales" && <>
    <form className="panel report-form" onSubmit={submit}>
      <h3>{editingId == null ? "Registrar residencial" : "Editar residencial"}</h3>

      <div className="dynamic-fields">
        <label htmlFor="property-name">
          <span>Nombre del residencial</span>
            <input 
            id="property-name" 
            name="nombre" 
            value={nombre} 
            onChange={(event) => setNombre(event.target.value)} 
            required maxLength={150} 
            placeholder="Nombre del residencial" />
        </label>

        <label htmlFor="property-address">
          <span>Dirección</span>
            <input 
            id="property-address" 
            name="direccion" 
            value={direccion} 
            onChange={(event) => setDireccion(event.target.value)} 
            maxLength={255} 
            placeholder="Ej.: Calle 10 # 20-30" />
        </label>

      </div>

      <div className="form-actions">
        {editingId != null && 
          <button 
            type="button"
            onClick={reset} 
            disabled={saving}>
              Cancelar edición
            </button>}

        <button 
          type="submit" 
          disabled={saving}>
            {saving ? "Guardando…" 
            : editingId == null 
            ? "Guardar residencial" 
            : "Guardar cambios"
            }
          </button>
      </div>

    </form>

    <section 
      className="panel" 
      style={{ marginTop: 24 }}>
        
      <div className="panel-title">
        <div>
          <h3>
            Residenciales asignados
          </h3>

          <p>Registros guardados en la base de datos</p>
        </div>
        
      </div>
      {error && 
        <p className="load-error" role="alert">
          {error}
        </p>}
      {notice && 
        <p role="status">
          {notice}
        </p>}
      {items === null 
        ? <p className="table-loading">
          Cargando residenciales…
        </p> 
        : <DataTable 
          columns={propertyColumns} 
          rows={rows} 
          pageSize={8} 
          renderActions={actionsFor} 
          />}
    </section>
    </>}
  </section>;
}
