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

export const getMaintenanceStatuses = () =>
  requestResource("/estados-mantenimiento");

export const getTechnicians = () =>
  requestResource("/tecnicos");

// Crea un mantenimiento nuevo a partir de uno completado o cancelado.
export const createNextMaintenance = (id, meses) =>
  requestResource(`/mantenimiento/${encodeURIComponent(id)}/siguiente`, {
    method: "POST",
    body: JSON.stringify({ meses: Number(meses) }),
  });

export const updateMaintenanceStatus = (id, estadoId) =>
  requestResource(`/mantenimiento/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado_id: Number(estadoId) }),
  });

export const updateMaintenanceProperty = (id, residencialId) =>
  requestResource(`/mantenimiento/${encodeURIComponent(id)}/propiedad`, {
    method: "PATCH",
    body: JSON.stringify({ residencial_id: Number(residencialId) }),
  });

export const updateMaintenanceTechnician = (id, tecnicoId) =>
  requestResource(`/mantenimiento/${encodeURIComponent(id)}/tecnico`, {
    method: "PATCH",
    body: JSON.stringify({ tecnico_id: tecnicoId == null || tecnicoId === "" ? null : Number(tecnicoId) }),
  });

export const deleteMaintenance = (id) =>
  requestResource(`/mantenimiento/${encodeURIComponent(id)}`, { method: "DELETE" });

export const updateAveriaStatus = (id, estado) =>
  requestResource(`/averias/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  })

export const deleteAveria = (id) =>
  requestResource(`/averias/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })


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


// Apartamentos y casas de un residencial (tabla apartamentos_casas).
export const getApartamentos = (residencialId) =>
  requestResource("/apartamentos" + (residencialId ? "?residencial_id=" + encodeURIComponent(residencialId) : ""));

export const createApartamento = (data) =>
  requestResource("/apartamentos", { method: "POST", body: JSON.stringify(data) });

export const updateApartamento = (id, data) =>
  requestResource(`/apartamentos/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteApartamento = (id) =>
  requestResource(`/apartamentos/${encodeURIComponent(id)}`, { method: "DELETE" });


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

// Sin residencialId devuelve los residentes del residencial de la cuenta (recepción).
export const getResidentes = (residencialId) =>
  requestResource("/residentes" + (residencialId ? "?residencial_id=" + encodeURIComponent(residencialId) : ""));

export const getVisitas = () => requestResource("/visitas");

export const createVisita = (data) =>
  requestResource("/visitas", { method: "POST", body: JSON.stringify(data) });


// Documentos PDF de los mantenimientos (bucket S3 privado).
// Sin mantenimientoId devuelve el historial completo de documentos guardados.
export const getDocumentos = (mantenimientoId) =>
  requestResource("/documentos" + (mantenimientoId == null ? "" : `?mantenimiento_id=${encodeURIComponent(mantenimientoId)}`));

// vista: "activos" | "historial"; sin vista devuelve todos.
export const getMantenimientos = (vista) =>
  requestResource(vista ? `/mantenimiento?vista=${encodeURIComponent(vista)}` : "/mantenimiento");

// Sube el PDF crudo; el mantenimiento va en la query porque el body es el archivo.
export const uploadDocumento = (file, mantenimientoId) =>
  requestResource(`/documentos?mantenimiento_id=${encodeURIComponent(mantenimientoId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-File-Type": file.type || "application/pdf"
    },
    body: file
  }, 120000);

export const associateDocumento = (id, mantenimientoId) =>
  requestResource(`/documentos/${encodeURIComponent(id)}/mantenimiento`, {
    method: "PATCH",
    body: JSON.stringify({ mantenimiento_id: mantenimientoId })
  });

export const archiveDocumento = (id) =>
  requestResource(`/documentos/${encodeURIComponent(id)}`, { method: "DELETE" });

// accion: "ver" (abre en el navegador) o "descargar". El backend redirige a un enlace temporal de S3.
export const getDocumentoUrl = (id, accion = "ver") =>
  `${API_BASE_URL}/documentos/${encodeURIComponent(id)}/${accion}`;


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
    proximosMantenimientos: "/nextmaintenance",
    residenciales: "/residenciales"
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
