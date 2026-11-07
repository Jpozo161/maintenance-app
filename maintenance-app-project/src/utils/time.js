const { timeZone } = require("../config/env");

// "08:30" o "08:30:00" -> 510 minutos desde medianoche.
const timeToMinutes = (value) => {
    const match = String(value || "").match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};

const minutesToTime = (value) =>
    String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");

// Fecha de hoy "YYYY-MM-DD" en la zona horaria del conjunto, no la del servidor.
const localToday = (now = new Date()) =>
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);

const localCurrentMinutes = (now = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(now);
    const part = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
    return part("hour") * 60 + part("minute");
};

module.exports = { 
    timeToMinutes, 
    minutesToTime, 
    localToday, 
    localCurrentMinutes 
};
