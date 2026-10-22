const express = require("express");
const route = express.Router()
const models = require('../models/index')
const { verifyToken, SECRET } = require("../middleware/jwt.js")
const bcrypt = require("bcrypt")
const { extractInvoice } = require("../services/invoiceOcr")
const s3Storage = require("../services/s3Storage")
const crypto = require("crypto")
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
            if (!["ADMIN", "SUPERVISOR", "RESIDENTE", "TECNICO"].includes(role)) {
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
    if (role === "TECNICO" && req.method === "GET" && ["/mantenimiento", "/nextmaintenance"].includes(path)) return next();
    if (role === "RESIDENTE") {
        const areaAvailability = /^\/areas-sociales\/\d+\/disponibilidad$/.test(path);
        if (req.method === "GET" && (path === "/areas-sociales" || areaAvailability || path === "/reservas")) return next();
        if (req.method === "POST" && path === "/reservas") return next();
    }
    return res.status(403).json({ error: "No tienes permiso para acceder a esta sección." });
});

// Técnicos consultan únicamente sus mantenimientos; supervisores solo consultan averías.
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
        if (error) 
            return callback(error);
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
        if (roleError) 
            return res.status(500).json({ error: "No se pudo validar el rol." });
        const roleName = String(roleRows?.[0]?.nombre || "").toUpperCase();
        if (!roleName) 
            return res.status(400).json({ error: "Selecciona un rol existente." });
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


route.post("/pagos", (req,res) => {
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
    const monto = Number(req.body?.monto);
    const fechaCreacion = typeof req.body?.fecha_creacion === "string" ? req.body.fecha_creacion : "";
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(fechaCreacion)
        ? new Date(`${fechaCreacion}T12:00:00Z`)
        : null;
    if (!nombre || !Number.isInteger(monto) || monto < 0 || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== fechaCreacion) {
        return res.status(400).json({ error: "Ingresa un propietario, monto y fecha válidos." });
    }

    models.paymentSave(nombre, monto, fechaCreacion, (error, results) => {

        if(error) {
            res.status(500).json({ error: "No se pudo guardar el pago." })
            return;
        }
        res.status(201).json(results)
    })
})

