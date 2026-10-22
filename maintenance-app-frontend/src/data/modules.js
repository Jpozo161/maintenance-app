export const navigation = {
  inicio: { title: "Inicio", icon: "⌂" },
  propietarios: { title: "Usuarios", icon: "◉" },
  pagos: { title: "Pagos", icon: "$" },
  mantenimientos: { title: "Mantenimientos", icon: "⌁" },
  averias: { title: "Averías", icon: "⚠" },
  propiedades: {title: "Propiedades", icon: "◉" },
  areasSociales: { title: "Áreas sociales", icon: "⌂" },
  ocr: { title: "Facturas", icon: "▤" }
};

export const headers = {
  propietarios: ["Usuario", "Residencial", "Correo", "Tipo de rol"],
  pagos: ["Fecha", "Propietario", "Valor", "Estado"],
  mantenimientos: ["Actividad", "Descripción", "Propiedad", "Creado el", "Fecha límite", "Estado", "Técnico", "Facturas"],
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

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
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

export const toTableRows = (type, data) => 

  asArray(data).map((item) => {
    if (Array.isArray(item)) 
      return item;

  switch (type) {
    case "propietarios": return {
      id: item.id,
      item,
      cells: [item.nombre, item.res_nombre ?? "—", item.email, item.rol ?? "—"]
    };
    
    case "pagos": return {
      id: item.id ?? item.pago_id,
      item,
      cells: [
        formatDate(item.fecha_creacion ?? item.fecha),
        item.nombre ?? item.propietario,
        formatMoney(item.valor ?? item.monto),
        item.estado ?? "Registrado"
      ]
    };

    case "mantenimientos": return {
      id: item.id,
      item,
      cells: [
        item.tipo ?? item.actividad,
        item.descripcion,
        item.nombre_residencial ?? "Sin propiedad asignada",
        formatDate(item.fecha_creacion),
        formatDate(item.fecha_programada ?? item.fecha),
        item.estado_nombre ?? item.estado ?? item.estado_id,
        item.tecnico_nombre ?? "N/A",
        Number(item.facturas_count) ? `${item.facturas_count} ${Number(item.facturas_count) === 1 ? "factura" : "facturas"}` : "Sin facturas"
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

const paymentFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
export const formatMoney = (value) => {
  const amount = Number(value);
  return `$${paymentFormatter.format(Number.isFinite(amount) ? amount : 0)}`;
};
