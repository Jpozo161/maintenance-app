import DataTable from "./DataTable";

export default function SocialAreasManagement({
  editingId, areaForm, setAreaForm, residenciales, saving, onSubmit, onCancel,
  loading, columns, rows, renderActions,
}) {
  return <>
    <form className="panel report-form social-area-form" onSubmit={onSubmit}>
      <h3>{editingId ? "Editar área social" : "Registrar área social"}</h3>
      <div className="dynamic-fields">
        <label><span>Residencial</span><select required value={areaForm.residencial_id} onChange={(event) => setAreaForm({ ...areaForm, residencial_id: event.target.value })}>
          <option value="">Selecciona un residencial</option>
          {residenciales.map((residential) => <option key={residential.id} value={residential.id}>{residential.nombre}</option>)}
        </select></label>
        <label><span>Nombre del área</span><input required maxLength={150} placeholder="Piscina, salón social…" value={areaForm.nombre} onChange={(event) => setAreaForm({ ...areaForm, nombre: event.target.value })} /></label>
        <label className="social-description-field"><span>Descripción</span><input placeholder="Descripción breve" value={areaForm.descripcion} onChange={(event) => setAreaForm({ ...areaForm, descripcion: event.target.value })} /></label>
        <label><span>Apertura</span><input type="time" required value={areaForm.hora_apertura} onChange={(event) => setAreaForm({ ...areaForm, hora_apertura: event.target.value })} /></label>
        <label><span>Cierre</span><input type="time" required value={areaForm.hora_cierre} onChange={(event) => setAreaForm({ ...areaForm, hora_cierre: event.target.value })} /></label>
        <label><span>Duración del turno (minutos)</span><input type="number" min="15" max="720" step="15" required value={areaForm.intervalo_minutos} onChange={(event) => setAreaForm({ ...areaForm, intervalo_minutos: event.target.value })} /></label>
      </div>
      <div className="form-actions">
        {editingId && <button type="button" onClick={onCancel}>Cancelar</button>}
        <button type="submit" disabled={saving}>{saving ? "Guardando…" : editingId ? "Guardar cambios" : "Registrar área"}</button>
      </div>
    </form>
    <section className="panel social-section">
      <div className="panel-title"><div><h3>Áreas registradas</h3><p>Habilita o deshabilita cada espacio para solicitudes nuevas.</p></div></div>
      {loading ? <p className="table-loading">Cargando áreas…</p> : <DataTable columns={columns} rows={rows} renderActions={renderActions} />}
    </section>
  </>;
}
