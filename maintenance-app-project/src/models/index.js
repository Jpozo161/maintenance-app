const db = require('../../db.js');

const getAverias = (callback) => {
    const sql = `SELECT a.id, a.residencial_id, a.descripcion, a.categoria, a.fecha, a.estado,
        r.nombre AS nombre_residencial
        FROM averias AS a
        LEFT JOIN residenciales AS r ON r.id = a.residencial_id
        WHERE a.eliminada_en IS NULL
        ORDER BY a.fecha DESC, a.id DESC`;
    db.query(sql, callback);
}


const logIn = (email, callback) => {
    const sql = `
        SELECT u.id, u.nombre, u.email, u.password, u.role_id, u.residencial_id, roles.nombre AS role_name
        FROM usuarios AS u
        LEFT JOIN roles ON roles.id = u.role_id
        WHERE u.email = ? AND COALESCE(u.estado, 1) = 1`;
        
    db.query(sql, 
        [email], 
        callback
    );
}

const register = (nombre, email, password, role_id, residencial_id, callback) => {
    const sql = "INSERT INTO usuarios (nombre, email, password, role_id, residencial_id) VALUES(?,?,?,?,?)"

    db.query(
        sql,
        [nombre, email, password, role_id, residencial_id],
        callback
    )
}

const maintenance = (technicianId, callback) => {
    const sql = `SELECT m.id, m.tipo, m.descripcion, m.residencial_id, r.nombre AS nombre_residencial,
        m.created_at AS fecha_creacion, m.fecha_programada, m.estado_id, e.nombre AS estado_nombre,
        m.tecnico_id, tecnico.nombre AS tecnico_nombre,
        COUNT(f.id) AS facturas_count
        FROM mantenimientos AS m
        LEFT JOIN residenciales AS r ON r.id = m.residencial_id
        INNER JOIN estados_mantenimiento AS e ON e.id = m.estado_id
        LEFT JOIN usuarios AS tecnico ON tecnico.id = m.tecnico_id
        LEFT JOIN facturas AS f ON f.mantenimiento_id = m.id
        WHERE m.eliminado_en IS NULL AND (? IS NULL OR m.tecnico_id = ?)
        GROUP BY m.id, m.tipo, m.descripcion, m.residencial_id, r.nombre, m.tecnico_id, tecnico.nombre,
                 m.created_at, m.fecha_programada, m.estado_id, e.nombre`;

    db.query(
        sql,
        [technicianId, technicianId],
        callback
    )
}

const nextMaintenance = (technicianId, callback) => {
    const sql = `SELECT m.id, m.tipo, m.created_at AS fecha_creacion, m.fecha_programada,
        m.descripcion, m.estado_id, e.nombre AS estado_nombre, m.residencial_id, r.nombre AS nombre_residencial,
        m.tecnico_id, tecnico.nombre AS tecnico_nombre
        FROM mantenimientos AS m
        LEFT JOIN residenciales AS r ON r.id = m.residencial_id
        LEFT JOIN usuarios AS tecnico ON tecnico.id = m.tecnico_id
        INNER JOIN estados_mantenimiento AS e ON e.id = m.estado_id
        WHERE ((m.fecha_programada >= CURDATE() AND m.estado_id NOT IN (3, 4))
            OR m.estado_id = 5)
          AND m.eliminado_en IS NULL
          AND (? IS NULL OR m.tecnico_id = ?)
        ORDER BY m.fecha_programada ASC`;
    db.query(sql, [technicianId, technicianId], callback);
};

const getMaintenanceStatuses = (callback) => {
    db.query("SELECT id, nombre FROM estados_mantenimiento ORDER BY id", callback);
};

const createMaintenance = ({ tipo, descripcion, fecha_programada, residencial_id }, callback) => {
    db.query(
        `INSERT INTO mantenimientos (tipo, descripcion, fecha_programada, estado_id, residencial_id)
         SELECT ?, ?, ?, id, ? FROM estados_mantenimiento
         WHERE UPPER(nombre) IN ('PROGRAMADO', 'PENDIENTE')
         ORDER BY CASE UPPER(nombre) WHEN 'PROGRAMADO' THEN 0 ELSE 1 END
         LIMIT 1`,
        [tipo, descripcion, fecha_programada, residencial_id],
        (error, result) => {
            if (error) return callback(error);
            if (!result.affectedRows) return callback(new Error("No se encontró el estado Programado/Pendiente en estados_mantenimiento."));
            callback(null, result.insertId);
        }
    );
};

