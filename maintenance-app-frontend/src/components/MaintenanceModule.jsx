import { useEffect, useState } from "react";
import { headers, navigation, toTableRows } from "../data/modules";
import {
  api,
  deleteMaintenance,
  deletePago,
  deleteUsuario,
  getResidenciales,
  getRoles,
  getFacturas,
  getMaintenanceStatuses,
  getTechnicians,
  getOriginalFacturaUrl,
  postponeMaintenance,
  updateMaintenanceProperty,
  updateMaintenanceStatus,
  updateMaintenanceTechnician,
  updatePago,
  updateUsuario,
} from "../services/api";
import DataTable from "./DataTable";
import Form from "./form";

const maintenanceStatusClass = (statusName = "") => statusName
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

export default function MaintenanceModule({ type, onToast, objects, readOnly = false }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ nombre: "", email: "", role_id: "", residencial_id: "" });
  const [roles, setRoles] = useState([]);
  const [residenciales, setResidenciales] = useState([]);
  const [savingUser, setSavingUser] = useState(false);
  const [maintenanceInvoices, setMaintenanceInvoices] = useState(null);
  const [propertyMaintenance, setPropertyMaintenance] = useState(null);
  const [maintenancePropertyOptions, setMaintenancePropertyOptions] = useState([]);
  const [maintenancePropertyId, setMaintenancePropertyId] = useState("");
  const [savingMaintenanceProperty, setSavingMaintenanceProperty] = useState(false);
  const [technicianMaintenance, setTechnicianMaintenance] = useState(null);
  const [technicianOptions, setTechnicianOptions] = useState([]);
  const [maintenanceTechnicianId, setMaintenanceTechnicianId] = useState("");
  const [savingTechnician, setSavingTechnician] = useState(false);
  const [maintenanceStatuses, setMaintenanceStatuses] = useState([]);
  const [savingStatusId, setSavingStatusId] = useState(null);
  const loading = rows === null;
  const singular = { propietarios: "usuario", pagos: "pago", mantenimientos: "mantenimiento" }[type] ?? "registro";

  const loadRows = async () => {
    const data = await api(null, type, "GET");
    setRows(toTableRows(type, data));
  };

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => api(null, type, "GET"))
      .then((data) => { if (active) setRows(toTableRows(type, data)); })
      .catch((err) => { if (active) { setError(err.message); setRows([]); } });
    return () => { active = false; };
  }, [type]);

  useEffect(() => {
    if (type !== "mantenimientos" || readOnly) return undefined;
    let active = true;
    getMaintenanceStatuses()
      .then((data) => { if (active) setMaintenanceStatuses(Array.isArray(data) ? data : data?.data ?? []); })
      .catch((err) => { if (active) setError(`No se pudieron cargar los estados: ${err.message}`); });
    return () => { active = false; };
  }, [type, readOnly]);

  const editPayment = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del pago."); return; }
    const nombre = window.prompt("Propietario del pago:", row.item.nombre ?? "");
    if (nombre === null) return;
    const rawAmount = window.prompt("Valor del pago:", String(row.item.monto ?? row.item.valor ?? ""));
    if (rawAmount === null) return;
    const monto = Number(rawAmount.replace(",", "."));
    if (!nombre.trim() || !Number.isFinite(monto) || monto < 0) {
      setError("Ingresa un propietario y un valor válido.");
      return;
    }
    try {
      setError(""); setNotice("");
      await updatePago(row.id, { nombre: nombre.trim(), monto });
      await loadRows();
      setNotice("Pago actualizado correctamente.");
    } catch (err) { setError(`No se pudo actualizar el pago: ${err.message}`); }
  };

  const deletePayment = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del pago."); return; }
    if (!window.confirm(`¿Eliminar el pago de ${row.item.nombre ?? "este propietario"}?`)) return;
    try {
      setError(""); setNotice("");
      await deletePago(row.id);
      await loadRows();
      setNotice("Pago eliminado correctamente.");
    } catch (err) { setError(`No se pudo eliminar el pago: ${err.message}`); }
  };

  const editUser = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del usuario."); return; }
    try {
      setError(""); setNotice("");
      const [roleOptions, propertyOptions] = await Promise.all([getRoles(), getResidenciales()]);
      setRoles(Array.isArray(roleOptions) ? roleOptions : roleOptions?.data ?? []);
      setResidenciales(Array.isArray(propertyOptions) ? propertyOptions : propertyOptions?.data ?? []);
      setEditingUser(row.item);
      setUserForm({
        nombre: row.item.nombre ?? "",
        email: row.item.email ?? "",
        role_id: String(row.item.role_id ?? ""),
        residencial_id: String(row.item.residencial_id ?? ""),
      });
    } catch (err) { setError(`No se pudieron cargar los roles y residenciales: ${err.message}`); }
  };

  const saveUser = async (event) => {
    event.preventDefault();
    if (!editingUser?.id) return;
    setSavingUser(true); setError(""); setNotice("");
    try {
      await updateUsuario(editingUser.id, {
        nombre: userForm.nombre.trim(),
        email: userForm.email.trim(),
        role_id: Number(userForm.role_id),
        residencial_id: userForm.residencial_id ? Number(userForm.residencial_id) : null,
      });
      setEditingUser(null);
      await loadRows();
      setNotice("Usuario actualizado correctamente.");
    } catch (err) { setError(`No se pudo actualizar el usuario: ${err.message}`); }
    finally { setSavingUser(false); }
  };

  const deleteUser = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del usuario."); return; }
    if (!window.confirm(`¿Eliminar al usuario “${row.item.nombre}”?`)) return;
    try {
      setError(""); setNotice("");
      await deleteUsuario(row.id);
      if (editingUser?.id === row.id) setEditingUser(null);
      await loadRows();
      setNotice("Usuario eliminado correctamente.");
    } catch (err) { setError(`No se pudo eliminar el usuario: ${err.message}`); }
  };

  const paymentActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); editPayment(row); }}>Editar</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); deletePayment(row); }}>Eliminar</button>
  </>;

  const userActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); editUser(row); }}>Editar</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); deleteUser(row); }}>Eliminar</button>
  </>;

  const openMaintenanceInvoices = async (row) => {
    setError("");
    try {
      const invoices = await getFacturas(row.id);
      setMaintenanceInvoices({ id: row.id, tipo: row.item.tipo ?? row.item.descripcion, invoices: Array.isArray(invoices) ? invoices : [] });
    } catch (err) { setError(`No se pudieron cargar las facturas del mantenimiento: ${err.message}`); }
  };

  const deferMaintenance = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del mantenimiento."); return; }
    if (!window.confirm(`¿Posponer “${row.item.tipo ?? row.item.descripcion}” tres meses desde su fecha límite actual?`)) return;
    try {
      setError(""); setNotice("");
      await postponeMaintenance(row.id);
      await loadRows();
      setNotice("Mantenimiento reprogramado tres meses después de su fecha límite anterior.");
    } catch (err) { setError(`No se pudo posponer el mantenimiento: ${err.message}`); }
  };

  const removeMaintenance = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del mantenimiento."); return; }
    const name = row.item.tipo ?? row.item.descripcion ?? "este mantenimiento";
    if (!window.confirm(`¿Eliminar “${name}” de la lista? El historial y las facturas se conservarán.`)) return;
    try {
      setError(""); setNotice("");
      await deleteMaintenance(row.id);
      await loadRows();
      setNotice("Mantenimiento eliminado de la lista; su historial y facturas se conservaron.");
    } catch (err) { setError(`No se pudo eliminar el mantenimiento: ${err.message}`); }
  };

  const changeMaintenanceStatus = async (row, statusId) => {
    if (row.id == null || !statusId) return;
    setSavingStatusId(row.id); setError(""); setNotice("");
    try {
      await updateMaintenanceStatus(row.id, Number(statusId));
      await loadRows();
      const status = maintenanceStatuses.find((item) => Number(item.id) === Number(statusId));
      setNotice(`Estado actualizado a “${status?.nombre ?? "nuevo estado"}”.`);
    } catch (err) { setError(`No se pudo actualizar el estado: ${err.message}`); }
    finally { setSavingStatusId(null); }
  };

  const assignMaintenanceProperty = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del mantenimiento."); return; }
    try {
      setError(""); setNotice("");
      const properties = await getResidenciales();
      setMaintenancePropertyOptions(Array.isArray(properties) ? properties : properties?.data ?? []);
      setMaintenancePropertyId(String(row.item.residencial_id ?? ""));
      setPropertyMaintenance(row);
    } catch (err) { setError(`No se pudieron cargar las propiedades: ${err.message}`); }
  };

  const saveMaintenanceProperty = async (event) => {
    event.preventDefault();
    if (!propertyMaintenance?.id || !maintenancePropertyId) return;
    setSavingMaintenanceProperty(true); setError(""); setNotice("");
    try {
      await updateMaintenanceProperty(propertyMaintenance.id, Number(maintenancePropertyId));
      setPropertyMaintenance(null);
      await loadRows();
      setNotice("Propiedad del mantenimiento actualizada correctamente.");
    } catch (err) { setError(`No se pudo asignar la propiedad: ${err.message}`); }
    finally { setSavingMaintenanceProperty(false); }
  };

  const assignMaintenanceTechnician = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del mantenimiento."); return; }
    try {
      setError(""); setNotice("");
      const data = await getTechnicians();
      const options = Array.isArray(data) ? data : data?.data ?? [];
      setTechnicianOptions(options);
      setMaintenanceTechnicianId(String(row.item.tecnico_id ?? ""));
      setTechnicianMaintenance(row);
    } catch (err) { setError(`No se pudieron cargar los técnicos: ${err.message}`); }
  };

  const saveMaintenanceTechnician = async (event) => {
    event.preventDefault();
    if (!technicianMaintenance?.id) return;
    setSavingTechnician(true); setError(""); setNotice("");
    try {
      await updateMaintenanceTechnician(technicianMaintenance.id, maintenanceTechnicianId || null);
      setTechnicianMaintenance(null);
      await loadRows();
      setNotice("Técnico del mantenimiento actualizado correctamente.");
    } catch (err) { setError(`No se pudo asignar el técnico: ${err.message}`); }
    finally { setSavingTechnician(false); }
  };

  const maintenanceRowActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); openMaintenanceInvoices(row); }}>Ver facturas asociadas</button>
    <button type="button" role="menuitem" onClick={() => { close(); assignMaintenanceProperty(row); }}>{row.item.residencial_id ? "Cambiar propiedad" : "Asignar propiedad"}</button>
    <button type="button" role="menuitem" onClick={() => { close(); assignMaintenanceTechnician(row); }}>{row.item.tecnico_id ? "Cambiar técnico" : "Asignar técnico"}</button>
    <button type="button" role="menuitem" onClick={() => { close(); deferMaintenance(row); }}>Posponer 3 meses</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); removeMaintenance(row); }}>Eliminar</button>
  </>;

  const renderMaintenanceCell = (row, columnIndex) => columnIndex === 5 ? (
    <select
      className={`maintenance-status-select maintenance-status-${maintenanceStatusClass(maintenanceStatuses.find((status) => Number(status.id) === Number(row.item.estado_id))?.nombre ?? row.item.estado_nombre)}`}
      aria-label={`Estado de ${row.item.tipo ?? "mantenimiento"}`}
      value={String(row.item.estado_id ?? "")}
      disabled={savingStatusId === row.id || !maintenanceStatuses.length}
      onChange={(event) => changeMaintenanceStatus(row, event.target.value)}
    >
      {maintenanceStatuses.map((status) => <option key={status.id} value={status.id}>{status.nombre}</option>)}
    </select>
  ) : undefined;

  if (objects === "open") return <Form type={type} showToast={onToast} objects={objects} />;

  return <section className="content">
    <div className="module-head">
      <div><p>{readOnly ? "CONSULTA" : "ADMINISTRACIÓN"}</p><h2>{navigation[type]?.title ?? type}</h2><span>{readOnly ? "Consulta los mantenimientos del conjunto." : "Gestiona la información registrada en el conjunto."}</span></div>
      {!readOnly && <button onClick={() => onToast(`Registrar ${singular}`, "open")}>+ Nuevo {singular}</button>}
    </div>

    {editingUser && <form className="panel report-form" onSubmit={saveUser}>
      <h3>Editar usuario</h3>
      <div className="dynamic-fields">
        <label htmlFor="user-name"><span>Nombre</span><input id="user-name" value={userForm.nombre} onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })} required maxLength={200} /></label>
        <label htmlFor="user-email"><span>Correo</span><input id="user-email" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required maxLength={200} /></label>
        <label htmlFor="user-role"><span>Tipo de rol</span><select id="user-role" value={userForm.role_id} onChange={(event) => setUserForm({ ...userForm, role_id: event.target.value })} required>
          <option value="" disabled>Selecciona un rol</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}
        </select></label>
        <label htmlFor="user-property"><span>Residencial</span><select id="user-property" value={userForm.residencial_id} onChange={(event) => setUserForm({ ...userForm, residencial_id: event.target.value })}>
          <option value="">Sin residencial</option>{residenciales.map((property) => <option key={property.id} value={property.id}>{property.nombre}</option>)}
        </select></label>
      </div>
      <div className="form-actions"><button type="button" onClick={() => setEditingUser(null)} disabled={savingUser}>Cancelar</button><button type="submit" disabled={savingUser}>{savingUser ? "Guardando…" : "Guardar cambios"}</button></div>
    </form>}

    {propertyMaintenance && <form className="panel report-form" onSubmit={saveMaintenanceProperty}>
      <h3>Asignar propiedad al mantenimiento</h3>
      <p className="form-note">{propertyMaintenance.item.tipo ?? "Mantenimiento"} · {propertyMaintenance.item.descripcion}</p>
      <label htmlFor="maintenance-property"><span>Propiedad / Residencial</span>
        <select id="maintenance-property" value={maintenancePropertyId} onChange={(event) => setMaintenancePropertyId(event.target.value)} required>
          <option value="" disabled>Selecciona una propiedad</option>
          {maintenancePropertyOptions.map((property) => <option key={property.id} value={property.id}>{property.nombre}</option>)}
        </select>
      </label>
      <div className="form-actions">
        <button type="button" onClick={() => setPropertyMaintenance(null)} disabled={savingMaintenanceProperty}>Cancelar</button>
        <button type="submit" disabled={savingMaintenanceProperty || !maintenancePropertyId}>{savingMaintenanceProperty ? "Guardando…" : "Guardar propiedad"}</button>
      </div>
    </form>}

    {technicianMaintenance && <form className="panel report-form" onSubmit={saveMaintenanceTechnician}>
      <h3>Asignar técnico al mantenimiento</h3>
      <p className="form-note">{technicianMaintenance.item.tipo ?? "Mantenimiento"} · {technicianMaintenance.item.descripcion}</p>
      <label htmlFor="maintenance-technician"><span>Técnico</span>
        <select id="maintenance-technician" value={maintenanceTechnicianId} onChange={(event) => setMaintenanceTechnicianId(event.target.value)}>
          <option value="">N/A · Sin técnico asignado</option>
          {technicianOptions.map((technician) => <option key={technician.id} value={technician.id}>{technician.nombre}{technician.email ? ` · ${technician.email}` : ""}</option>)}
        </select>
      </label>
      {!technicianOptions.length && <p className="form-note">No hay usuarios activos con rol de técnico. Agrega un usuario con ese rol para asignarlo.</p>}
      <div className="form-actions">
        <button type="button" onClick={() => setTechnicianMaintenance(null)} disabled={savingTechnician}>Cancelar</button>
        <button type="submit" disabled={savingTechnician}>{savingTechnician ? "Guardando…" : "Guardar técnico"}</button>
      </div>
    </form>}

    {maintenanceInvoices && <section className="panel maintenance-invoices-panel">
      <div className="panel-title"><div><h3>Facturas del mantenimiento #{maintenanceInvoices.id}</h3><p>{maintenanceInvoices.tipo || "Documentos asociados manualmente"}</p></div><button type="button" onClick={() => setMaintenanceInvoices(null)}>Cerrar</button></div>
      {maintenanceInvoices.invoices.length ? <ul className="maintenance-invoice-list">{maintenanceInvoices.invoices.map((invoice) => <li key={invoice.id}><div><strong>{invoice.nombre_original}</strong><span>{invoice.proveedor || "Proveedor sin detectar"} · {invoice.numero_factura || "Sin número"}</span></div><a href={getOriginalFacturaUrl(invoice.id)} target="_blank" rel="noreferrer">Abrir factura</a></li>)}</ul> : <p>Este mantenimiento todavía no tiene facturas asociadas.</p>}
    </section>}

    <section className="panel">
      {error && <p className="load-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p className="table-loading">Cargando información…</p> : <DataTable columns={headers[type] ?? []} rows={rows} renderCell={type === "mantenimientos" && !readOnly ? renderMaintenanceCell : undefined} renderActions={readOnly ? undefined : type === "pagos" ? paymentActions : type === "propietarios" ? userActions : type === "mantenimientos" ? maintenanceRowActions : undefined} />}
    </section>
  </section>;
}
