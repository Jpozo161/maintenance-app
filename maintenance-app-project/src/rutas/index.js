const express = require("express");
const route = express.Router()
const models = require('../models/index')
const { verifyToken, SECRET } = require("../middleware/jwt.js")
const bcrypt = require("bcrypt")
const { extractInvoice } = require("../services/invoiceOcr")
const jwt = require("jsonwebtoken")


route.post("/login", (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ error: "Ingresa correo y contraseña." });

    models.logIn(email, (error, results) => {
        if (error) return res.status(500).json({ error: "No se pudo validar el acceso." });
        const user = results?.[0];
        if (!user) return res.status(401).json({ error: "Correo o contraseña incorrectos." });

        bcrypt.compare(password, user.password, (compareError, valid) => {
            if (compareError || !valid) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
            const role = String(user.role_name || "").trim().toUpperCase();
            if (!["ADMIN", "SUPERVISOR", "RESIDENTE"].includes(role)) {
                return res.status(403).json({ error: "Tu rol no tiene acceso a este sistema." });
            }

            const sessionUser = { id: user.id, name: user.nombre, email: user.email, role, residencial_id: user.residencial_id };
            const token = jwt.sign(sessionUser, SECRET, { expiresIn: "2h" });
            res.cookie("token", token, {
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: "/",
                maxAge: 2 * 60 * 60 * 1000
            });
            res.json({ user: sessionUser });
        });
    });
});

route.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });
    res.json({ signedOut: true });
});

route.get("/me", verifyToken, (req, res) => {
    const { id, name, email, role, residencial_id } = req.user;
    res.json({ user: { id, name, email, role, residencial_id } });
});

const authorizeByRole = (req, res, next) => verifyToken(req, res, () => {
    const role = String(req.user?.role || "").toUpperCase();
    const path = req.path.replace(/\/$/, "");
    if (role === "ADMIN") return next();
    if (role === "SUPERVISOR" && req.method === "GET" && path === "/averias") return next();
    if (role === "RESIDENTE") {
        const areaAvailability = /^\/areas-sociales\/\d+\/disponibilidad$/.test(path);
        if (req.method === "GET" && (path === "/areas-sociales" || areaAvailability || path === "/reservas")) return next();
        if (req.method === "POST" && path === "/reservas") return next();
    }
    return res.status(403).json({ error: "No tienes permiso para acceder a esta sección." });
});

// El supervisor solo puede consultar averías; el administrador puede usar todas las rutas protegidas.
route.use(authorizeByRole);


const timeToMinutes = (value) => {
    const match = String(value || "").match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
};
const minutesToTime = (value) => String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
const localToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const localCurrentMinutes = () => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());
    return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 +
        Number(parts.find((part) => part.type === "minute")?.value || 0);
};

const loadAvailability = (area, date, excludeId, callback) => {
    models.getAreaReservationsForDate(area.id, date, excludeId, (error, reservations) => {
        if (error) return callback(error);
        const opening = timeToMinutes(area.hora_apertura);
        const closing = timeToMinutes(area.hora_cierre);
        const interval = Number(area.intervalo_minutos);
        if (!Number.isFinite(opening) || !Number.isFinite(closing) || interval < 1 || closing <= opening)
            return callback(new Error("El horario del área no es válido."));
        const slots = [];
        const today = date === localToday();
        const currentMinutes = today ? localCurrentMinutes() : -1;
        for (let start = opening; start + interval <= closing; start += interval) {
            const end = start + interval;
            const occupied = (today && start <= currentMinutes) || reservations.some((reservation) =>
                start < timeToMinutes(reservation.hora_fin) && end > timeToMinutes(reservation.hora_inicio)
            );
            slots.push({ hora_inicio: minutesToTime(start), hora_fin: minutesToTime(end), disponible: !occupied });
        }
        callback(null, slots);
    });
};

const normalizeArea = (body) => {
    const residencial_id = Number(body?.residencial_id);
    const nombre = typeof body?.nombre === "string" ? body.nombre.trim() : "";
    const descripcion = typeof body?.descripcion === "string" ? body.descripcion.trim() : "";
    const hora_apertura = typeof body?.hora_apertura === "string" ? body.hora_apertura : "";
    const hora_cierre = typeof body?.hora_cierre === "string" ? body.hora_cierre : "";
    const intervalo_minutos = Number(body?.intervalo_minutos);
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
    if (!Number.isInteger(residencial_id) || residencial_id < 1 || !nombre || nombre.length > 150 ||
        !timePattern.test(hora_apertura) || !timePattern.test(hora_cierre) ||
        timeToMinutes(hora_cierre) <= timeToMinutes(hora_apertura) ||
        !Number.isInteger(intervalo_minutos) || intervalo_minutos < 15 || intervalo_minutos > 720) return null;
    return {
        residencial_id, nombre, descripcion: descripcion || null,
        hora_apertura: hora_apertura.length === 5 ? hora_apertura + ":00" : hora_apertura,
        hora_cierre: hora_cierre.length === 5 ? hora_cierre + ":00" : hora_cierre,
        intervalo_minutos, activa: body?.activa === false || Number(body?.activa) === 0 ? 0 : 1
    };
};

