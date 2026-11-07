# Revisión y reestructuración del backend

**Proyecto:** maintenance-app-project (API de mantenimiento residencial)
**Fecha:** 30 de octubre de 2026

---

## 1. Resumen

El backend funcionaba como MVP, pero tal como estaba no era fácil de mantener ni de hacer crecer:

- Toda la lógica vivía en dos archivos grandes (`src/rutas/index.js` con 723 líneas y `src/models/index.js` con 558).
- Había varios problemas de seguridad y estabilidad.

Se reorganizó en **módulos por funcionalidad** y se corrigieron los problemas encontrados, excepto las credenciales de la base de datos, que se dejaron como estaban a propósito porque el proyecto sigue en desarrollo.

Las URLs y las respuestas de la API **no cambiaron**, así que el frontend sigue funcionando sin tocarlo. Esto se comprobó comparando el backend viejo con el nuevo: las 61 respuestas `GET` con datos, para los 4 roles, salieron idénticas.

---

## 2. Diagnóstico inicial

### Lo que ya estaba bien

- **Consultas SQL parametrizadas** (`?`) en todo el código, sin riesgo de inyección SQL.
- **Contraseñas con bcrypt** y sesión en una cookie `httpOnly`.
- **Permisos cerrados por defecto**: si una ruta no estaba en la lista, solo ADMIN podía usarla.
- **Borrado lógico** (`eliminado_en`, `estado = 0`) para conservar el historial.
- **Facturas sin duplicados** (identificadas por su hash sha256), guardadas en un S3 privado con URLs firmadas.

### Problemas encontrados

| Prioridad | Problema | Estado |
|---|---|---|
| 🔴 Crítico | Credenciales de MySQL (`root` / `12345678`) escritas en el código | **Pendiente a propósito** (proyecto en desarrollo) |
| 🔴 Crítico | Clave del JWT por defecto `"secret"`: cualquiera podía fabricar un token de ADMIN | ✅ Corregido |
| 🔴 Crítico | Una sola conexión a MySQL: si se caía, la API dejaba de responder | ✅ Corregido |
| 🔴 Crítico | Errores internos de MySQL (SQL, tablas) enviados al navegador | ✅ Corregido |
| 🔴 Crítico | Dos residentes podían reservar el mismo horario al mismo tiempo | ✅ Corregido |
| 🔴 Crítico | Un usuario desactivado seguía con acceso hasta 2 horas | ✅ Corregido |
| 🔴 Crítico | Sin límite de intentos en el login ni cabeceras de seguridad | ✅ Corregido |
| 🟠 Mantenibilidad | Dos archivos que lo hacían todo | ✅ Corregido |
| 🟠 Mantenibilidad | Callbacks anidados hasta 5 niveles | ✅ Corregido (`async/await`) |
| 🟠 Mantenibilidad | Permisos definidos con expresiones regulares sobre la URL | ✅ Corregido (`requireRole` en cada ruta) |
| 🟠 Mantenibilidad | Números mágicos (`estado_id` 3, 4, 5) | ✅ Corregido (constantes con nombre) |
| 🟠 Mantenibilidad | Formato de error inconsistente (`send(error)` y `json({error})`) | ✅ Corregido |
| 🟠 Mantenibilidad | `/reportaverias` sin validación | ✅ Corregido |
| 🟠 Mantenibilidad | `SHOW KEYS FROM pagos` en cada petición | ✅ Corregido |
| 🟠 Mantenibilidad | Dependencias sin uso (`ws`, `websocket`, `node`) | ✅ Eliminadas |
| 🟡 Crecimiento | Sin migraciones: no se podía crear la BD desde cero | ✅ Corregido |
| 🟡 Crecimiento | Sin paginación | ✅ Corregido (opcional) |
| 🟡 Crecimiento | OCR sin límite de procesos simultáneos | ✅ Corregido (máx. 2) |
| 🟡 Crecimiento | `bcrypt.hashSync` bloqueaba el servidor | ✅ Corregido |
| 🟡 Crecimiento | Puerto, CORS y zona horaria fijos en el código | ✅ Corregido (variables de entorno) |
| 🟡 Crecimiento | Sin tests ni endpoint de salud | ✅ Corregido |
| 🟡 Crecimiento | Logs estructurados, linter, cola para el OCR, varias administradoras | Pendiente (ver sección 7) |

### Bugs del lector de facturas (OCR)

Ya existían antes del refactor y salieron a la luz al escribir los tests:

1. `"30.000"` se leía como **30** y no como treinta mil. Esto afectaba a todas las facturas en pesos colombianos.
2. El **total** tomaba el valor del **subtotal**, porque la palabra "total" aparece dentro de "Subtotal".
3. Las líneas "Factura No: …" y "Fecha: …" se guardaban como productos.

