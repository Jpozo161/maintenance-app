const test = require("node:test");
const assert = require("node:assert/strict");
const { text, positiveId, optionalId, calendarDate } = require("../src/utils/validators");
const { paginationFrom, withPagination } = require("../src/utils/pagination");

test("text limpia espacios y descarta lo que no es texto", () => {
    assert.equal(text("  hola "), "hola");
    assert.equal(text(42), "");
});

test("positiveId solo acepta enteros >= 1", () => {
    assert.equal(positiveId("7"), 7);
    assert.equal(positiveId(0), null);
    assert.equal(positiveId("1.5"), null);
    assert.equal(positiveId("abc"), null);
});

test("optionalId distingue vacío (null) de inválido (undefined)", () => {
    assert.equal(optionalId(""), null);
    assert.equal(optionalId(null), null);
    assert.equal(optionalId("3"), 3);
    assert.equal(optionalId("-1"), undefined);
});

test("calendarDate rechaza fechas que no existen", () => {
    assert.equal(calendarDate("2024-02-29"), "2024-02-29");
    assert.equal(calendarDate("2023-02-29"), null);
    assert.equal(calendarDate("15/03/2025"), null);
});

test("la paginación es opcional y tiene un máximo", () => {
    assert.equal(paginationFrom({}), null);
    assert.deepEqual(paginationFrom({ limit: "20", offset: "40" }), { limit: 20, offset: 40 });
    assert.equal(paginationFrom({ limit: "9999" }).limit, 500);
    assert.deepEqual(withPagination("SELECT 1", [], null), ["SELECT 1", []]);
    assert.deepEqual(withPagination("SELECT 1", [], { limit: 5, offset: 0 }), ["SELECT 1 LIMIT ? OFFSET ?", [5, 0]]);
});