route.get("/areas-sociales", (req, res) => {
    const isResident = req.user.role === "RESIDENTE";
    if (isResident && !req.user.residencial_id) return res.status(403).json({ error: "Tu cuenta no tiene un residencial asignado." });
    models.getAreasSociales(isResident ? req.user.residencial_id : null, isResident, (error, rows) => {
        if (error) return res.status(500).json({ error: "No se pudieron cargar las áreas sociales." });
        res.json(rows);
    });
});

route.post("/areas-sociales", (req, res) => {
    const area = normalizeArea(req.body);
    if (!area) return res.status(400).json({ error: "Revisa el nombre, residencial y horario del área." });
    models.createAreaSocial(area, (error, created) => {
        if (error) return res.status(500).json({ error: error.code === "ER_DUP_ENTRY" ? "Ya existe un área con ese nombre en el residencial." : "No se pudo guardar el área." });
        res.status(201).json(created);
    });
});

route.put("/areas-sociales/:id", (req, res) => {
    const area = normalizeArea(req.body);
    if (!area) return res.status(400).json({ error: "Revisa el nombre, residencial y horario del área." });
    models.updateAreaSocial(req.params.id, area, (error, updated) => {
        if (error) return res.status(500).json({ error: error.code === "ER_DUP_ENTRY" ? "Ya existe un área con ese nombre en el residencial." : "No se pudo actualizar el área." });
        if (!updated) return res.status(404).json({ error: "No se encontró el área social." });
        res.json(updated);
    });
});

route.get("/areas-sociales/:id/disponibilidad", (req, res) => {
    const fecha = typeof req.query.fecha === "string" ? req.query.fecha : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < localToday())
        return res.status(400).json({ error: "Selecciona una fecha válida a partir de hoy." });
    models.getAreaSocialById(req.params.id, (error, area) => {
        if (error) return res.status(500).json({ error: "No se pudo consultar el área." });
        if (!area || !area.activa || (req.user.role === "RESIDENTE" && Number(area.residencial_id) !== Number(req.user.residencial_id)))
            return res.status(404).json({ error: "El área no está disponible para tu residencial." });
        loadAvailability(area, fecha, null, (availabilityError, slots) => {
            if (availabilityError) return res.status(500).json({ error: "No se pudo calcular la disponibilidad." });
            res.json({ area_id: area.id, fecha, slots });
        });
    });
});

route.get("/reservas", (req, res) => {
    const userId = req.user.role === "RESIDENTE" ? req.user.id : null;
    models.getAreaReservations(userId, (error, rows) => {
        if (error) return res.status(500).json({ error: "No se pudieron cargar las reservas." });
        res.json(rows);
    });
});

route.post("/reservas", (req, res) => {
    const areaId = Number(req.body?.area_id);
    const fecha = typeof req.body?.fecha === "string" ? req.body.fecha : "";
    const hora_inicio = typeof req.body?.hora_inicio === "string" ? req.body.hora_inicio : "";
    const hora_fin = typeof req.body?.hora_fin === "string" ? req.body.hora_fin : "";
    if (!Number.isInteger(areaId) || areaId < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < localToday())
        return res.status(400).json({ error: "Selecciona un área y una fecha válida." });
    models.getAreaSocialById(areaId, (error, area) => {
        if (error) return res.status(500).json({ error: "No se pudo consultar el área." });
        if (!area || !area.activa || Number(area.residencial_id) !== Number(req.user.residencial_id))
            return res.status(404).json({ error: "El área no está disponible para tu residencial." });
        loadAvailability(area, fecha, null, (availabilityError, slots) => {
            if (availabilityError) return res.status(500).json({ error: "No se pudo consultar la disponibilidad." });
            const selected = slots.find((slot) => slot.hora_inicio === hora_inicio && slot.hora_fin === hora_fin && slot.disponible);
            if (!selected) return res.status(409).json({ error: "Ese horario ya no está disponible. Actualiza la disponibilidad." });
            models.createAreaReservation({ area_id: areaId, usuario_id: req.user.id, fecha, hora_inicio, hora_fin }, (saveError, booking) => {
                if (saveError) return res.status(500).json({ error: "No se pudo solicitar la reserva." });
                res.status(201).json(booking);
            });
        });
    });
});

