const API_BASE_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function requestResource(path, options = {}, timeoutMs = 12000) {
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? {
          "Content-Type": "application/json"
        } : {}),
        ...options.headers
      }
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Tiempo de espera agotado al consultar ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let message = `Error ${response.status} al consultar ${path}`;

    try {
      const payload = await response.json();

      if (payload?.error) {
        message = payload.error;
      }
    } catch {}

    throw new Error(message);
  }

  return response.json();


}


// GET
export const getResidenciales = () =>
  requestResource("/residenciales");

export const getAllAverias = () =>
  requestResource("/averias")


// POST
export const createResidencial = (data) =>
  requestResource("/residenciales", {
    method: "POST",
    body: JSON.stringify(data)
  });

export const addNewAveria = (data) =>
  requestResource("/reportaverias", {
    method: "POST",
    body: JSON.stringify(data)
  });


// PUT
export const updateResidencial = (id, data) =>
  requestResource(`/residenciales/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });


// DELETE
export const deleteResidencial = (id) =>
  requestResource(`/residenciales/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });

export const updatePago = (id, data) =>
  requestResource(`/pagos/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });

export const deletePago = (id) =>
  requestResource(`/pagos/${encodeURIComponent(id)}`, { 
    method: "DELETE" 
  });


export const getRoles = () => requestResource("/roles");

export const updateUsuario = (id, data) =>
  requestResource(`/propietarios/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });

export const deleteUsuario = (id) =>
  requestResource(`/propietarios/${encodeURIComponent(id)}`, { method: "DELETE" });


export const getAreasSociales = () => requestResource("/areas-sociales");

export const createAreaSocial = (data) =>
  requestResource("/areas-sociales", { method: "POST", body: JSON.stringify(data) });

export const updateAreaSocial = (id, data) =>
  requestResource("/areas-sociales/" + encodeURIComponent(id), { method: "PUT", body: JSON.stringify(data) });

export const getAreaAvailability = (id, date) =>
  requestResource("/areas-sociales/" + encodeURIComponent(id) + "/disponibilidad?fecha=" + encodeURIComponent(date));

export const getAreaReservations = () => requestResource("/reservas");

export const createAreaReservation = (data) =>
  requestResource("/reservas", { method: "POST", body: JSON.stringify(data) });

export const reviewAreaReservation = (id, estado) =>
  requestResource("/reservas/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify({ estado }) });


export const previewInvoice = (file) => {
  if (!file) 
    return Promise.reject(new Error("Selecciona un archivo."
  ));
  if (file.size > 20 * 1024 * 1024) 
    return Promise.reject(new Error("El archivo supera el límite de 20 MB."
  ));
  return requestResource("/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-File-Type": file.type || "application/octet-stream" },
    body: file
  }, 90000);
};

export const getFacturas = (mantenimientoId) => {
  const query = mantenimientoId == null 
    ? "" 
    : `?mantenimiento_id=${encodeURIComponent(mantenimientoId)}`;
  return requestResource(`/facturas${query}`);
};

export const getMantenimientos = () => requestResource("/mantenimiento");

export const uploadFactura = (file) => requestResource("/facturas", {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-File-Type": file.type || "application/octet-stream" },
  body: file
}, 120000);

export const associateFactura = (id, mantenimientoId) => requestResource(`/facturas/${encodeURIComponent(id)}/mantenimiento`, {
  method: "PATCH",
  body: JSON.stringify({ mantenimiento_id: mantenimientoId })
});

export const getOriginalFacturaUrl = (id) => `${API_BASE_URL}/facturas/${encodeURIComponent(id)}/original`;


export const loginUser = (credentials) =>
  requestResource("/login", { 
    method: "POST", 
    body: JSON.stringify(credentials) 
    
  });

export const getCurrentUser = () => requestResource("/me");

export const logoutUser = () => requestResource("/logout", { method: "POST" });


export const api = (form, which, method = "POST") => {

  const getPaths = {
    propietarios: "/propietarios",
    pagos: "/pagos",
    mantenimientos: "/mantenimiento",
    averias: "/averias",
    proximosMantenimientos: "/nextmaintenance"
  };

  const postPaths = {
    propietarios: "/register",
    pagos: "/pagos",
    mantenimientos: "/maintenance"
  };

  const path = method === "GET" ? getPaths[which] : postPaths[which];

  if (!path) {
    throw new Error(`No existe una ruta ${method} para ${which}`);
  }

  return requestResource(path, method === "GET" ? {} : {
    method,
    body: JSON.stringify(form)
  });
};