const postponeMaintenance = (id, callback) => {
    db.query(
        "UPDATE mantenimientos SET fecha_programada = DATE_ADD(fecha_programada, INTERVAL 3 MONTH), estado_id = 5 WHERE id = ?",
        [id],
        (error, result) => {
            if (error) return callback(error);
            callback(null, result.affectedRows > 0);
        }
    );
};

const updateMaintenanceStatus = (id, estadoId, callback) => {
    db.query(
        `UPDATE mantenimientos
         SET fecha_programada = CASE WHEN ? = 5 AND estado_id <> 5
                                     THEN DATE_ADD(fecha_programada, INTERVAL 3 MONTH)
                                     ELSE fecha_programada END,
             estado_id = ?
         WHERE id = ?`,
        [estadoId, estadoId, id],
        (error, result) => {
        if (error) return callback(error);
        if (result.affectedRows > 0) return callback(null, true);
        db.query("SELECT id FROM mantenimientos WHERE id = ?", [id], (lookupError, rows) => {
            if (lookupError) return callback(lookupError);
            callback(null, rows.length > 0);
        });
        }
    );
};

const updateMaintenanceProperty = (id, residencialId, callback) => {
    db.query(
        "UPDATE mantenimientos SET residencial_id = ? WHERE id = ?",
        [residencialId, id],
        (error, result) => {
            if (error) return callback(error);
            if (result.affectedRows > 0) return callback(null, true);
            db.query("SELECT id FROM mantenimientos WHERE id = ?", [id], (lookupError, rows) => {
                if (lookupError) return callback(lookupError);
                callback(null, rows.length > 0);
            });
        }
    );
};

const getTechnicians = (callback) => {
    const sql = `SELECT u.id, u.nombre, u.email, roles.nombre AS rol
        FROM usuarios AS u
        INNER JOIN roles ON roles.id = u.role_id
        WHERE COALESCE(u.estado, 1) = 1
          AND UPPER(REPLACE(REPLACE(REPLACE(roles.nombre, 'É', 'E'), 'Í', 'I'), 'Á', 'A')) LIKE '%TECN%'
        ORDER BY u.nombre`;
    db.query(sql, callback);
};

const updateMaintenanceTechnician = (id, technicianId, callback) => {
    db.query("UPDATE mantenimientos SET tecnico_id = ? WHERE id = ?", [technicianId, id], (error, result) => {
        if (error) return callback(error);
        if (result.affectedRows > 0) return callback(null, true);
        db.query("SELECT id FROM mantenimientos WHERE id = ?", [id], (lookupError, rows) => {
            if (lookupError) return callback(lookupError);
            callback(null, rows.length > 0);
        });
    });
};

const deleteMaintenance = (id, callback) => {
    db.query("UPDATE mantenimientos SET eliminado_en = CURRENT_TIMESTAMP WHERE id = ? AND eliminado_en IS NULL", [id], (error, result) => {
        if (error) return callback(error);
        callback(null, result.affectedRows > 0);
    });
};

const getFacturas = (mantenimientoId, callback) => {
    let sql = `SELECT f.id, f.nombre_original, f.tipo_mime, f.tamano_bytes, f.sha256,
        f.proveedor, f.numero_factura, f.fecha_factura, f.total, f.mantenimiento_id,
        f.created_at, m.tipo AS mantenimiento_tipo
        FROM facturas AS f
        LEFT JOIN mantenimientos AS m ON m.id = f.mantenimiento_id`;
    const values = [];
    if (mantenimientoId != null) { sql += " WHERE f.mantenimiento_id = ?"; values.push(mantenimientoId); }
    sql += " ORDER BY f.created_at DESC, f.id DESC";
    db.query(sql, values, callback);
};

const getFacturaByHash = (hash, callback) => {
    db.query("SELECT id FROM facturas WHERE sha256 = ? LIMIT 1", [hash], (error, rows) => {
        if (error) return callback(error);
        callback(null, rows[0] || null);
    });
};

const getFacturaById = (id, callback) => {
    db.query("SELECT id, s3_object_key, nombre_original FROM facturas WHERE id = ?", [id], (error, rows) => {
        if (error) return callback(error);
        callback(null, rows[0] || null);
    });
};

