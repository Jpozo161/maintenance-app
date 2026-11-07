const { 
    timeToMinutes, 
    minutesToTime, 
    localToday, 
    localCurrentMinutes 
} = require("../../utils/time");
const HttpError = require("../../utils/HttpError");

// Función pura: no consulta la BD, así se puede probar sin servidor.
// Divide el horario del área en bloques de intervalo_minutos y marca cuáles están libres.
// Un bloque está ocupado si se cruza con una reserva o si ya empezó (cuando la fecha es hoy).

const calcularHorarios = (area, fecha, reservas, ahora = new Date()) => {
    const apertura = timeToMinutes(area.hora_apertura);
    const cierre = timeToMinutes(area.hora_cierre);
    const intervalo = Number(area.intervalo_minutos);
    if (!Number.isFinite(apertura) 
        || !Number.isFinite(cierre) 
        || !(intervalo >= 1) 
        || cierre <= apertura)
        throw new HttpError(500, "El horario configurado del área no es válido.");

    const esHoy = fecha === localToday(ahora);
    const minutoActual = esHoy ? localCurrentMinutes(ahora) : -1;

    const horarios = [];
    for (let inicio = apertura; inicio + intervalo <= cierre; inicio += intervalo) {
        const fin = inicio + intervalo;
        const yaPaso = esHoy && inicio <= minutoActual;
        const cruzaReserva = reservas.some((reserva) =>
            inicio < timeToMinutes(reserva.hora_fin) && fin > timeToMinutes(reserva.hora_inicio));
        horarios.push({ hora_inicio: minutesToTime(inicio), hora_fin: minutesToTime(fin), disponible: !yaPaso && !cruzaReserva });
    }
    return horarios;
};

module.exports = { calcularHorarios };
