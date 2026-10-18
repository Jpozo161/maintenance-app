import { areaPhoto, timeValue, todayInBogota } from "./socialAreasUtils";

export default function ResidentAreaBooking({
  areas, area, areaId, onAreaChange, loading, date, onDateChange, weekDays,
  weekAvailability, slots, selectedSlot, onSelectSlot, onSubmit, saving, isAdmin,
}) {
  if (loading) return <section className="panel social-section"><p className="table-loading">Cargando áreas sociales…</p></section>;
  if (!areas.length) return <section className="panel social-section"><p>Tu residencial todavía no tiene áreas sociales habilitadas.</p></section>;
  if (!area) return null;

  const photo = areaPhoto(area);

  return <section className="resident-reservation panel">
    <div className="resident-reservation-heading"><span>RESERVAS DEL RESIDENCIAL</span><h3>Reservar un espacio</h3><p>Elige un área, un día y un horario disponible.</p></div>
    <label className="resident-area-picker" htmlFor="resident-area"><span>Área social</span><select id="resident-area" value={areaId} onChange={(event) => onAreaChange(event.target.value)}>
      {areas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
    </select></label>

    <article className="resident-area-feature">
      {photo ? <img src={photo} alt={`Foto de ${area.nombre}`} /> : <div className="resident-area-photo-placeholder" role="img" aria-label={`Foto pendiente para ${area.nombre}`}><span>Foto del área pendiente</span></div>}
      <div className="resident-area-feature-copy"><h4>{area.nombre}</h4>
        <p className="resident-area-description">{area.descripcion || "Área social de tu residencial."}</p>
        <p className="resident-area-hours">Disponible de {timeValue(area.hora_apertura)} a {timeValue(area.hora_cierre)} · Turnos de {area.intervalo_minutos} minutos</p>
      </div>
    </article>

    <div className="social-date-select">
      <div className="social-date-heading"><div><h4>Elige un día</h4><p>Las fechas completas aparecen atenuadas.</p></div><label htmlFor="social-date" className="social-date-custom">Otra fecha <input id="social-date" type="date" min={todayInBogota()} value={date} onChange={(event) => onDateChange(event.target.value)} /></label></div>
      <div className="social-date-strip">{weekDays.map(({ value, date: day }) => {
        const unavailable = weekAvailability[value]?.full;
        const selected = date === value;
        return <button type="button" key={value} className={`social-date-chip${selected ? " selected" : ""}${unavailable ? " full" : ""}`} disabled={unavailable && !selected} onClick={() => onDateChange(value)} aria-label={`${day.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}${unavailable ? ", completo" : ""}`}>
          <strong>{day.toLocaleDateString("es-CO", { day: "numeric" })}</strong><span>{day.toLocaleDateString("es-CO", { weekday: "short" })}</span>{unavailable && <small>Completo</small>}
        </button>;
      })}</div>
    </div>

    <div className="resident-hours-heading"><h4>Horarios</h4><p>Toca una hora para seleccionarla.</p></div>
    <div className="social-slots">
      {slots.map((slot) => <button type="button" key={slot.hora_inicio} disabled={!slot.disponible || saving} className={`${slot.disponible ? "available" : "occupied"}${selectedSlot?.hora_inicio === slot.hora_inicio ? " selected" : ""}`} onClick={() => onSelectSlot(slot)}>
        <strong>{timeValue(slot.hora_inicio)}</strong><span>{timeValue(slot.hora_fin)}</span>
      </button>)}
      {!slots.length && <p className="resident-no-slots">No hay horarios para esta fecha.</p>}
    </div>
    <small className="social-hint">Las solicitudes quedan pendientes hasta que el administrador las apruebe.</small>
    <div className="social-booking-summary"><div><strong>{selectedSlot ? `${timeValue(selectedSlot.hora_inicio)} – ${timeValue(selectedSlot.hora_fin)}` : "Selecciona un horario"}</strong><span>{new Date(`${date}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })} · {area.nombre}</span></div><button type="button" onClick={onSubmit} disabled={isAdmin || !selectedSlot || saving}>{isAdmin ? "Solo residentes pueden reservar" : saving ? "Enviando…" : "Solicitar reserva"}</button></div>
  </section>;
}