const createFactura = (invoice, callback) => {
    const sql = `INSERT INTO facturas
        (nombre_original, tipo_mime, tamano_bytes, s3_object_key, sha256, proveedor,
         numero_factura, fecha_factura, total, datos_ocr, texto_ocr, subido_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [invoice.nombre_original, invoice.tipo_mime, invoice.tamano_bytes,
        invoice.s3_object_key, invoice.sha256, invoice.proveedor, invoice.numero_factura,
        invoice.fecha_factura, invoice.total, JSON.stringify(invoice.datos_ocr),
        invoice.texto_ocr, invoice.subido_por], callback);
};

const associateFactura = (id, mantenimientoId, callback) => {
    db.query("UPDATE facturas SET mantenimiento_id = ? WHERE id = ?", 
        [mantenimientoId, id], 
        (error, result) => {
        if (error) 
            return callback(error);
        if (result.affectedRows > 0) 
            return callback(null, true);

        db.query("SELECT id FROM facturas WHERE id = ?", [id], 
            (lookupError, rows) => {
            if (lookupError) 
                return callback(lookupError);
            callback(null, rows.length > 0);
        });
    });
};

const paymentSave = (nombre, monto, fechaCreacion, callback) => {
    const sql = "INSERT INTO pagos (nombre, monto, fecha_creacion) VALUES(?,?,?)"

    db.query(
        sql,
        [nombre, monto, fechaCreacion],
        callback
    )
}
const getResidenciales = (callback) => {
    db.query(
        "SELECT * FROM residenciales",
        (error, rows) => {
            if (error)
                return callback(error);

            callback(null, rows);
        }
    );
};


const createResidencial = (nombre, callback) => {
    db.query(
        "INSERT INTO residenciales (nombre) VALUES (?)",
        [nombre],
        (error, result) => {
            if (error)
                return callback(error);

            db.query(
                "SELECT * FROM residenciales WHERE id = ?",
                [result.insertId],
                (selectError, rows) => {
                    if (selectError)
                        return callback(selectError);

                    callback(null, rows[0] || null);
                }
            );
        }
    );
};


const updateResidencial = (id, nombre, callback) => {
    db.query(
        "UPDATE residenciales SET nombre = ? WHERE id = ?",
        [nombre, id],
        (error) => {
            if (error)
                return callback(error);

            db.query(
                "SELECT * FROM residenciales WHERE id = ?",
                [id],
                (selectError, rows) => {
                    if (selectError)
                        return callback(selectError);

                    callback(null, rows[0] || null);
                }
            );
        }
    );
};

const addNewAverias = (residencial_id, descripcion, categoria, callback) => {
    db.query(
        "INSERT INTO averias (residencial_id, descripcion, categoria) VALUE(?,?,?)",
        [residencial_id, descripcion, categoria],
        (error, result) => {
            if (error) return callback(error);
            db.query("SELECT id, residencial_id, descripcion, categoria, fecha, estado FROM averias WHERE id = ?", [result.insertId], (selectError, rows) => {
                if (selectError) return callback(selectError);
                callback(null, rows[0] || null);
            });
        }
    );
};

const updateAveriaStatus = (id, estado, callback) => {
    db.query("UPDATE averias SET estado = ? WHERE id = ? AND eliminada_en IS NULL", [estado, id], (error, result) => {
        if (error) return callback(error);
        if (result.affectedRows > 0) return callback(null, true);
        db.query("SELECT id FROM averias WHERE id = ? AND eliminada_en IS NULL", [id], (lookupError, rows) => {
            if (lookupError) return callback(lookupError);
            callback(null, rows.length > 0);
        });
    });
};

const archiveCompletedAveria = (id, callback) => {
    db.query("UPDATE averias SET eliminada_en = NOW() WHERE id = ? AND estado = 'Completada' AND eliminada_en IS NULL", [id], (error, result) => {
        if (error) return callback(error);
        if (result.affectedRows > 0) return callback(null, { deleted: true });
        db.query("SELECT estado, eliminada_en FROM averias WHERE id = ?", [id], (lookupError, rows) => {
            if (lookupError) return callback(lookupError);
            if (!rows.length) return callback(null, { found: false });
            if (rows[0].eliminada_en) return callback(null, { found: true, deleted: false, alreadyArchived: true });
            callback(null, { found: true, deleted: false, completed: rows[0].estado === "Completada" });
        });
    });
};


const deleteResidencial = (id, callback) => {
    db.query(
        "DELETE FROM residenciales WHERE id = ?",
        [id],
        (error, result) => {
            if (error)
                return callback(error);

            callback(null, result.affectedRows > 0);
        }
    );
};


const getPropietarios = (callback) => {
    const sql = `
        SELECT u.id, u.nombre, u.email, u.residencial_id, u.role_id,
               r.nombre AS res_nombre, roles.nombre AS rol
        FROM usuarios AS u
        LEFT JOIN residenciales AS r ON r.id = u.residencial_id
        LEFT JOIN roles ON roles.id = u.role_id
        WHERE COALESCE(u.estado, 1) = 1
        ORDER BY u.id DESC`;
    db.query(sql, callback);
};

const getRoles = (callback) => {
    db.query("SELECT id, nombre FROM roles ORDER BY nombre", callback);
};

const getRoleById = (id, callback) => {
    db.query("SELECT id, nombre FROM roles WHERE id = ?", [id], callback);
};

const updateUsuario = (id, { nombre, email, role_id, residencial_id }, callback) => {
    db.query(
        "UPDATE usuarios SET nombre = ?, email = ?, role_id = ?, residencial_id = ? WHERE id = ?",
        [nombre, email, role_id, residencial_id, id],
        (error, result) => {
            if (error) return callback(error);
            callback(null, result.affectedRows > 0);
        }
    );
};

const deleteUsuario = (id, callback) => {
    // Keep payment history and its foreign-key relationship; deactivate the account instead.
    db.query("UPDATE usuarios SET estado = 0 WHERE id = ? AND COALESCE(estado, 1) = 1", [id], (error, result) => {
        if (error) return callback(error);
        callback(null, result.affectedRows > 0);
    });
};


const getPaymentPrimaryKey = (callback) => {
    db.query("SHOW KEYS FROM pagos WHERE Key_name = 'PRIMARY'", (error, keys) => {
        if (error) return callback(error);
        const primaryKey = keys?.[0]?.Column_name;
        if (!primaryKey) return callback(new Error("La tabla pagos no tiene una clave primaria."));
        callback(null, primaryKey);
    });
};

const getPagos = (callback) => {
    getPaymentPrimaryKey((error, primaryKey) => {
        if (error) return callback(error);
        db.query("SELECT ?? AS id, fecha_creacion, nombre, monto FROM pagos", [primaryKey], callback);
    });
};

const updatePago = (id, nombre, monto, callback) => {
    getPaymentPrimaryKey((error, primaryKey) => {
        if (error) return callback(error);
        db.query("UPDATE pagos SET nombre = ?, monto = ? WHERE ?? = ?", [nombre, monto, primaryKey, id], (queryError, result) => {
            if (queryError) return callback(queryError);
            callback(null, result.affectedRows > 0);
        });
    });
};

const deletePago = (id, callback) => {
    getPaymentPrimaryKey((error, primaryKey) => {
        if (error) return callback(error);
        db.query("DELETE FROM pagos WHERE ?? = ?", [primaryKey, id], (queryError, result) => {
            if (queryError) return callback(queryError);
            callback(null, result.affectedRows > 0);
        });
    });
};



const getAreaSocialById = (id, callback) => {
    db.query("SELECT * FROM areas_sociales WHERE id = ?", [id], (error, rows) => {
        if (error) return callback(error);
        callback(null, rows[0] || null);
    });
};

const getAreasSociales = (residencialId, soloActivas, callback) => {
    let sql = "SELECT a.*, r.nombre AS residencial_nombre FROM areas_sociales AS a INNER JOIN residenciales AS r ON r.id = a.residencial_id";
    const conditions = [];
    const values = [];
    if (residencialId != null) { conditions.push("a.residencial_id = ?"); values.push(residencialId); }
    if (soloActivas) conditions.push("a.activa = 1");
    if (conditions.length) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY r.nombre, a.nombre";
    db.query(sql, values, callback);
};

const createAreaSocial = (area, callback) => {
    db.query(
        "INSERT INTO areas_sociales (residencial_id, nombre, descripcion, hora_apertura, hora_cierre, intervalo_minutos, activa) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [area.residencial_id, area.nombre, area.descripcion, area.hora_apertura, area.hora_cierre, area.intervalo_minutos, area.activa],
        (error, result) => {
            if (error) return callback(error);
            getAreaSocialById(result.insertId, callback);
        }
    );
};

const updateAreaSocial = (id, area, callback) => {
    getAreaSocialById(id, (findError, existing) => {
        if (findError || !existing) return callback(findError, false);
        db.query(
            "UPDATE areas_sociales SET residencial_id = ?, nombre = ?, descripcion = ?, hora_apertura = ?, hora_cierre = ?, intervalo_minutos = ?, activa = ? WHERE id = ?",
            [area.residencial_id, area.nombre, area.descripcion, area.hora_apertura, area.hora_cierre, area.intervalo_minutos, area.activa, id],
            (error) => {
                if (error) return callback(error);
                getAreaSocialById(id, callback);
            }
        );
    });
};

const getAreaReservationsForDate = (areaId, date, excludeId, callback) => {
    let sql = "SELECT id, hora_inicio, hora_fin, estado FROM reservas_areas WHERE area_id = ? AND fecha = ? AND estado IN ('PENDIENTE','APROBADA')";
    const values = [areaId, date];
    if (excludeId != null) { sql += " AND id <> ?"; values.push(excludeId); }
    db.query(sql, values, callback);
};

const reservationSelect = "SELECT b.id, b.area_id, b.usuario_id, DATE_FORMAT(b.fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(b.hora_inicio, '%H:%i') AS hora_inicio, TIME_FORMAT(b.hora_fin, '%H:%i') AS hora_fin, b.estado, b.created_at, a.nombre AS area_nombre, r.nombre AS residencial_nombre, u.nombre AS usuario_nombre FROM reservas_areas b INNER JOIN areas_sociales a ON a.id = b.area_id INNER JOIN residenciales r ON r.id = a.residencial_id INNER JOIN usuarios u ON u.id = b.usuario_id";

const createAreaReservation = (reservation, callback) => {
    db.query(
        "INSERT INTO reservas_areas (area_id, usuario_id, fecha, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?)",
        [reservation.area_id, reservation.usuario_id, reservation.fecha, reservation.hora_inicio, reservation.hora_fin],
        (error, result) => {
            if (error) return callback(error);
            db.query(reservationSelect + " WHERE b.id = ?", [result.insertId], (selectError, rows) => {
                if (selectError) return callback(selectError);
                callback(null, rows[0] || null);
            });
        }
    );
};

const getAreaReservations = (userId, callback) => {
    let sql = reservationSelect;
    const values = [];
    if (userId != null) { sql += " WHERE b.usuario_id = ?"; values.push(userId); }
    sql += " ORDER BY b.fecha DESC, b.hora_inicio DESC";
    db.query(sql, values, callback);
};

const getAreaReservationById = (id, callback) => {
    db.query(
        "SELECT id, area_id, usuario_id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora_inicio, hora_fin, estado FROM reservas_areas WHERE id = ?",
        [id],
        (error, rows) => {
            if (error) return callback(error);
            callback(null, rows[0] || null);
        }
    );
};

const updateAreaReservationState = (id, estado, callback) => {
    db.query("UPDATE reservas_areas SET estado = ? WHERE id = ?", [estado, id], (error, result) => {
        if (error) return callback(error);
        callback(null, result.affectedRows > 0);
    });
};


module.exports = ({
    logIn,
    register,
    paymentSave,
    getResidenciales,
    createResidencial,
    updateResidencial,
    deleteResidencial,
    getPropietarios,
    getRoles,
    getRoleById,
    updateUsuario,
    deleteUsuario,
    getPagos,
    updatePago,
    deletePago,
    maintenance,
    createMaintenance,
    postponeMaintenance,
    getMaintenanceStatuses,
    updateMaintenanceStatus,
    updateMaintenanceProperty,
    getTechnicians,
    updateMaintenanceTechnician,
    deleteMaintenance,
    getFacturas,
    getFacturaByHash,
    getFacturaById,
    createFactura,
    associateFactura,
    nextMaintenance,
    addNewAverias,
    getAverias,
    updateAveriaStatus,
    archiveCompletedAveria,
    getAreasSociales,
    getAreaSocialById,
    createAreaSocial,
    updateAreaSocial,
    getAreaReservationsForDate,
    createAreaReservation,
    getAreaReservations,
    getAreaReservationById,
    updateAreaReservationState
})
