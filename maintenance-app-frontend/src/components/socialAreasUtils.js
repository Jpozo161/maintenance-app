export const todayInBogota = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
}).format(new Date());

export const SOCIAL_AREA_NAMES = ["Salón Social", "Piscina", "Área de juegos", "Cancha Padel"];

export const timeValue = (value) => String(value || "").slice(0, 5);

export const areaPhoto = (area) => {
  const name = `${area?.nombre || ""} ${area?.descripcion || ""}`;

  if (/salón social|salon social/i.test(name)) {
    return "/social-areas/salonSocial.jpg.webp";
  }

  if (/piscina|alberca/i.test(name)) {
    return "/social-areas/piscina.avif";
  }

  return null;
};

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

export const bookingStateLabels = { APROBADA: "Aprobada", PENDIENTE: "Pendiente", RECHAZADA: "Rechazada" };
