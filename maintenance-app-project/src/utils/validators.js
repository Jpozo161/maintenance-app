// Helpers de validación: devuelven el valor limpio o null si no es válido.

const text = (value) => (typeof value === "string" ? value.trim() : "");

const positiveId = (value) => {
    const number = Number(value);

    return Number.isInteger(number) && number >= 1 ? number : null;
};

// null/"" significan "sin asignar"; undefined indica un id inválido.
const optionalId = (value) => {
    if (value == null || value === "") 
        return null;
    return positiveId(value) ?? undefined;
};

// Fecha "YYYY-MM-DD" que además exista en el calendario (rechaza 2024-02-31).
const calendarDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};

const isoDateFormat = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

module.exports = { text, positiveId, optionalId, calendarDate, isoDateFormat };