route.patch("/reservas/:id", (req, res) => {
    const estado = String(req.body?.estado || "").toUpperCase();
    if (!["APROBADA", "RECHAZADA"].includes(estado))
        return res.status(400).json({ error: "La solicitud debe aprobarse o rechazarse." });
    models.getAreaReservationById(req.params.id, (findError, booking) => {
        if (findError) return res.status(500).json({ error: "No se pudo consultar la solicitud." });
        if (!booking) return res.status(404).json({ error: "No se encontró la solicitud." });
        if (booking.estado !== "PENDIENTE") return res.status(409).json({ error: "Esta solicitud ya fue revisada." });
        const saveState = () => models.updateAreaReservationState(req.params.id, estado, (updateError, updated) => {
            if (updateError) return res.status(500).json({ error: "No se pudo actualizar la solicitud." });
            res.json({ updated });
        });
        if (estado === "RECHAZADA") return saveState();
        models.getAreaSocialById(booking.area_id, (areaError, area) => {
            if (areaError || !area) return res.status(500).json({ error: "No se pudo validar el horario del área." });
            loadAvailability(area, String(booking.fecha).slice(0, 10), booking.id, (availabilityError, slots) => {
                if (availabilityError) return res.status(500).json({ error: "No se pudo validar la disponibilidad." });
                const conflict = slots.some((slot) => !slot.disponible &&
                    timeToMinutes(slot.hora_inicio) < timeToMinutes(booking.hora_fin) &&
                    timeToMinutes(slot.hora_fin) > timeToMinutes(booking.hora_inicio));
                if (conflict) return res.status(409).json({ error: "El horario ya fue ocupado por otra solicitud." });
                saveState();
            });
        });
    });
});


route.get("/test", (req, res) => res.status(200).send("working properly"));

//login register

route.post("/register",  (req, res) => {
         
    const { nombre, contrasena, email, role, residencial_id } = req.body || {};
    const roleId = Number(role);
    const residentialId = residencial_id ? Number(residencial_id) : null;
    if (!nombre || !contrasena || !email || !Number.isInteger(roleId) || roleId < 1) {
        return res.status(400).json({ error: "Faltan nombre, correo, contraseña o rol." });
    }
    if (residentialId != null && (!Number.isInteger(residentialId) || residentialId < 1)) {
        return res.status(400).json({ error: "El residencial seleccionado no es válido." });
    }
    models.getRoleById(roleId, (roleError, roleRows) => {
        if (roleError) return res.status(500).json({ error: "No se pudo validar el rol." });
        const roleName = String(roleRows?.[0]?.nombre || "").toUpperCase();
        if (!roleName) return res.status(400).json({ error: "Selecciona un rol existente." });
        if (roleName === "RESIDENTE" && !residentialId) {
            return res.status(400).json({ error: "Asigna un residencial a la cuenta residente." });
        }
        const validPassword = bcrypt.hashSync(contrasena, 10);
        models.register(nombre.trim(), email.trim(), validPassword, roleId, residentialId, (error, results) => {
            if (error) return res.status(500).json({ error: "Error guardando datos." });
            res.status(201).json(results);
        });
    });


})


route.post("/", (req, res) => {

    const {edificio, direccion} = req.body

    models.postClient(edificio, direccion, (error, results) => {
        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).json(results)
    })
})



route.post("/pagos", (req,res) => {
    const {monto, nombre} = req.body

    models.paymentSave(nombre, monto ,(error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})

route.put("/pagos/:id", (req, res) => {
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
    const monto = Number(req.body?.monto);
    if (!nombre || !Number.isFinite(monto) || monto < 0)
        return res.status(400).json({ error: "Ingresa un propietario y un monto válido." });
    models.updatePago(req.params.id, nombre, monto, (error, updated) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!updated) return res.status(404).json({ error: "No se encontró el pago." });
        res.json({ updated: true });
    });
});

route.delete("/pagos/:id", (req, res) => {
    models.deletePago(req.params.id, (error, deleted) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!deleted) return res.status(404).json({ error: "No se encontró el pago." });
        res.json({ deleted: true });
    });
});

