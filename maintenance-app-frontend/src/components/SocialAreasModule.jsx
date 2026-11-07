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

  const areaActions = (row, close) => 
  <>
    <button 
      type="button" 
      role="menuitem" 
      onClick={() => { 
        close(); 
        social.editArea(row.item); 
      }}>
        Editar
    </button>

    <button 
      type="button" 
      role="menuitem" 
      onClick={() => { 
        close(); 
        social.toggleArea(row.item); 
        }}>

      {row.item.activa ? "Deshabilitar" : "Habilitar"}
    </button>

  </>;

  const bookingActions = (row, close) => 
    row.item.estado === "PENDIENTE" ? 
    <>
    <button 
      type="button" 
      role="menuitem" 
      onClick={() => { 
        close(); social.reviewBooking(row.item, "APROBADA"); 
      }}>
        Aprobar
    </button>

    <button 
      type="button" 
      role="menuitem" 
      className="danger" 
      onClick={() => { 
        close(); 
        social.reviewBooking(row.item, "RECHAZADA"); 
      }}>
        Rechazar
    </button>

  </> : <span role="status">
    Solicitud revisada
    </span>;

  // Columna Estado: amarillo si está pendiente, rojo si fue rechazada (aprobada queda en verde).
  const renderBookingCell = (row, columnIndex, value) => columnIndex === bookingColumns.length - 1
    ? <span className={`badge booking-status-${String(row.item.estado || "").toLowerCase()}`}>{value ?? "—"}</span>
    : undefined;

  return <section className="content social-areas-content">
    <div className="module-head">
      <div>
        <p>
          {isAdmin ? "ADMINISTRACIÓN" : "RESERVAS DEL RESIDENCIAL"}
        </p>

        <h2>
          Áreas sociales
        </h2>

        <span>
          {isAdmin ? "Configura espacios, horarios, solicitudes de reserva y reserva a nombre de los residentes." : "Consulta los espacios y solicita un horario disponible."}
        </span>

      </div>
    </div>

    {isAdmin && 
      <div 
        className="social-admin-tabs" 
        role="tablist" 
        aria-label="Secciones de áreas sociales">

      <button 
        type="button" 
        role="tab" 
        aria-selected={adminSection === "reservas"} 
        className={adminSection === "reservas" ? "active" : ""} 
        onClick={() => 
          setAdminSection("reservas")}>
            Vista de reservas
        </button>

      <button 
        type="button" 
        role="tab" 
        aria-selected={adminSection === "gestionar"} 
        className={adminSection === "gestionar" ? "active" : ""} 
        onClick={() => 
          setAdminSection("gestionar")}>
            Administrar áreas
      </button>

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
      {isAdmin && <section className="panel report-form social-section">
        <h3>Reservar a nombre de un residente</h3>
        <p className="form-note">La reserva queda aprobada a nombre del residente que elijas.</p>
        <div className="dynamic-fields">
          <label htmlFor="booking-residential"><span>Residencial</span>
            <select id="booking-residential" value={social.bookingResidencial} onChange={(event) => social.changeBookingResidencial(event.target.value)}>
              <option value="">Selecciona un residencial</option>
              {social.residenciales.map((residencial) => <option key={residencial.id} value={residencial.id}>{residencial.nombre}</option>)}
            </select>
          </label>
          <label htmlFor="booking-resident"><span>Residente</span>
            <select id="booking-resident" value={social.bookingResident} onChange={(event) => social.setBookingResident(event.target.value)} disabled={!social.bookingResidencial}>
              <option value="">{!social.bookingResidencial ? "Primero elige un residencial" : social.residents.length ? "Selecciona un residente" : "No hay residentes en este residencial"}</option>
              {social.residents.map((resident) => <option key={resident.id} value={resident.id}>{resident.nombre}</option>)}
            </select>
          </label>
        </div>
      </section>}
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
        canSubmit={!isAdmin || Boolean(social.bookingResident)}
        emptyMessage={isAdmin
          ? social.bookingResidencial ? "Este residencial todavía no tiene áreas sociales habilitadas." : "Selecciona un residencial para ver sus áreas sociales."
          : "Tu residencial todavía no tiene áreas sociales habilitadas."}
      />
      <section className="panel social-section">
        <div 
          className="panel-title">

          <div>
            <h3>
              {isAdmin ? "Solicitudes de reserva" : "Mis reservas"}
            </h3>

            <p>
              {isAdmin ? "Aprueba o rechaza las solicitudes pendientes." : "Consulta el estado de tus solicitudes."}
            </p>
            
            </div>
            
            </div>
        {social.loading ? <p className="table-loading">
          Cargando solicitudes…
          </p> : 
            <DataTable 
              columns={bookingColumns} 
              rows={social.bookingRows} 
              renderCell={renderBookingCell} 
              renderActions={isAdmin ? bookingActions : undefined} 
            />}
      </section>
    </>}
  </section>;
}
