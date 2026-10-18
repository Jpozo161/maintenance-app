const db = require('../../db.js');

const getUser = (callback) => {

    const sql = "SELECT * FROM user"

    db.query(
        sql,
        callback
    )
}


const getAverias = (callback) => {

    const sql = "SELECT a.descripcion, a.categoria, r.nombre AS nombre_residencial, a.fecha FROM averias AS a INNER JOIN residenciales AS r ON r.id = a.residencial_id"

    db.query(
        sql,
        callback
    )
}


const postClient = (edificio, direccion, callback) => {

    const sql = " INSERT INTO maintenance (edificio, direccion) VALUES(?,?)"

    db.query(
        sql,
        [edificio, direccion],
        callback
    )

}


const logIn = (email, callback) => {
    const sql = `
        SELECT u.id, u.nombre, u.email, u.password, u.role_id, u.residencial_id, roles.nombre AS role_name
        FROM usuarios AS u
        LEFT JOIN roles ON roles.id = u.role_id
        WHERE u.email = ?`;
        
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

const maintenance = (callback) => {
    const sql = "select tipo, descripcion, fecha_programada, estado_id from mantenimientos"

    db.query(
        sql,
        callback
    )
}

const overDueMaintenance = (estado, callback) => {
    const sql = "SELECT * FROM mantenimientos m WHERE estado_id = (SELECT id FROM estados_mantenimiento WHERE nombre = ?) and fecha_programada < NOW()"


    db.query(
        sql,
        [estado],
        callback
    )

}

const nextMaintenance = (callback) => {
    const sql = "SELECT fecha_programada, descripcion, estado_id FROM mantenimientos WHERE fecha_programada > NOW()";
    db.query(sql, callback);
};

const paymentSave = (nombre, monto, callback) => {
    const sql = "INSERT INTO pagos (nombre, monto) VALUE(?,?)"

    db.query(
        sql,
        [nombre,monto],
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
                "SELECT * FROM residenciales WHERE residencial_id = ?",
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
        "UPDATE residenciales SET nombre = ? WHERE residencial_id = ?",
        [nombre, id],
        (error) => {
            if (error)
                return callback(error);

            db.query(
                "SELECT * FROM residenciales WHERE residencial_id = ?",
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
        (error) => {
            if (error)
                return callback(error);

            db.query(
                "SELECT * FROM averias",
                (selectError, rows) => {
                    if (selectError)
                        return callback(selectError);

                    callback(null, rows[0] || null);
                }
            );
        }
    );
};


const deleteResidencial = (id, callback) => {
    db.query(
        "DELETE FROM residenciales WHERE residencial_id = ?",
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
    db.query("DELETE FROM usuarios WHERE id = ?", [id], (error, result) => {
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
    postClient,
    getUser,
    logIn,
    register,
    overDueMaintenance,
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
    nextMaintenance,
    addNewAverias,
    getAverias,
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