route.put("/pagos/:id", (req, res) => {
    const nombre = typeof req.body?.nombre === "string" ? req.body.nombre.trim() : "";
    const monto = Number(req.body?.monto);
    if (!nombre || !Number.isInteger(monto) || monto < 0)
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

const invoiceFileFromRequest = (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0)
        return res.status(400).json({ error: "Adjunta un archivo para analizar." });
    if (req.body.length > 20 * 1024 * 1024)
        return res.status(413).json({ error: "El archivo supera el límite de 20 MB." });
    let filename;
    try { filename = decodeURIComponent(req.get("X-File-Name") || ""); }
    catch { return res.status(400).json({ error: "El nombre del archivo no es válido." }); }
    if (!filename || filename.length > 255) return res.status(400).json({ error: "El nombre del archivo no es válido." });
    const extension = filename.toLowerCase().split(".").pop();
    const extensionTypes = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
    const contentType = req.get("X-File-Type") || extensionTypes[extension];
    if (!extensionTypes[extension] || (contentType && contentType !== extensionTypes[extension]))
        return res.status(400).json({ error: "El formato no coincide. Usa un archivo PDF, JPG o PNG." });
    return { filename, contentType };
};

const invoiceUploadParser = express.raw({ type: "application/octet-stream", limit: "20mb" });

route.post("/ocr", invoiceUploadParser, async (req, res) => {
    const file = invoiceFileFromRequest(req, res);
    if (!file?.filename) return;
    try {
        const result = await extractInvoice(req.body, file.filename);
        const sha256 = crypto.createHash("sha256").update(req.body).digest("hex");
        res.json({ ...result, sha256, objectKey: `facturas/${sha256.slice(0, 2)}/${sha256}` });
    } catch (error) {
        const status = /Formato no admitido|máximo de|Adjunta un archivo/.test(error.message) ? 400 : 500;
        res.status(status).json({ error: `No se pudo procesar el documento: ${error.message}` });
    }
});

route.get("/facturas", (req, res) => {
    const rawMaintenanceId = req.query.mantenimiento_id;
    const maintenanceId = rawMaintenanceId == null ? null : Number(rawMaintenanceId);
    if (maintenanceId != null && (!Number.isInteger(maintenanceId) || maintenanceId < 1))
        return res.status(400).json({ error: "El mantenimiento seleccionado no es válido." });
    models.getFacturas(maintenanceId, (error, rows) => {
        if (error) return res.status(500).json({ error: "No se pudieron cargar las facturas." });
        res.json(rows);
    });
});

route.post("/facturas", invoiceUploadParser, async (req, res) => {
    const file = invoiceFileFromRequest(req, res);
    if (!file?.filename) return;
    if (!s3Storage.isConfigured()) return res.status(503).json({ error: "Falta configurar AWS_REGION, S3_BUCKET, AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY para guardar facturas." });

    const sha256 = crypto.createHash("sha256").update(req.body).digest("hex");
    const objectKey = `facturas/${sha256.slice(0, 2)}/${sha256}`;
    models.getFacturaByHash(sha256, async (lookupError, existing) => {
        if (lookupError) return res.status(500).json({ error: "No se pudo validar si la factura ya existe." });
        if (existing) return res.status(409).json({ error: "Este documento ya está guardado en el repositorio." });
        try {
            const ocr = await extractInvoice(req.body, file.filename);
            await s3Storage.putObject(objectKey, req.body, file.contentType);
            models.createFactura({
                nombre_original: file.filename,
                tipo_mime: file.contentType,
                tamano_bytes: req.body.length,
                s3_object_key: objectKey,
                sha256,
                proveedor: ocr.fields?.supplier ?? null,
                numero_factura: ocr.fields?.invoiceNumber ?? null,
                fecha_factura: ocr.fields?.date ?? null,
                total: ocr.fields?.total ?? null,
                datos_ocr: ocr.fields ?? {},
                texto_ocr: ocr.text ?? "",
                subido_por: req.user.id
            }, async (saveError, result) => {
                if (saveError) {
                    if (saveError.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Este documento ya está guardado en el repositorio." });
                    try { await s3Storage.deleteObject(objectKey); } catch (cleanupError) { console.error("No se pudo eliminar el objeto S3 después de fallar la base de datos:", cleanupError.message); }
                    return res.status(500).json({ error: "El archivo se subió a S3, pero no se pudieron guardar sus datos." });
                }
                res.status(201).json({ id: result.insertId, nombre_original: file.filename, sha256, objectKey });
            });
        } catch (error) {
            const status = /Formato no admitido|máximo de|Adjunta un archivo/.test(error.message) ? 400 : 502;
            res.status(status).json({ error: `No se pudo guardar la factura: ${error.message}` });
        }
    });
});

route.patch("/facturas/:id/mantenimiento", (req, res) => {
    const rawId = req.body?.mantenimiento_id;
    const mantenimientoId = rawId == null || rawId === "" ? null : Number(rawId);
    if (mantenimientoId !== null && (!Number.isInteger(mantenimientoId) || mantenimientoId < 1))
        return res.status(400).json({ error: "Selecciona un mantenimiento válido o deja la factura sin asociar." });
    models.associateFactura(req.params.id, mantenimientoId, (error, updated) => {
        if (error?.code === "ER_NO_REFERENCED_ROW_2") return res.status(404).json({ error: "No existe el mantenimiento seleccionado." });
        if (error) return res.status(500).json({ error: "No se pudo actualizar la asociación." });
        if (!updated) return res.status(404).json({ error: "No se encontró la factura." });
        res.json({ updated: true, mantenimiento_id: mantenimientoId });
    });
});

route.get("/facturas/:id/original", (req, res) => {
    if (!s3Storage.isConfigured()) return res.status(503).json({ error: "S3 todavía no está configurado." });
    models.getFacturaById(req.params.id, (error, invoice) => {
        if (error) return res.status(500).json({ error: "No se pudo consultar la factura." });
        if (!invoice) return res.status(404).json({ error: "No se encontró la factura." });
        try { res.redirect(302, s3Storage.getSignedUrl(invoice.s3_object_key)); }
        catch (signError) { res.status(502).json({ error: `No se pudo abrir el original: ${signError.message}` }); }
    });
});



//login Overdue maintenance

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

route.patch("/averias/:id/estado", (req, res) => {
    const id = Number(req.params.id);
    const allowedStates = ["Reportada", "En proceso", "Completada", "Cancelada"];
    const estado = typeof req.body?.estado === "string" ? req.body.estado.trim() : "";
    if (!Number.isInteger(id) || id < 1 || !allowedStates.includes(estado)) {
        return res.status(400).json({ error: "Selecciona una avería y un estado válidos." });
    }
    models.updateAveriaStatus(id, estado, (error, updated) => {
        if (error) return res.status(500).json({ error: "No se pudo actualizar el estado de la avería." });
        if (!updated) return res.status(404).json({ error: "No se encontró la avería activa." });
        res.json({ updated: true, estado });
    });
});

route.delete("/averias/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Selecciona una avería válida." });
    models.archiveCompletedAveria(id, (error, result) => {
        if (error) return res.status(500).json({ error: "No se pudo archivar la avería." });
        if (!result?.found && !result?.deleted) return res.status(404).json({ error: "No se encontró la avería." });
        if (result?.alreadyArchived) return res.status(404).json({ error: "La avería ya fue eliminada de la lista." });
        if (!result?.deleted) return res.status(409).json({ error: "Solo puedes eliminar una avería cuando su estado sea Completada." });
        res.json({ deleted: true, historial_conservado: true });
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

    const technicianId = req.user.role === "TECNICO" ? req.user.id : null;
    models.maintenance(technicianId, (error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})

route.get("/estados-mantenimiento", (req, res) => {
    models.getMaintenanceStatuses((error, results) => {
        if (error) return res.status(500).json({ error: "No se pudieron cargar los estados de mantenimiento." });
        res.json(results);
    });
});

route.post("/maintenance", (req, res) => {
    const tipo = typeof req.body?.tipo === "string" ? req.body.tipo.trim() : "";
    const descripcion = typeof req.body?.descripcion === "string" ? req.body.descripcion.trim() : "";
    const fecha_programada = typeof req.body?.fecha_programada === "string" ? req.body.fecha_programada : "";
    const residencial_id = Number(req.body?.residencial_id);
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(fecha_programada)
        ? new Date(`${fecha_programada}T12:00:00Z`)
        : null;
    if (!tipo || !descripcion || !Number.isInteger(residencial_id) || residencial_id < 1 || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== fecha_programada) {
        return res.status(400).json({ error: "Ingresa actividad, descripción, propiedad y una fecha límite válidas." });
    }
    models.createMaintenance({ tipo, descripcion, fecha_programada, residencial_id }, (error, id) => {
        if (error?.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "La propiedad seleccionada ya no existe." });
        if (error) return res.status(500).json({ error: "No se pudo guardar el mantenimiento." });
        res.status(201).json({ id, tipo, descripcion, residencial_id, fecha_programada });
    });
});

route.patch("/mantenimiento/:id/posponer", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "El mantenimiento seleccionado no es válido." });
    models.postponeMaintenance(id, (error, updated) => {
        if (error) return res.status(500).json({ error: "No se pudo reprogramar el mantenimiento." });
        if (!updated) return res.status(404).json({ error: "No se encontró el mantenimiento." });
        res.json({ updated: true, meses_agregados: 3 });
    });
});

