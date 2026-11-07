# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visión general

Aplicación de gestión de mantenimiento residencial (usuarios, pagos, mantenimientos, averías, propiedades, áreas sociales/reservas, visitas y facturas). El repositorio git está en la carpeta padre y contiene dos proyectos hermanos:

- `maintenance-app-frontend/` (este directorio): React 19 + Vite, JavaScript sin TypeScript.
- `../maintenance-app-project/`: API Express 5 (CommonJS) + MySQL (`mysql2`), almacenamiento de facturas en S3.

Todo el código, los comentarios, los mensajes de error y la documentación están en español; mantén ese idioma.

## Comandos

Frontend (desde `maintenance-app-frontend/`):

```bash
npm run dev       # Vite en 127.0.0.1:5173, con proxy /api -> http://localhost:3000
npm run build
npm run lint      # oxlint (reglas en .oxlintrc.json)
```

No hay tests en el frontend; la verificación habitual es `npm run build` + `npm run lint`.

Backend (desde `../maintenance-app-project/`):

```bash
npm run dev                # node --watch app.js
npm start
npm test                   # node:test sobre tests/*.test.js
node --test tests/permisos.test.js   # un solo archivo de test
npm run migrate            # aplica migrations/NNN_*.sql pendientes (tabla schema_migrations)
npm run migrate:baseline   # marca todas como aplicadas sin ejecutarlas (una vez, en BD existente)
```

El backend no arranca sin `JWT_SECRET` en `.env` (ver `.env.example`). Las credenciales de MySQL están fijas en `src/config/db.js` a propósito mientras el proyecto está en desarrollo (documentado en `docs/REVISION-BACKEND.md`); no las "arregles" sin que se pida.

## Arquitectura del frontend

- **Sin router**: la vista activa se guarda en `window.location.hash` y `App.jsx` elige el componente con una cadena de ternarios. `MaintenanceModule` es el componente por defecto y se reutiliza para varias vistas tabulares (`propietarios`, `pagos`, `mantenimientos`) mediante la prop `type`.
- **Permisos por rol en la UI**: `src/data/modules.js` define `navigation`, `roleViews` (vistas por rol; la primera es la de inicio; ADMIN ve todas), `canView` y `homeView`. Para añadir una vista: registrarla en `navigation`, en `roleViews` si aplica a roles no-ADMIN, y en el ternario de `App.jsx`. Ese archivo también centraliza `headers` de tablas, `endpoints` y formateadores de fecha (zona `America/Bogota`).
- **Capa HTTP**: todas las llamadas pasan por `requestResource` en `src/services/api.js` (base `VITE_API_URL` o `/api`, timeout de 12 s, y lanza `Error` con `payload.error` del backend). La sesión es una cookie `httpOnly` del mismo origen gracias al proxy de Vite; no hay tokens en el cliente.
- `DataTable.jsx` es la tabla compartida (búsqueda, filtro, menú por fila, paginación). Estilos globales en `src/styles/app.css`.
- `DocumentsModule.jsx` (documentos PDF de mantenimientos) envía el archivo crudo con cabeceras `X-File-Name`/`X-File-Type` y el mantenimiento en la query (`POST /documentos?mantenimiento_id=`). Ver y descargar usan `getDocumentoUrl`, que redirige a un enlace firmado de S3.

## Arquitectura del backend

- `app.js` → `src/server.js` (`createApp`, sin `listen`, reutilizable en tests) → `src/routes.js`.
- `src/routes.js` monta primero las rutas públicas (`/health`, auth) y después `verifyToken`; todo lo demás requiere sesión. Cada módulo nuevo vive en `src/modules/<nombre>/` y se registra ahí.
- Patrón por módulo: `*.routes.js` (validación + permisos + HTTP), `*.repository.js` (SQL parametrizado con `pool`), `*.service.js` opcional para lógica de negocio. Transacciones con `withTransaction` de `src/config/db.js`.
- **Errores**: Express 5 propaga los errores de handlers async, así que las rutas hacen `throw new HttpError(status, mensaje)`; `middleware/errorHandler.js` devuelve `{ error }` y oculta los errores no controlados. El frontend depende de esa forma `{ error }`.
- **Permisos**: cada ruta privada declara `requireRole(...)` o `adminOnly` (ADMIN siempre tiene acceso). `verifyToken` recarga el usuario desde la BD en cada petición. `tests/permisos.test.js` recorre el router y falla si una ruta no declara roles o si su acceso no coincide con `ACCESO_ESPERADO`: al añadir una ruta para un rol distinto de ADMIN, actualiza ese mapa. Los permisos del backend y `roleViews` del frontend deben mantenerse coherentes.
- **Constantes de negocio** en `src/constants/index.js` (roles, ids de `estados_mantenimiento`, estados de avería/reserva); deben coincidir con los datos de `migrations/001_esquema_inicial.sql`.
- **Borrado lógico**: los registros se archivan (`eliminado_en`/`eliminada_en`, `usuarios.estado = 0`) en lugar de borrarse, para conservar historial y relaciones; las consultas filtran los archivados. Parte del historial lo escriben triggers de la BD.
- **Esquema**: los cambios van en una nueva migración `migrations/NNN_descripcion.sql`. `migrations/historico/` son scripts antiguos solo de referencia; el runner los ignora.
- Documentos de mantenimientos (`documentos_mantenimiento`): PDF guardados en un bucket S3 privado (`src/services/s3Storage.js`), una copia por sha256; `npm run s3:check` comprueba la conexión.

## Registro de cambios

Los cambios funcionales se han ido documentando en `../CAMBIOS.md` (y en `CAMBIOS.txt` / `CAMBIOS_FACTURAS.md`), indicando además cómo se verificaron.
