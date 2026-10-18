import { useState } from "react";
import DataTable from "./DataTable";
import ResidentAreaBooking from "./ResidentAreaBooking";
import SocialAreasManagement from "./SocialAreasManagement";
import useSocialAreas from "./useSocialAreas";
import { bookingColumns, emptyArea } from "./socialAreasUtils";

export default function SocialAreasModule({ user }) {
  const isAdmin = user?.role === "ADMIN";
  const [adminSection, setAdminSection] = useState("reservas");
  const social = useSocialAreas(isAdmin);

  const areaActions = (row, close) => <>
    <button type="button" role="menuitem" onClick={() => { close(); social.editArea(row.item); }}>Editar</button>
    <button type="button" role="menuitem" onClick={() => { close(); social.toggleArea(row.item); }}>{row.item.activa ? "Deshabilitar" : "Habilitar"}</button>
  </>;

  const bookingActions = (row, close) => row.item.estado === "PENDIENTE" ? <>
    <button type="button" role="menuitem" onClick={() => { close(); social.reviewBooking(row.item, "APROBADA"); }}>Aprobar</button>
    <button type="button" role="menuitem" className="danger" onClick={() => { close(); social.reviewBooking(row.item, "RECHAZADA"); }}>Rechazar</button>
  </> : <span role="status">Solicitud revisada</span>;

  return <section className="content social-areas-content">
    <div className="module-head"><div>
      <p>{isAdmin ? "ADMINISTRACIÓN" : "RESERVAS DEL RESIDENCIAL"}</p>
      <h2>Áreas sociales</h2>
      <span>{isAdmin ? "Configura espacios, horarios y solicitudes de reserva." : "Consulta los espacios y solicita un horario disponible."}</span>
    </div></div>

    {isAdmin && <div className="social-admin-tabs" role="tablist" aria-label="Secciones de áreas sociales">
      <button type="button" role="tab" aria-selected={adminSection === "reservas"} className={adminSection === "reservas" ? "active" : ""} onClick={() => setAdminSection("reservas")}>Vista de reservas</button>
      <button type="button" role="tab" aria-selected={adminSection === "gestionar"} className={adminSection === "gestionar" ? "active" : ""} onClick={() => setAdminSection("gestionar")}>Administrar áreas</button>
    </div>}

    {social.error && <p className="load-error" role="alert">{social.error}</p>}
    {social.notice && <p className="social-notice" role="status">{social.notice}</p>}

    {isAdmin && adminSection === "gestionar" && <SocialAreasManagement
      editingId={social.editingId}
      areaForm={social.areaForm}
      setAreaForm={social.setAreaForm}
      residenciales={social.residenciales}
      saving={social.saving}
      onSubmit={social.saveArea}
      onCancel={() => { social.setEditingId(null); social.setAreaForm(emptyArea()); }}
      loading={social.loading}
      columns={social.areaColumns}
      rows={social.areaRows}
      renderActions={areaActions}
    />}

    {(!isAdmin || adminSection === "reservas") && <>
      <ResidentAreaBooking
        areas={social.activeAreas}
        area={social.selectedAreaData}
        areaId={social.selectedArea}
        onAreaChange={(value) => { social.setSelectedArea(value); social.setSelectedSlot(null); }}
        loading={social.loading}
        date={social.date}
        onDateChange={(value) => { social.setDate(value); social.setSelectedSlot(null); }}
        weekDays={social.weekDays}
        weekAvailability={social.weekAvailability}
        slots={social.slots}
        selectedSlot={social.selectedSlot}
        onSelectSlot={social.setSelectedSlot}
        onSubmit={social.submitSelectedBooking}
        saving={social.saving}
        isAdmin={isAdmin}
      />
      <section className="panel social-section">
        <div className="panel-title"><div><h3>{isAdmin ? "Solicitudes de reserva" : "Mis reservas"}</h3><p>{isAdmin ? "Aprueba o rechaza las solicitudes pendientes." : "Consulta el estado de tus solicitudes."}</p></div></div>
        {social.loading ? <p className="table-loading">Cargando solicitudes…</p> : <DataTable columns={bookingColumns} rows={social.bookingRows} renderActions={isAdmin ? bookingActions : undefined} />}
      </section>
    </>}
  </section>;
}
