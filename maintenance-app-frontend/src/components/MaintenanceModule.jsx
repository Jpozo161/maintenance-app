import { useEffect, useRef, useState } from "react";
import { asArray, formatDate, headers, navigation, toTableRows } from "../data/modules";
import {
  api,
  createNextMaintenance,
  deleteMaintenance,
  deletePago,
  deleteUsuario,
  getApartamentos,
  getResidenciales,
  getRoles,
  getDocumentos,
  getDocumentoUrl,
  getMaintenanceStatuses,
  getMantenimientos,
  getTechnicians,
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

// Debe coincidir con ESTADOS_MANTENIMIENTO.COMPLETADO y CANCELADO: al elegirlos el mantenimiento pasa al historial.
const CLOSED_MAINTENANCE_STATUS_IDS = [3, 4];
// Debe coincidir con OPCIONES_MESES_SIGUIENTE del backend.
const nextMaintenanceOptions = [
  { value: 1, label: "1 mes" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
];

export default function MaintenanceModule({ type, onToast, objects, readOnly = false }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ nombre: "", email: "", role_id: "", residencial_id: "", apartamento_id: "" });
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ nombre: "", monto: "", numero_factura: "", residencial_id: "", apartamento_id: "" });
  const [savingPayment, setSavingPayment] = useState(false);

  // Apartamentos del residencial elegido en el panel de edición de usuario o de pago.
  const [apartamentoOptions, setApartamentoOptions] = useState([]);
  const [roles, setRoles] = useState([]);
  const [residenciales, setResidenciales] = useState([]);
  const [savingUser, setSavingUser] = useState(false);
  const [maintenanceDocuments, setMaintenanceDocuments] = useState(null);
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

  // Mantenimiento cerrado (fila del historial) a partir del cual se creará el próximo.
  const [nextMaintenance, setNextMaintenance] = useState(null);
  const [nextMaintenanceMonths, setNextMaintenanceMonths] = useState("3");
  const [savingNextMaintenance, setSavingNextMaintenance] = useState(false);

  // Evita envíos repetidos antes de que el botón se deshabilite (doble clic o Enter repetido).
  const submittingNextMaintenance = useRef(false);

  // Pestañas del módulo de mantenimientos: "activos" o "historial".
  const [maintenanceView, setMaintenanceView] = useState("activos");
  const isMaintenance = type === "mantenimientos";
  const isHistory = isMaintenance && maintenanceView === "historial";
  const tableType = isHistory ? "historialMantenimientos" : type;
  const loading = rows === null;
  const singular = { propietarios: "usuario", pagos: "pago", mantenimientos: "mantenimiento" }[type] ?? "registro";

  const fetchRows = () => isMaintenance ? getMantenimientos(maintenanceView) : api(null, type, "GET");

  const loadRows = async () => {
    const data = await fetchRows();
    setRows(toTableRows(tableType, data));
  };

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(fetchRows)
      .then((data) => { if (active) setRows(toTableRows(tableType, data)); })
      .catch((err) => { if (active) { setError(err.message); setRows([]); } });
    return () => { active = false; };

    // fetchRows y tableType dependen solo de type y maintenanceView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, maintenanceView]);

  const changeMaintenanceView = (view) => {
    if (view === maintenanceView) return;
    setMaintenanceView(view);
    setRows(null); setError(""); setNotice("");
    setNextMaintenance(null); setPropertyMaintenance(null); setTechnicianMaintenance(null); setMaintenanceDocuments(null);
  };

  useEffect(() => {
    if (type !== "mantenimientos" || readOnly) return undefined;
    let active = true;
    getMaintenanceStatuses()
      .then((data) => { if (active) setMaintenanceStatuses(Array.isArray(data) ? data : data?.data ?? []); })
      .catch((err) => { if (active) setError(`No se pudieron cargar los estados: ${err.message}`); });
    return () => { active = false; };
  }, [type, readOnly]);

  const loadApartamentoOptions = async (residencialId) => {
    setApartamentoOptions([]);
    if (!residencialId) return;
    try {
      const data = await getApartamentos(residencialId);
      setApartamentoOptions(Array.isArray(data) ? data : data?.data ?? []);
    } catch (err) { setError(`No se pudieron cargar los apartamentos: ${err.message}`); }
  };

  const editPayment = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del pago."); return; }
    try {
      setError(""); setNotice("");
      const propertyOptions = await getResidenciales();
      setResidenciales(Array.isArray(propertyOptions) ? propertyOptions : propertyOptions?.data ?? []);
      await loadApartamentoOptions(row.item.residencial_id);
      setEditingPayment(row.item);
      setPaymentForm({
        nombre: row.item.nombre ?? "",
        monto: String(row.item.monto ?? row.item.valor ?? ""),
        numero_factura: row.item.numero_factura ?? "",
        residencial_id: String(row.item.residencial_id ?? ""),
        apartamento_id: String(row.item.apartamento_id ?? ""),
      });
    } catch (err) { setError(`No se pudieron cargar los residenciales: ${err.message}`); }
  };

  const savePayment = async (event) => {
    event.preventDefault();
    if (!editingPayment?.id) return;
    const monto = Number(paymentForm.monto);
    if (!paymentForm.nombre.trim() || !Number.isInteger(monto) || monto < 0) {
      setError("Ingresa un propietario y un valor válido (número entero).");
      return;
    }
    setSavingPayment(true); setError(""); setNotice("");
    try {
      await updatePago(editingPayment.id, {
        nombre: paymentForm.nombre.trim(),
        monto,
        numero_factura: paymentForm.numero_factura.trim() || null,
        apartamento_id: paymentForm.apartamento_id ? Number(paymentForm.apartamento_id) : null,
      });
      setEditingPayment(null);
      await loadRows();
      setNotice("Pago actualizado correctamente.");
    } catch (err) { setError(`No se pudo actualizar el pago: ${err.message}`); }
    finally { setSavingPayment(false); }
  };

  const deletePayment = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del pago."); return; }
    if (!window.confirm(`¿Eliminar el pago de ${row.item.nombre ?? "este propietario"}?`)) return;
    try {
      setError(""); setNotice("");
      await deletePago(row.id);
      if (editingPayment?.id === row.id) setEditingPayment(null);
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
      await loadApartamentoOptions(row.item.residencial_id);
      setEditingUser(row.item);
      setUserForm({
        nombre: row.item.nombre ?? "",
        email: row.item.email ?? "",
        role_id: String(row.item.role_id ?? ""),
        residencial_id: String(row.item.residencial_id ?? ""),
        apartamento_id: String(row.item.apartamento_id ?? ""),
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
        apartamento_id: userForm.residencial_id && userForm.apartamento_id ? Number(userForm.apartamento_id) : null,
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

  const openMaintenanceDocuments = async (row) => {
    setError("");
    try {
      const documents = await getDocumentos(row.id);
      setMaintenanceDocuments({ id: row.id, tipo: row.item.tipo ?? row.item.descripcion, documents: asArray(documents) });
    } catch (err) { 
      setError(`No se pudieron cargar los documentos del mantenimiento: ${err.message}`); }
  };

  const openNextMaintenance = (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del mantenimiento."); return; }
    setError(""); setNotice("");
    // El usuario debe elegir el intervalo explícitamente.
    setNextMaintenanceMonths("");
    setNextMaintenance({ row });
  };

  const saveNextMaintenance = async (event) => {
    event.preventDefault();
    if (!nextMaintenance?.row.id || !nextMaintenanceMonths || submittingNextMaintenance.current) return;
    const months = Number(nextMaintenanceMonths);
    submittingNextMaintenance.current = true;
    setSavingNextMaintenance(true); setError(""); setNotice("");
    try {
      const created = await createNextMaintenance(nextMaintenance.row.id, months);
      setNextMaintenance(null);
      await loadRows();
      setNotice(`Se creó el mantenimiento #${created.id} en estado programado para el ${formatDate(created.fecha_programada)}. Ya aparece en «Mantenimientos programados».`);
    } catch (err) { setError(`No se pudo programar el próximo mantenimiento: ${err.message}`); }
    finally { submittingNextMaintenance.current = false; setSavingNextMaintenance(false); }
  };

  const removeMaintenance = async (row) => {
    if (row.id == null) { setError("El API no devolvió el identificador del mantenimiento."); return; }
    const name = row.item.tipo ?? row.item.descripcion ?? "este mantenimiento";
    if (!window.confirm(`¿Eliminar “${name}” de la lista? El historial y los documentos se conservarán.`)) return;
    try {
      setError(""); setNotice("");
      await deleteMaintenance(row.id);
      await loadRows();
      setNotice("Mantenimiento eliminado de la lista; su historial y documentos se conservaron.");
    } catch (err) { setError(`No se pudo eliminar el mantenimiento: ${err.message}`); }
  };

  const changeMaintenanceStatus = async (row, statusId) => {
    if (row.id == null || !statusId) return;
    setSavingStatusId(row.id); setError(""); setNotice("");
    try {
      await updateMaintenanceStatus(row.id, Number(statusId));
      await loadRows();
      const status = maintenanceStatuses.find((item) => Number(item.id) === Number(statusId));
      const closed = CLOSED_MAINTENANCE_STATUS_IDS.includes(Number(statusId));
      setNotice(`Estado actualizado a “${status?.nombre ?? "nuevo estado"}”.${closed ? " El mantenimiento pasó al historial." : ""}`);
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
    } catch (err) { 
      setError(`No se pudieron cargar las propiedades: ${err.message}`); }
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
    <button type="button" role="menuitem" onClick={() => { close(); openMaintenanceDocuments(row); }}>Ver documentos</button>
    <button type="button" role="menuitem" onClick={() => { close(); assignMaintenanceProperty(row); }}>{row.item.residencial_id ? "Cambiar propiedad" : "Asignar propiedad"}</button>
    <button type="button" role="menuitem" onClick={() => { close(); assignMaintenanceTechnician(row); }}>{row.item.tecnico_id ? "Cambiar técnico" : "Asignar técnico"}</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); removeMaintenance(row); }}>Eliminar</button>
  </>;

  const historyRowActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); openMaintenanceDocuments(row); }}>Ver documentos</button>
    {row.item.siguiente_id
      ? <span className="row-action-hint">Próximo mantenimiento ya programado</span>
      : <button type="button" role="menuitem" onClick={() => { close(); openNextMaintenance(row); }}>Próximo mantenimiento…</button>}
  </>;

  // El estado es editable en la tabla: su columna va después del número, la actividad,
  // la descripción, la propiedad y las dos fechas.
  const renderMaintenanceCell = (row, columnIndex) => columnIndex === 6 ? (
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
      <div>
        <p>
          {readOnly ? "CONSULTA" : "ADMINISTRACIÓN"}
        </p>

        <h2>
          {navigation[type]?.title ?? type}
        </h2>

        <span>
          {readOnly 
            ? "Consulta los mantenimientos del conjunto." 
            : "Gestiona la información registrada en el conjunto."}
            
        </span>
      </div>

      {!readOnly && 
        <button 
          onClick={() => onToast(`Registrar ${singular}`, "open")}>
            + Nuevo {singular}
        </button>}
    </div>

    {isMaintenance && <div className="social-admin-tabs" role="tablist" aria-label="Secciones de mantenimientos">
      <button type="button" role="tab" aria-selected={!isHistory} className={!isHistory ? "active" : ""} onClick={() => changeMaintenanceView("activos")}>Mantenimientos programados</button>
      <button type="button" role="tab" aria-selected={isHistory} className={isHistory ? "active" : ""} onClick={() => changeMaintenanceView("historial")}>Historial de mantenimientos</button>
    </div>}

    {editingUser && <form className="panel report-form" onSubmit={saveUser}>
      <h3>Editar usuario</h3>
      <div className="dynamic-fields">
        <label htmlFor="user-name"><span>Nombre</span><input id="user-name" value={userForm.nombre} onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })} required maxLength={200} /></label>
        <label htmlFor="user-email"><span>Correo</span><input id="user-email" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required maxLength={200} /></label>
        <label htmlFor="user-role"><span>Tipo de rol</span><select id="user-role" value={userForm.role_id} onChange={(event) => setUserForm({ ...userForm, role_id: event.target.value })} required>
          <option value="" disabled>Selecciona un rol</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.nombre}</option>)}
        </select></label>
        <label htmlFor="user-property"><span>Residencial</span><select id="user-property" value={userForm.residencial_id} onChange={(event) => { setUserForm({ ...userForm, residencial_id: event.target.value, apartamento_id: "" }); loadApartamentoOptions(event.target.value); }}>
          <option value="">Sin residencial</option>{residenciales.map((property) => <option key={property.id} value={property.id}>{property.nombre}</option>)}
        </select></label>
        <label htmlFor="user-apartment"><span>Apartamento</span><select id="user-apartment" value={userForm.apartamento_id} onChange={(event) => setUserForm({ ...userForm, apartamento_id: event.target.value })} disabled={!userForm.residencial_id}>
          <option value="">{userForm.residencial_id ? "Sin apartamento" : "Primero selecciona el residencial"}</option>{apartamentoOptions.map((apartamento) => <option key={apartamento.id} value={apartamento.id}>{apartamento.nombre} · {apartamento.tipo}</option>)}
        </select></label>
      </div>
      <div className="form-actions"><button type="button" onClick={() => setEditingUser(null)} disabled={savingUser}>Cancelar</button><button type="submit" disabled={savingUser}>{savingUser ? "Guardando…" : "Guardar cambios"}</button></div>
    </form>}

    {editingPayment && <form className="panel report-form" onSubmit={savePayment}>
      <h3>Editar pago</h3>
      <div className="dynamic-fields">
        <label htmlFor="payment-name"><span>Propietario</span><input id="payment-name" value={paymentForm.nombre} onChange={(event) => setPaymentForm({ ...paymentForm, nombre: event.target.value })} required maxLength={100} /></label>
        <label htmlFor="payment-amount"><span>Valor</span><input id="payment-amount" type="number" min="0" step="1" value={paymentForm.monto} onChange={(event) => setPaymentForm({ ...paymentForm, monto: event.target.value })} required /></label>
        <label htmlFor="payment-invoice"><span>Número de factura (opcional)</span><input id="payment-invoice" value={paymentForm.numero_factura} onChange={(event) => setPaymentForm({ ...paymentForm, numero_factura: event.target.value })} maxLength={120} placeholder="Ej.: FAC-0001" /></label>
        <label htmlFor="payment-property"><span>Residencial</span><select id="payment-property" value={paymentForm.residencial_id} onChange={(event) => { setPaymentForm({ ...paymentForm, residencial_id: event.target.value, apartamento_id: "" }); loadApartamentoOptions(event.target.value); }}>
          <option value="">Sin residencial</option>{residenciales.map((property) => <option key={property.id} value={property.id}>{property.nombre}</option>)}
        </select></label>
        <label htmlFor="payment-apartment"><span>Apartamento (opcional)</span><select id="payment-apartment" value={paymentForm.apartamento_id} onChange={(event) => setPaymentForm({ ...paymentForm, apartamento_id: event.target.value })} disabled={!paymentForm.residencial_id}>
          <option value="">{paymentForm.residencial_id ? "Sin apartamento" : "Primero selecciona el residencial"}</option>{apartamentoOptions.map((apartamento) => <option key={apartamento.id} value={apartamento.id}>{apartamento.nombre} · {apartamento.tipo}</option>)}
        </select></label>
      </div>
      <div className="form-actions"><button type="button" onClick={() => setEditingPayment(null)} disabled={savingPayment}>Cancelar</button><button type="submit" disabled={savingPayment}>{savingPayment ? "Guardando…" : "Guardar cambios"}</button></div>
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

    {nextMaintenance && <form className="panel report-form" onSubmit={saveNextMaintenance}>
      <h3>Programar próximo mantenimiento</h3>
      <p className="form-note">{nextMaintenance.row.item.tipo ?? "Mantenimiento"} · {nextMaintenance.row.item.descripcion}</p>
      <label htmlFor="next-maintenance-months"><span>¿Cada cuánto tiempo será el próximo mantenimiento?</span>
        <select id="next-maintenance-months" value={nextMaintenanceMonths} onChange={(event) => setNextMaintenanceMonths(event.target.value)} required>
          <option value="" disabled>Selecciona un intervalo</option>
          {nextMaintenanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p className="form-note">Se creará un mantenimiento nuevo en estado programado con la misma actividad, descripción, propiedad y técnico. La fecha se calcula desde el cierre ({formatDate(nextMaintenance.row.item.fecha_cierre)}). El registro original se conserva en el historial.</p>
      <div className="form-actions">
        <button type="button" onClick={() => setNextMaintenance(null)} disabled={savingNextMaintenance}>Cancelar</button>
        <button type="submit" disabled={savingNextMaintenance || !nextMaintenanceMonths}>{savingNextMaintenance ? "Guardando…" : "Crear mantenimiento"}</button>
      </div>
    </form>}

    {maintenanceDocuments && <section className="panel maintenance-documents-panel">
      <div className="panel-title"><div><h3>Documentos del mantenimiento #{maintenanceDocuments.id}</h3><p>{maintenanceDocuments.tipo || "Documentos asociados manualmente"}</p></div><button type="button" onClick={() => setMaintenanceDocuments(null)}>Cerrar</button></div>
      {maintenanceDocuments.documents.length ? <ul className="maintenance-document-list">{maintenanceDocuments.documents.map((document) => <li key={document.id}><div><strong>{document.nombre_original}</strong><span>Subido el {formatDate(document.created_at)}{document.subido_por_nombre ? ` por ${document.subido_por_nombre}` : ""}</span></div><div><a href={getDocumentoUrl(document.id, "ver")} target="_blank" rel="noreferrer">Ver</a><a href={getDocumentoUrl(document.id, "descargar")}>Descargar</a></div></li>)}</ul> : <p>Este mantenimiento todavía no tiene documentos. Súbelos desde la sección Documentos.</p>}
    </section>}

    <section className="panel">
      {error && <p className="load-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p className="table-loading">Cargando información…</p> : <DataTable key={tableType} columns={headers[tableType] ?? []} rows={rows} renderCell={isMaintenance && !isHistory && !readOnly ? renderMaintenanceCell : undefined} renderActions={readOnly ? undefined : type === "pagos" ? paymentActions : type === "propietarios" ? userActions : isHistory ? historyRowActions : isMaintenance ? maintenanceRowActions : undefined} />}
    </section>
  </section>;
}
