// Valores fijos del negocio. Deben coincidir con los datos de migrations/001_esquema_inicial.sql.

const ROLES = Object.freeze({
    ADMIN: "ADMIN",
    SUPERVISOR: "SUPERVISOR",
    TECNICO: "TECNICO",
    RESIDENTE: "RESIDENTE",
    FRONTDESK: "FRONTDESK"
});

// Ids de la tabla estados_mantenimiento que se pueden usar.
// El id 5 ("Próximo mantenimiento") ya no se usa: el próximo mantenimiento se crea como registro
// nuevo desde el historial. La fila se conserva en la BD porque historial_mantenimiento la referencia.
const ESTADOS_MANTENIMIENTO = Object.freeze({
    PROGRAMADO: 1,
    PROCESO: 2,
    COMPLETADO: 3,
    CANCELADO: 4
});

// Meses que se pueden sumar a la fecha de cierre al crear el próximo mantenimiento.
const OPCIONES_MESES_SIGUIENTE = Object.freeze([1, 3, 6]);

const ESTADOS_AVERIA = Object.freeze(["Reportada", "En proceso", "Completada", "Cancelada"]);

const ESTADOS_RESERVA = Object.freeze({
    PENDIENTE: "PENDIENTE",
    APROBADA: "APROBADA",
    RECHAZADA: "RECHAZADA"
});

const TIPOS_DOCUMENTO = Object.freeze(["CEDULA", "PASAPORTE"]);

// Valores de apartamentos_casas.tipo.
const TIPOS_APARTAMENTO = Object.freeze(["Apartamento", "Casa"]);

module.exports = {
    ROLES,
    ESTADOS_MANTENIMIENTO,
    OPCIONES_MESES_SIGUIENTE,
    ESTADOS_AVERIA,
    ESTADOS_RESERVA,
    TIPOS_DOCUMENTO,
    TIPOS_APARTAMENTO
};
