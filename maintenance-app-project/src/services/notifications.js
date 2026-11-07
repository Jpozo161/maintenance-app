// Plantillas de los correos de aviso. Cada ruta solo dice QUE paso y con que
// datos; el texto vive aqui, no repartido por los modulos.
// El transporte (API Gateway -> Lambda -> SES) esta en ApiGateway/newUsers.js.
const { emailNewUser } = require("../ApiGateway/newUsers");

const linea = (etiqueta, valor) => (valor ? `${etiqueta}: ${valor}\n` : "");

const TEMPLATES = {
    usuario_creado: (d) => ({
        subject: "Nuevo usuario registrado",
        message: "Se ha creado un nuevo usuario.\n\n" +
            linea("Nombre", d.nombre) +
            linea("Correo", d.email) +
            linea("Rol", d.rol)
    }),

    averia_reportada: (d) => ({
        subject: "Nueva averia reportada",
        message: "Se ha reportado una averia.\n\n" +
            linea("Averia n.", d.id) +
            linea("Descripcion", d.descripcion) +
            linea("Categoria", d.categoria) +
            linea("Estado", d.estado) +
            linea("Residencial", d.residencial_id)
    }),

    mantenimiento_programado: (d) => ({
        subject: "Nuevo mantenimiento programado",
        message: "Se ha programado un mantenimiento.\n\n" +
            linea("Mantenimiento n.", d.id) +
            linea("Actividad", d.tipo) +
            linea("Descripcion", d.descripcion) +
            linea("Fecha limite", d.fecha_programada) +
            linea("Residencial", d.residencial_id)
    }),

    visita_registrada: (d) => ({
        subject: "Nueva visita registrada",
        message: "Se ha registrado una visita.\n\n" +
            linea("Visitante", d.nombre_visitante) +
            linea("Documento", d.tipo_documento && `${d.tipo_documento} ${d.numero_documento || ""}`.trim()) +
            linea("Fecha y hora", d.fecha_visita) +
            linea("Motivo", d.motivo) +
            linea("Residencial", d.residencial_nombre) +
            linea("Apartamento", d.apartamento_nombre) +
            linea("Registrada por", d.registrado_por_nombre)
    }),

    reserva_creada: (d) => ({
        subject: `Nueva reserva de area social: ${d.area_nombre || "area social"}`,
        message: "Un residente ha reservado un area social.\n\n" +
            linea("Reserva n.", d.id) +
            linea("Area", d.area_nombre) +
            linea("Residente", d.usuario_nombre) +
            linea("Fecha", d.fecha) +
            linea("Horario", d.hora_inicio && `${d.hora_inicio} - ${d.hora_fin}`) +
            linea("Residencial", d.residencial_nombre) +
            linea("Estado", d.estado)
    })
};

// Best-effort: nunca lanza, para que un fallo del correo no tumbe la operacion
// que lo origino. Llamar sin await.
const notify = (type, data = {}) => {

    const template = TEMPLATES[type];

    if (!template) {
        console.error(`Tipo de notificacion desconocido: ${type}`);
        return Promise.resolve(null);
    }

    try {
        const { subject, message } = template(data);
        
        return emailNewUser({
            subject,
            message,
            // Solo el aviso de usuario nuevo adjunta la contrasena.
            ...(data.password && { password: data.password })
        });
    } catch (error) {
        console.error(`No se pudo construir la notificacion ${type}:`, error.message);
        return Promise.resolve(null);
    }
};

module.exports = {
    notify,
    TIPOS: Object.keys(TEMPLATES)
};
