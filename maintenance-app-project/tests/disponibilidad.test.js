process.env.JWT_SECRET ||= "test";
process.env.APP_TIME_ZONE = "America/Bogota";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularHorarios } = require("../src/modules/areasSociales/disponibilidad");

const area = { hora_apertura: "08:00:00", hora_cierre: "12:00:00", intervalo_minutos: 60 };
const FUTURO = "2099-01-01";

test("divide el horario en bloques del intervalo", () => {
    const horarios = calcularHorarios(area, FUTURO, []);
    assert.deepEqual(horarios.map((h) => h.hora_inicio), ["08:00", "09:00", "10:00", "11:00"]);
    assert.ok(horarios.every((h) => h.disponible));
});

test("un bloque que no cabe completo antes del cierre no se ofrece", () => {
    const horarios = calcularHorarios({ ...area, intervalo_minutos: 90 }, FUTURO, []);
    assert.deepEqual(horarios.map((h) => `${h.hora_inicio}-${h.hora_fin}`), ["08:00-09:30", "09:30-11:00"]);
});

test("marca ocupados los bloques que se cruzan con una reserva", () => {
    const horarios = calcularHorarios(area, FUTURO, [{ hora_inicio: "09:30:00", hora_fin: "10:30:00" }]);
    assert.deepEqual(horarios.map((h) => h.disponible), [true, false, false, true]);
});

test("una reserva que termina justo al empezar el bloque no lo ocupa", () => {
    const horarios = calcularHorarios(area, FUTURO, [{ hora_inicio: "08:00", hora_fin: "09:00" }]);
    assert.deepEqual(horarios.map((h) => h.disponible), [false, true, true, true]);
});

test("hoy, los bloques que ya empezaron no están disponibles", () => {
    // 09:15 en Bogotá (UTC-5) = 14:15 UTC.
    const ahora = new Date("2030-05-10T14:15:00Z");
    const horarios = calcularHorarios(area, "2030-05-10", [], ahora);
    assert.deepEqual(horarios.map((h) => h.disponible), [false, false, true, true]);
});

test("rechaza un horario de área inválido", () => {
    assert.throws(() => calcularHorarios({ ...area, hora_cierre: "07:00" }, FUTURO, []), /no es válido/);
});
