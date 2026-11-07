const { pool } = require("../../config/db");
const { withPagination } = require("../../utils/pagination");
const { ESTADOS_MANTENIMIENTO: ESTADOS } = require("../../constants");

// Los mantenimientos "eliminados" solo se ocultan (eliminado_en) para no perder historial ni documentos.
// technicianId = null devuelve todos; con un id, solo los asignados a ese técnico.

// Vistas del módulo: "activos" (aún abiertos) e "historial" (completados o cancelados).
// Sin vista se devuelven todos (lo usan el inicio y la asociación de documentos).
const VISTAS = Object.freeze({
    activos: "AND m.estado_id NOT IN (?, ?)",
    historial: "AND m.estado_id IN (?, ?)"
});
const ESTADOS_CERRADOS = [ESTADOS.COMPLETADO, ESTADOS.CANCELADO];

const findAll = async (technicianId, page, vista = null) => {
    const vistaClause = VISTAS[vista] ?? "";
    const [sql, values] = withPagination(
        `SELECT m.id, m.tipo, m.descripcion, m.residencial_id, r.nombre AS nombre_residencial,
                m.created_at AS fecha_creacion, m.fecha_programada, m.fecha_cierre, m.estado_id, e.nombre AS estado_nombre,
                m.tecnico_id, tecnico.nombre AS tecnico_nombre, siguiente.id AS siguiente_id,
                COUNT(d.id) AS documentos_count
         FROM mantenimientos AS m
         LEFT JOIN residenciales AS r ON r.id = m.residencial_id
         INNER JOIN estados_mantenimiento AS e ON e.id = m.estado_id
         LEFT JOIN usuarios AS tecnico ON tecnico.id = m.tecnico_id
         LEFT JOIN mantenimientos AS siguiente ON siguiente.mantenimiento_origen_id = m.id
         LEFT JOIN documentos_mantenimiento AS d ON d.mantenimiento_id = m.id AND d.eliminado_en IS NULL
         WHERE m.eliminado_en IS NULL AND (? IS NULL OR m.tecnico_id = ?) ${vistaClause}
         GROUP BY m.id, m.tipo, m.descripcion, m.residencial_id, r.nombre, m.tecnico_id, tecnico.nombre,
                  m.created_at, m.fecha_programada, m.fecha_cierre, m.estado_id, e.nombre, siguiente.id
         ORDER BY ${vista === "historial" ? "m.fecha_cierre DESC, m.id DESC" : "m.id"}`,
        [technicianId, technicianId, ...(vistaClause ? ESTADOS_CERRADOS : [])],
        page
    );
    const [rows] = await pool.query(sql, values);
    return rows;
};

// Próximos: fecha futura y aún abiertos.
const findUpcoming = async (technicianId) => {
    const [rows] = await pool.query(
        `SELECT m.id, m.tipo, m.created_at AS fecha_creacion, m.fecha_programada,
                m.descripcion, m.estado_id, e.nombre AS estado_nombre, m.residencial_id, r.nombre AS nombre_residencial,
                m.tecnico_id, tecnico.nombre AS tecnico_nombre
         FROM mantenimientos AS m
         LEFT JOIN residenciales AS r ON r.id = m.residencial_id
         LEFT JOIN usuarios AS tecnico ON tecnico.id = m.tecnico_id
         INNER JOIN estados_mantenimiento AS e ON e.id = m.estado_id
         WHERE m.fecha_programada >= CURDATE() AND m.estado_id NOT IN (?, ?)
           AND m.eliminado_en IS NULL
           AND (? IS NULL OR m.tecnico_id = ?)
         ORDER BY m.fecha_programada ASC`,
        [ESTADOS.COMPLETADO, ESTADOS.CANCELADO, technicianId, technicianId]
    );
    return rows;
};

const findStatuses = async () => {
    const [rows] = await pool.query(
        "SELECT id, nombre FROM estados_mantenimiento WHERE id IN (?) ORDER BY id",
        [Object.values(ESTADOS)]
    );
    return rows;
};

const create = async ({ tipo, descripcion, fecha_programada, residencial_id }) => {
    const [result] = await pool.query(
        "INSERT INTO mantenimientos (tipo, descripcion, fecha_programada, estado_id, residencial_id) VALUES (?, ?, ?, ?, ?)",
        [tipo, descripcion, fecha_programada, ESTADOS.PROGRAMADO, residencial_id]
    );
    return result.insertId;
};

// UPDATE sobre un mantenimiento activo. Devuelve false si no existe.
// (affectedRows puede ser 0 si los valores no cambiaron, por eso se confirma con un SELECT).
const updateActive = async (id, setClause, values) => {
    const [result] = await pool.query(
        `UPDATE mantenimientos SET ${setClause} WHERE id = ? AND eliminado_en IS NULL`,
        [...values, id]
    );
    if (result.affectedRows > 0) return true;
    const [rows] = await pool.query("SELECT id FROM mantenimientos WHERE id = ? AND eliminado_en IS NULL", [id]);
    return rows.length > 0;
};

// Al pasar a completado/cancelado se guarda la fecha de cierre; si se reabre, se limpia.
// (MySQL evalúa el SET en orden: fecha_cierre se calcula antes de cambiar estado_id).
const updateStatus = (id, estadoId) => updateActive(
    id,
    `fecha_cierre = CASE WHEN ? NOT IN (?, ?) THEN NULL
                         WHEN estado_id IN (?, ?) THEN fecha_cierre
                         ELSE CURRENT_TIMESTAMP END,
     estado_id = ?`,
    [estadoId, ...ESTADOS_CERRADOS, ...ESTADOS_CERRADOS, estadoId]
);

// Crea el mantenimiento siguiente a partir de uno cerrado, sin modificar el original.
// La fecha es la de cierre + `meses` meses. Devuelve el registro creado, null si el original
// no existe o no está cerrado, o lanza ER_DUP_ENTRY si ya tenía un siguiente.
const createNext = async (originId, meses) => {
    const [result] = await pool.query(
        `INSERT INTO mantenimientos
             (tipo, descripcion, residencial_id, equipo_id, tecnico_id, estado_id, fecha_programada, mantenimiento_origen_id)
         SELECT tipo, descripcion, residencial_id, equipo_id, tecnico_id, ?,
                DATE_ADD(COALESCE(fecha_cierre, CURRENT_TIMESTAMP), INTERVAL ? MONTH), id
         FROM mantenimientos
         WHERE id = ? AND eliminado_en IS NULL AND estado_id IN (?, ?)`,
        [ESTADOS.PROGRAMADO, meses, originId, ...ESTADOS_CERRADOS]
    );
    if (!result.affectedRows) return null;
    const [rows] = await pool.query(
        "SELECT id, fecha_programada FROM mantenimientos WHERE id = ?",
        [result.insertId]
    );
    return rows[0];
};

const updateProperty = (id, residencialId) => updateActive(id, "residencial_id = ?", [residencialId]);

const updateTechnician = (id, technicianId) => updateActive(id, "tecnico_id = ?", [technicianId]);

const archive = async (id) => {
    const [result] = await pool.query(
        "UPDATE mantenimientos SET eliminado_en = CURRENT_TIMESTAMP WHERE id = ? AND eliminado_en IS NULL",
        [id]
    );
    return result.affectedRows > 0;
};

module.exports = {
    findAll,
    findUpcoming,
    findStatuses,
    create,
    updateStatus,
    createNext,
    updateProperty,
    updateTechnician,
    archive
};