route.patch("/mantenimiento/:id/estado", (req, res) => {
    const id = Number(req.params.id);
    const estado_id = Number(req.body?.estado_id);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(estado_id) || estado_id < 1 || estado_id > 5) {
        return res.status(400).json({ error: "Selecciona un mantenimiento y un estado válidos." });
    }
    models.updateMaintenanceStatus(id, estado_id, (error, updated) => {
        if (error?.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "El estado seleccionado no existe." });
        if (error) return res.status(500).json({ error: "No se pudo actualizar el estado del mantenimiento." });
        if (!updated) return res.status(404).json({ error: "No se encontró el mantenimiento." });
        res.json({ updated: true, estado_id });
    });
});

route.patch("/mantenimiento/:id/propiedad", (req, res) => {
    const id = Number(req.params.id);
    const residencial_id = Number(req.body?.residencial_id);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(residencial_id) || residencial_id < 1) {
        return res.status(400).json({ error: "Selecciona un mantenimiento y una propiedad válidos." });
    }
    models.updateMaintenanceProperty(id, residencial_id, (error, updated) => {
        if (error?.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "La propiedad seleccionada ya no existe." });
        if (error) return res.status(500).json({ error: "No se pudo asignar la propiedad." });
        if (!updated) return res.status(404).json({ error: "No se encontró el mantenimiento." });
        res.json({ updated: true, residencial_id });
    });
});

route.get("/tecnicos", (req, res) => {
    models.getTechnicians((error, results) => {
        if (error) return res.status(500).json({ error: "No se pudieron cargar los técnicos." });
        res.json(results);
    });
});

route.patch("/mantenimiento/:id/tecnico", (req, res) => {
    const id = Number(req.params.id);
    const rawTechnicianId = req.body?.tecnico_id;
    const tecnico_id = rawTechnicianId == null || rawTechnicianId === "" ? null : Number(rawTechnicianId);
    if (!Number.isInteger(id) || id < 1 || (tecnico_id !== null && (!Number.isInteger(tecnico_id) || tecnico_id < 1))) {
        return res.status(400).json({ error: "Selecciona un mantenimiento y un técnico válidos." });
    }
    models.updateMaintenanceTechnician(id, tecnico_id, (error, updated) => {
        if (error?.code === "ER_NO_REFERENCED_ROW_2") return res.status(400).json({ error: "El técnico seleccionado ya no existe." });
        if (error) return res.status(500).json({ error: "No se pudo asignar el técnico. Verifica que se aplicó la migración de mantenimientos." });
        if (!updated) return res.status(404).json({ error: "No se encontró el mantenimiento." });
        res.json({ updated: true, tecnico_id });
    });
});

route.delete("/mantenimiento/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "El mantenimiento seleccionado no es válido." });
    models.deleteMaintenance(id, (error, deleted) => {
        if (error) return res.status(500).json({ error: "No se pudo eliminar el mantenimiento." });
        if (!deleted) return res.status(404).json({ error: "No se encontró el mantenimiento." });
        res.json({ deleted: true, archived: true });
    });
});

route.get("/nextmaintenance", (req,res) => {

    const technicianId = req.user.role === "TECNICO" ? req.user.id : null;
    models.nextMaintenance(technicianId, (error, results) => {

        if(error) {
            res.status(500).send(error)
            return;
        }
        res.status(200).send(results)
    })
})




module.exports = route