Los tres están corregidos y cubiertos por tests.

---

## 3. Nueva estructura

```
maintenance-app-project/
├── app.js                       Punto de entrada (npm start)
├── .env                         Configuración local (no se sube a git)
├── .env.example                 Plantilla de variables
├── docs/REVISION-BACKEND.md     Este documento
├── migrations/
│   ├── 001_esquema_inicial.sql  Esquema completo + triggers + datos fijos
│   └── historico/               Scripts viejos (solo referencia)
├── scripts/migrate.js           Aplica migraciones pendientes
├── tests/                       Tests (npm test)
└── src/
    ├── server.js                Arma la app de Express (middlewares + rutas)
    ├── routes.js                Registra todos los módulos
    ├── config/
    │   ├── env.js               Puerto, CORS, zona horaria, JWT
    │   └── db.js                Pool de MySQL y withTransaction()
    ├── constants/index.js       Roles, estados de mantenimiento, avería y reserva
    ├── middleware/
    │   ├── auth.js              verifyToken, requireRole, adminOnly
    │   └── errorHandler.js      Respuesta única para todos los errores
    ├── utils/                   HttpError, validadores, fechas/horas, paginación
    ├── services/                S3 y OCR (servicios externos)
    └── modules/
        ├── auth/                login, logout, me
        ├── usuarios/            register, propietarios, roles, técnicos
        ├── residenciales/
        ├── pagos/
        ├── averias/
        ├── mantenimientos/
        ├── facturas/
        ├── areasSociales/       áreas + cálculo de disponibilidad
        └── reservas/
```

### Qué va en cada archivo de un módulo

| Archivo | Responsabilidad | Ejemplo |
|---|---|---|
| `*.routes.js` | HTTP: validar la entrada, verificar permisos y responder | `router.post("/pagos", adminOnly, …)` |
| `*.service.js` | Reglas de negocio (solo cuando hay lógica real) | Reservar con bloqueo, guardar factura en S3 + BD |
| `*.repository.js` | Solo SQL | `findAll`, `create`, `update` |

Los módulos simples (pagos, residenciales) no tienen `service`: no hace falta crear archivos vacíos.

### Cómo manejar los errores

En lugar de responder a mano en cada ruta, se lanza un error:

```js
if (!pago) throw new HttpError(404, "No se encontró el pago.");
```

El `errorHandler` lo convierte en `{ "error": "No se encontró el pago." }` con el código HTTP indicado. Cualquier otro error (de MySQL, de S3, etc.) se registra en la consola del servidor y el usuario solo ve un mensaje genérico. Express 5 captura solo los errores de las funciones `async`, así que no hace falta `try/catch` en cada ruta.

---

## 4. Cambios importantes en detalle

### Seguridad

- **`JWT_SECRET` obligatorio.** La app no arranca sin él. Se generó uno aleatorio en `.env`.
- **El usuario se vuelve a cargar de la BD en cada petición** (`verifyToken`). Si se desactiva una cuenta o se le cambia el rol, el cambio aplica al instante.
- **Permisos declarados en cada ruta:**
  ```js
  router.get("/averias", requireRole(ROLES.SUPERVISOR), …)  // ADMIN + SUPERVISOR
  router.post("/pagos", adminOnly, …)                       // solo ADMIN
  ```
  El test `tests/permisos.test.js` recorre todas las rutas y falla si alguna no declara roles o si un rol tiene más acceso del esperado.
- **Límite de intentos en el login:** 10 fallidos por IP cada 15 minutos.
- **`helmet`** añade las cabeceras de seguridad estándar.

### Reservas sin duplicados

Crear y aprobar una reserva ocurre dentro de una **transacción que bloquea la fila del área** (`SELECT … FOR UPDATE`). Si dos residentes piden el mismo horario a la vez, el segundo espera y luego ve el horario ocupado. Se probó con 6 peticiones simultáneas: se creó 1 y las otras 5 recibieron 409.

El cálculo de horarios está en `modules/areasSociales/disponibilidad.js`. Es una función pura (no consulta la BD), así que tiene sus propios tests.

### Base de datos

- **Pool de 10 conexiones** con reconexión automática.
- **Migraciones versionadas** en `migrations/`. El runner registra en la tabla `schema_migrations` cuáles ya se aplicaron.
- **Los estados, roles y tiempos son constantes** en `src/constants/index.js`, por ejemplo `ESTADOS_MANTENIMIENTO.PROXIMO` en vez de `5`.

### Paginación opcional

Las listas grandes aceptan `?limit=50&offset=100`. Sin esos parámetros devuelven todo, igual que antes, así que el frontend no necesita cambios. Aplica a usuarios, pagos, averías, mantenimientos, facturas y reservas. El máximo es 500 por página.

