const express = require("express");
const { pool } = require("./config/db");
const { verifyToken } = require("./middleware/auth");

const router = express.Router();

// Rutas públicas (sin sesión).
router.get("/health", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
});
router.use(require("./modules/auth/auth.routes"));

// A partir de aquí todo requiere sesión. Cada ruta declara además
// sus roles con requireRole/adminOnly (tests/permisos.test.js lo verifica).
router.use(verifyToken);

// Para agregar un módulo nuevo: crear src/modules/<nombre>/ y registrarlo aquí.
router.use(require("./modules/usuarios/usuarios.routes"));
router.use(require("./modules/residenciales/residenciales.routes"));
router.use(require("./modules/apartamentos/apartamentos.routes"));
router.use(require("./modules/pagos/pagos.routes"));
router.use(require("./modules/averias/averias.routes"));
router.use(require("./modules/mantenimientos/mantenimientos.routes"));
router.use(require("./modules/documentos/documentos.routes"));
router.use(require("./modules/areasSociales/areasSociales.routes"));
router.use(require("./modules/reservas/reservas.routes"));
router.use(require("./modules/visitas/visitas.routes"));

module.exports = router;