route.post("/ocr", express.raw({ type: "application/octet-stream", limit: "20mb" }), async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        return res.status(400).json({ error: "Adjunta un archivo para analizar." });
    if (req.body.length > 20 * 1024 * 1024)
        return res.status(413).json({ error: "El archivo supera el límite de 20 MB." });
    let filename;
    try { filename = decodeURIComponent(req.get("X-File-Name") || ""); }
    catch { return res.status(400).json({ error: "El nombre del archivo no es válido." }); }
    try {
        res.json(await extractInvoice(req.body, filename));
    } catch (error) {
        const status = /Formato no admitido|máximo de|Adjunta un archivo/.test(error.message) ? 400 : 500;
        res.status(status).json({ error: `No se pudo procesar el documento: ${error.message}` });
    }
});



//login Overdue maintenance

route.post("/maintenance", async (req, res) => { 

    const {estado} = req.body

    models.overDueMaintenance(estado, (error, results) => {
        if(error) {
            res.status(500).send({error: "error obteniendo datos"})
            return;
        }
        
        res.status(200).send(results)
        
    })
})


route.get("/residenciales", (req,res) => {

    models.getResidenciales((error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})



route.post("/residenciales", (req, res) => {
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";

    if (!nombre) 
        return res.status(400).json({ error: "El nombre del residencial es obligatorio." });

    models.createResidencial(nombre, (error, item) => {
        if (error) 
            return res.status(500).json({ error: error.message });

        res.status(201).json(item);
    });
});

route.put("/residenciales/:id", (req, res) => {

    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";

    if (!nombre) 
        return res.status(400).json({ error: "El nombre del residencial es obligatorio." });

    models.updateResidencial(req.params.id, nombre, (error, item) => {
        if (error) 
            return res.status(500).json({ error: error.message });
        if (!item) 
            return res.status(404).json({ error: "No se encontró el residencial." });
        res.json(item);
    });
});

route.delete("/residenciales/:id", (req, res) => {

    models.deleteResidencial(req.params.id, (error, results) => {
        if (error) 
            return res.status(500).json({ error: error.message });
        if (!results) 
            return res.status(404).json({ error: "No se encontró el residencial." });
        res.json({ deleted: true });
    });
});

route.post("/reportaverias", (req, res) => {
    const { residencial_id, descripcion, categoria} = req.body
    models.addNewAverias(residencial_id, descripcion, categoria, (error, results) => {
        if (error) 
            return res.status(500).json({ error: error.message });
        if (!results) 
            return res.status(404).json({ error: "No se encontró el residencial." });
        res.status(200).json(results);
    });
});

route.get("/averias", (req, res) => {

    models.getAverias((error, results) => {
        if (error) 
            return res.status(500).json({ error: error.message });
        if (!results) 
            return res.status(404).json({ error: "No se encontró el residencial." });
        res.status(200).json(results);
    });
});



route.get("/propietarios", (req,res) => {

    models.getPropietarios((error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})

route.get("/roles", (req, res) => {
    models.getRoles((error, results) => {
        if (error) return res.status(500).json({ error: error.message });
        res.json(results);
    });
});

route.put("/propietarios/:id", (req, res) => {
    const { nombre, email } = req.body ?? {};
    const roleId = Number(req.body?.role_id);
    const residencialId = req.body?.residencial_id == null || req.body.residencial_id === ""
        ? null
        : Number(req.body.residencial_id);
    if (typeof nombre !== "string" || !nombre.trim() || typeof email !== "string" || !email.trim() || !Number.isInteger(roleId) || roleId < 1 || (residencialId !== null && (!Number.isInteger(residencialId) || residencialId < 1))) {
        return res.status(400).json({ error: "Revisa el nombre, correo, tipo de rol y residencial." });
    }
    models.updateUsuario(req.params.id, {
        nombre: nombre.trim(),
        email: email.trim(),
        role_id: roleId,
        residencial_id: residencialId
    }, (error, updated) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!updated) return res.status(404).json({ error: "No se encontró el usuario." });
        res.json({ updated: true });
    });
});

route.delete("/propietarios/:id", (req, res) => {
    models.deleteUsuario(req.params.id, (error, deleted) => {
        if (error) return res.status(500).json({ error: error.message });
        if (!deleted) return res.status(404).json({ error: "No se encontró el usuario." });
        res.json({ deleted: true });
    });
});


route.get("/pagos", (req,res) => {

    models.getPagos((error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})


route.get("/mantenimiento", (req,res) => {

    models.maintenance((error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})

route.get("/nextmaintenance", (req,res) => {

    models.nextMaintenance((error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})




module.exports = route