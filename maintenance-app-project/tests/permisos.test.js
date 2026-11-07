// Verifica que toda ruta privada declare sus roles y que nadie tenga más acceso del esperado.
// Si agregas una ruta para un rol distinto de ADMIN, regístrala en ACCESO_ESPERADO.
process.env.JWT_SECRET ||= "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const routes = require("../src/routes");
const { ROLES } = require("../src/constants");

const PUBLICAS = new Set(["GET /health", "POST /login", "POST /logout", "GET /me"]);

// Rutas abiertas a roles además de ADMIN. Todas las demás son solo de ADMIN.
const ACCESO_ESPERADO = {
    "GET /averias": [ROLES.SUPERVISOR],
    "GET /mantenimiento": [ROLES.TECNICO],
    "GET /nextmaintenance": [ROLES.TECNICO],
    "GET /areas-sociales": [ROLES.RESIDENTE],
    "GET /areas-sociales/:id/disponibilidad": [ROLES.RESIDENTE],
    "GET /reservas": [ROLES.RESIDENTE],
    "POST /reservas": [ROLES.RESIDENTE],
    "GET /residentes": [ROLES.FRONTDESK],
    "GET /apartamentos": [ROLES.FRONTDESK],
    "GET /visitas": [ROLES.RESIDENTE, ROLES.FRONTDESK],
    "POST /visitas": [ROLES.RESIDENTE, ROLES.FRONTDESK]
};

// Recorre el router (y sus sub-routers) y devuelve cada ruta con sus roles permitidos.
const listRoutes = (router) => router.stack.flatMap((layer) => {
    if (layer.route) {
        const roles = layer.route.stack.find((l) => l.handle.allowedRoles)?.handle.allowedRoles ?? null;
        return Object.keys(layer.route.methods).map((method) => ({
            key: `${method.toUpperCase()} ${layer.route.path}`,
            roles
        }));
    }
    return layer.handle?.stack ? listRoutes(layer.handle) : [];
});

const privadas = listRoutes(routes).filter((route) => !PUBLICAS.has(route.key));

test("hay rutas privadas registradas", () => {
    assert.ok(privadas.length > 30);
});

for (const { key, roles } of privadas) {
    test(`${key} declara los roles correctos`, () => {
        assert.ok(roles, `${key} no usa requireRole/adminOnly`);
        const esperados = [ROLES.ADMIN, ...(ACCESO_ESPERADO[key] ?? [])].sort();
        assert.deepEqual([...roles].sort(), esperados);
    });
}
