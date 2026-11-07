export const navigation = {
  inicio: { title: "Inicio", icon: "⌂" },
  propietarios: { title: "Usuarios", icon: "◉" },
  pagos: { title: "Pago de administración", icon: "$" },
  mantenimientos: { title: "Mantenimientos", icon: "⌁" },
  averias: { title: "Averías", icon: "⚠" },
  propiedades: {title: "Propiedades", icon: "◉" },
  areasSociales: { title: "Áreas sociales", icon: "⌂" },
  visitas: { title: "Gestión de visitas", icon: "☖" },
  documentos: { title: "Documentos", icon: "▤" }
};

// Vistas permitidas por rol; la primera es la de inicio. ADMIN ve todas.
export const roleViews = {
  SUPERVISOR: ["averias"],
  RESIDENTE: ["areasSociales", "visitas"],
  TECNICO: ["inicio", "mantenimientos"],
  FRONTDESK: ["visitas"],
};

export const roleLabels = {
  ADMIN: "Administrador",
  SUPERVISOR: "Supervisor",
  RESIDENTE: "Residente",
  TECNICO: "Técnico",
  FRONTDESK: "Recepción",
};

export const canView = (role, view) => Boolean(navigation[view])
  && (role === "ADMIN" || (roleViews[role] ?? roleViews.SUPERVISOR).includes(view));

export const homeView = (role) => role === "ADMIN" ? "inicio" : (roleViews[role] ?? roleViews.SUPERVISOR)[0];

export const headers = {
  propietarios: ["Usuario", "Residencial", "Apartamento", "Correo", "Tipo de rol"],
  pagos: ["Fecha", "Propietario", "Valor", "Número de factura", "Estado", "Apartamento"],
  mantenimientos: ["N.º", "Actividad", "Descripción", "Propiedad", "Creado el", "Fecha límite", "Estado", "Técnico", "Documentos"],
  historialMantenimientos: ["N.º", "Actividad", "Descripción", "Propiedad", "Fecha límite", "Cerrado el", "Estado", "Técnico", "Próximo mantenimiento"],
  novedades: ["Novedad", "Categoría", "Residencial", "Fecha", "Estado"],
};

export const endpoints = {
  propietarios: "/propietarios",
  pagos: "/pagos",
  mantenimientos: "/mantenimiento",
  averias: "/averias",
  proximosMantenimientos: "/nextmaintenance",
  residenciales: "/residenciales",
};

const dateFormatter = new Intl.DateTimeFormat("es-DO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Bogota"
});

export const formatDate = (value) => {
  if (value === null || value === undefined || value === "") return "—";

  const raw = value instanceof Date ? value.toISOString() : String(value).trim();

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  const sqlDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/);
  
  const normalized = dateOnly
    ? `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}T12:00:00.000Z`
    : sqlDateTime
      ? `${sqlDateTime[1]}T${sqlDateTime[2]}-05:00`
      : raw;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
};

export const asArray = (data) => {
  if (Array.isArray(data)) 
    return data;
  if (Array.isArray(data?.data)) 
    return data.data;
  if (Array.isArray(data?.rows)) 
    return data.rows;
  return [];
};

// Cada mantenimiento se identifica por su número (su id) en las tablas y en el selector
// de documentos, porque es lo más corto de buscar cuando hay cientos de registros.
export const maintenanceNumber = (id) => `#${id}`;

export const maintenanceLabel = (item) =>
  `${maintenanceNumber(item.id)} · ${item.tipo || item.descripcion || "Mantenimiento"}`;

export const toTableRows = (type, data) => 

  asArray(data).map((item) => {
    if (Array.isArray(item)) 
      return item;

  switch (type) {
    case "propietarios": return {
      id: item.id,
      item,
      cells: [item.nombre, item.res_nombre ?? "—", item.apartamento_nombre ?? "—", item.email, item.rol ?? "—"]
    };
    
    case "pagos": return {
      id: item.id ?? item.pago_id,
      item,
      cells: [
        formatDate(item.fecha_creacion ?? item.fecha),
        item.nombre ?? item.propietario,
        formatMoney(item.valor ?? item.monto),
        item.numero_factura ?? "—",
        item.estado ?? "Registrado",
        item.apartamento_nombre ?? "—"
      ]
    };

    case "mantenimientos": return {
      id: item.id,
      item,
      cells: [
        maintenanceNumber(item.id),
        item.tipo ?? item.actividad,
        item.descripcion,
        item.nombre_residencial ?? "Sin propiedad asignada",
        formatDate(item.fecha_creacion),
        formatDate(item.fecha_programada ?? item.fecha),
        item.estado_nombre ?? item.estado ?? item.estado_id,
        item.tecnico_nombre ?? "N/A",
        Number(item.documentos_count) ? `${item.documentos_count} ${Number(item.documentos_count) === 1 ? "documento" : "documentos"}` : "Sin documentos"
      ]
    };

    case "historialMantenimientos": return {
      id: item.id,
      item,
      cells: [
        maintenanceNumber(item.id),
        item.tipo ?? item.actividad,
        item.descripcion,
        item.nombre_residencial ?? "Sin propiedad asignada",
        formatDate(item.fecha_programada ?? item.fecha),
        formatDate(item.fecha_cierre),
        item.estado_nombre ?? item.estado ?? item.estado_id,
        item.tecnico_nombre ?? "N/A",
        item.siguiente_id ? "Programado" : "Sin programar"
      ]
    };

    case "averias": return {
      id: item.id,
      item,
      cells: [item.descripcion, item.categoria, item.nombre_residencial ?? "—", formatDate(item.fecha), item.estado ?? "Reportada"]
    };

    default: return Object.values(item);
  }
});

const paymentFormatter = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });
export const formatMoney = (value) => {
  const amount = Number(value);
  return `$${paymentFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
};
