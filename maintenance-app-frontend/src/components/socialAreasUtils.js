export const todayInBogota = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
}).format(new Date());

export const timeValue = (value) => String(value || "").slice(0, 5);

export const areaPhoto = (area) => /piscina|alberca/i.test(`${area?.nombre || ""} ${area?.descripcion || ""}`)
  ? "/social-areas/piscina.jpg"
  : null;

export const emptyArea = () => ({
  residencial_id: "",
  nombre: "",
  descripcion: "",
  hora_apertura: "08:00",
  hora_cierre: "20:00",
  intervalo_minutos: 60,
  activa: true,
});

export const areaColumns = ["Área social", "Residencial", "Horario", "Duración", "Estado"];
export const bookingColumns = ["Fecha", "Horario", "Área social", "Residente", "Estado"];