### Comportamientos que cambiaron (a propósito)

| Antes | Ahora |
|---|---|
| Correo duplicado al registrar: 500 "Error guardando datos." | 409 "Ya existe un usuario con ese correo." |
| Borrar un residencial con datos asociados: 500 con el error de MySQL | 409 con un mensaje claro |
| Ruta inexistente: 403 | 404 |
| `/me` devolvía los datos guardados en el token | Devuelve los datos actuales de la BD |
| Un mantenimiento archivado podía seguir editándose | Responde 404 |
| Errores de S3 u OCR mostraban el detalle técnico | Mensaje claro; el detalle queda en la consola del servidor |

---

## 5. Cómo usar el proyecto

```bash
npm install
npm start            # arranca la API en el puerto 3000
npm run dev          # igual, pero se reinicia al guardar cambios
npm test             # 53 tests: permisos, disponibilidad, OCR, validadores
```

### ⚠️ Una sola vez en tu base de datos actual

Tu BD `mantenimiento` ya tiene todas las tablas. Antes de usar migraciones, márcala como "al día":

```bash
npm run migrate:baseline
```

Esto solo crea la tabla `schema_migrations` y registra `001_esquema_inicial.sql` como aplicada. No modifica ninguna otra tabla.

### En una base de datos nueva (otra PC o un servidor)

```bash
npm run migrate      # crea todas las tablas, triggers y datos fijos
```

### Variables de entorno

Ver `.env.example`. La única obligatoria es `JWT_SECRET`. Las demás tienen valores por defecto: `PORT`, `CORS_ORIGIN`, `APP_TIME_ZONE`, `DB_HOST`, `DB_NAME` y las de S3.

---

## 6. Guía para crecer

### Agregar un módulo nuevo (ejemplo: "visitantes")

1. Crea `src/modules/visitantes/visitantes.repository.js` con el SQL.
2. Crea `src/modules/visitantes/visitantes.routes.js`. En cada ruta pon `adminOnly` o `requireRole(...)` y valida con los helpers de `utils/validators.js`.
3. Si hay reglas de negocio, agrega `visitantes.service.js`.
4. Regístralo en `src/routes.js`:
   ```js
   router.use(require("./modules/visitantes/visitantes.routes"));
   ```
5. Si la ruta es para un rol distinto de ADMIN, agrégala a `ACCESO_ESPERADO` en `tests/permisos.test.js`.
6. Corre `npm test`.

### Cambiar la base de datos

**No edites `001_esquema_inicial.sql`.** Crea un archivo nuevo con el número siguiente:

```
migrations/002_agregar_visitantes.sql
```

Después corre `npm run migrate`. Cada migración se aplica una sola vez y en orden.

### Agregar un estado o un rol

Agrégalo con una migración (`INSERT`) **y** en `src/constants/index.js`, con el mismo id.

---

## 7. Pendientes recomendados

| Prioridad | Tarea | Por qué |
|---|---|---|
| Antes de producción | Mover las credenciales de MySQL a `.env`, crear un usuario de MySQL con permisos limitados y cambiar la contraseña `12345678` (ya está en el historial de git) | Es el único hallazgo crítico que queda |
| Antes de producción | `NODE_ENV=production` en el servidor | Activa las cookies `secure` (solo HTTPS) |
| Corto plazo | Linter (ESLint) y formateador (Prettier) | Mantiene el estilo uniforme |
| Corto plazo | Logs estructurados con `pino` | Permite buscar y filtrar errores en producción |
| Corto plazo | Unificar nombres de rutas (`/maintenance` → `/mantenimiento`, `/reportaverias` → `POST /averias`, `/propietarios` → `/usuarios`) | Requiere cambiar también el frontend |
| Mediano plazo | Tests de integración con una BD de prueba | Cubrir los flujos completos |
| Cuando crezca | Cola para el OCR (por ejemplo BullMQ + Redis) | Con muchas facturas, procesarlas fuera de la API |
| Decisión de negocio | ¿Habrá varias administradoras? | Hoy un ADMIN ve todos los residenciales; separar por "cliente" es caro de añadir después |

---

## 8. Cómo se verificó

1. **53 tests automáticos** (`npm test`): permisos de las 39 rutas privadas, cálculo de disponibilidad, lector de facturas, validadores y paginación.
2. **Comparación con el backend original:** ambos corrieron a la vez contra la misma BD y se compararon 68 respuestas `GET` para los 4 roles. Las 61 con datos fueron idénticas. Las 7 diferencias son las intencionales de la sección 4 (`/me` y la ruta inexistente).
3. **51 pruebas de escritura** sobre una BD temporal creada con `npm run migrate` y borrada al terminar: crear, editar y borrar en todos los módulos, reservas simultáneas, sesión revocada, límite de login y errores de validación.
