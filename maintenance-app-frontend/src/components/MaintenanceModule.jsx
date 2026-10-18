import { useEffect, useState } from "react";
import { headers, navigation, toTableRows } from "../data/modules";
import {
  api,
  deletePago,
  deleteUsuario,
  getResidenciales,
  getRoles,
  updatePago,
  updateUsuario,
} from "../services/api";
import DataTable from "./DataTable";
import Form from "./form";

export default function MaintenanceModule({ type, onToast, objects }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ nombre: "", email: "", role_id: "", residencial_id: "" });
  const [roles, setRoles] = useState([]);
  const [residenciales, setResidenciales] = useState([]);
  const [savingUser, setSavingUser] = useState(false);
  const loading = rows === null;
  const singular = { propietarios: "usuario", pagos: "pago", mantenimientos: "mantenimiento" }[type] ?? "registro";

  const loadRows = async () => {
    const data = await api(null, type, "GET");
    setRows(toTableRows(type, data));
  };

  useEffect(() => {
    let active = true;
    api(null, type, "GET")
      .then((data) => { if (active) setRows(toTableRows(type, data)); })
      .catch((err) => { if (active) { setError(err.message); setRows([]); } });
    return () => { active = false; };
  }, [type]);

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

  if (objects === "open") return <Form type={type} showToast={onToast} objects={objects} />;

  return <section className="content">
    <div className="module-head">
      <div><p>ADMINISTRACIÓN</p><h2>{navigation[type]?.title ?? type}</h2><span>Gestiona la información registrada en el conjunto.</span></div>
      <button onClick={() => onToast(`Registrar ${singular}`, "open")}>+ Nuevo {singular}</button>
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

    <section className="panel">
      {error && <p className="load-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading ? <p className="table-loading">Cargando información…</p> : <DataTable columns={headers[type] ?? []} rows={rows} renderActions={type === "pagos" ? paymentActions : type === "propietarios" ? userActions : undefined} />}
    </section>
  </section>;
}
