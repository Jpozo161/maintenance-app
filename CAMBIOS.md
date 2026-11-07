# Cambios OCR

## Documentos de mantenimientos (reemplaza el OCR de facturas)

- La sección «Facturas» (OCR) pasa a ser «Documentos»: se suben archivos PDF asociados a un mantenimiento existente y se guardan en el bucket S3 privado; MySQL guarda los metadatos en la nueva tabla `documentos_mantenimiento` (migración `009_documentos_mantenimiento.sql`, que además elimina la tabla `facturas`, vacía).
- Endpoints (solo ADMIN): `GET /documentos` (historial, con `?mantenimiento_id=`), `POST /documentos?mantenimiento_id=`, `PATCH /documentos/:id/mantenimiento`, `GET /documentos/:id/ver`, `GET /documentos/:id/descargar` y `DELETE /documentos/:id` (archivado lógico; el archivo se conserva en S3). Ver y descargar redirigen a un enlace firmado de 5 minutos.
- Solo se aceptan PDF (extensión, tipo y contenido `%PDF-`), hasta 20 MB. El mismo PDF no se puede asociar dos veces al mismo mantenimiento; en S3 se guarda una sola copia por sha256.
- En Mantenimientos, «Ver facturas asociadas» pasa a «Ver documentos» (con Ver y Descargar) y la columna «Facturas» pasa a «Documentos».
- S3 queda listo para conectar: llenar `S3_BUCKET`, `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` en el `.env` y comprobar con `npm run s3:check` (sube, lee y borra un archivo de prueba).
- Se eliminaron el componente y los estilos del OCR, la llamada a `/ocr` y `docs/CONTRATO-OCR.md`.
- Verificación: `npm test` del backend (incluye `tests/documentos.test.js`), índice único con columna generada probado en una tabla temporal de MySQL, `npm run build` y `npm run lint` del frontend. La subida real a S3 queda pendiente de las credenciales.

## Dashboard de técnicos y formulario de usuarios

- El dashboard conserva sus listas iniciales vacías al cargar solo los endpoints permitidos al técnico; el total de pagos también tolera una lista ausente, evitando el error al ejecutar `pagos.reduce`.
- El campo Unidad se muestra al registrar usuarios únicamente cuando el rol seleccionado es Residente. Para los otros roles, el formulario envía `residencial_id: null`.
- Verificación: compilación de producción y `npm run lint` completados correctamente.

## Ajustes visuales de tablas y encabezado

- Los correos se resaltan en azul en las tablas compartidas; los encabezados de columnas usan negrita explícita.
- La primera columna de cada tabla compartida se muestra en negrita para destacar el dato principal de cada fila.
- El encabezado superior ahora usa el mismo azul oscuro del sidebar, con texto e iconos claros para mantener el contraste.
- Verificación: compilación de producción y `npm run lint` completados correctamente.

## Estados y eliminación de mantenimientos

- El selector de estado usa colores semánticos: cancelado rojo, completado verde, en proceso azul, programado ámbar y próximo mantenimiento morado.
- Se agregó “Eliminar” al menú de cada mantenimiento. La API lo archiva de forma lógica para conservar el historial de estados y las facturas vinculadas.
- La migración `maintenance-app-project/sql/mantenimiento-archivado.sql` agrega `eliminado_en` y ya fue aplicada a la base local.
- Verificación: compilación de producción, `npm run lint`, `node --check` de los archivos del backend y aplicación de la migración completados correctamente.

## Auditoría funcional de la aplicación

- Se retiraron las rutas sin consumidores `/test`, `/maintenance/overdue` y `POST /`, junto con los modelos legados `getUser`, `postClient` y `overDueMaintenance`.
- El formulario de averías ahora conserva el asunto junto con la descripción; se quitó la opción “Zona común” que enviaba texto en lugar de un ID residencial y la prioridad que la API no guardaba.
- La bienvenida del dashboard diferencia al técnico del administrador.
- Con usuarios temporales que se eliminaron al terminar, se verificaron login/logout, GET de los módulos principales, permisos de técnico/residente/supervisor, registro de técnico sin unidad, y creación/cambio de estado/archivo de mantenimiento con exclusión posterior de las listas.
- El OCR validó el caso de archivo vacío. La subida real de facturas no se pudo completar porque S3 aún no tiene configuración.
- Verificación final: compilación y lint del frontend, `node --check` de los servicios del backend y flujos HTTP anteriores completados correctamente.

- La vista previa de facturas ahora muestra datos comerciales detectados (proveedor, número, fechas, moneda, subtotal, impuestos y total) y una tabla de productos/conceptos; oculta tamaño, MIME, clave S3 y hash.
- El extractor OCR amplía los campos estructurados y guarda las líneas detectadas en `datos_ocr`, que ya existe en la base de datos. La clave S3, el hash y el texto OCR se conservan para soporte.
- La detección de líneas de producto usa heurísticas sobre texto OCR y puede variar según el formato de la factura.
- Verificación: compilación de frontend correcta y `node --check` correcto para el servicio OCR.

## Mantenimientos y usuarios

- El formulario de mantenimiento permite registrar actividad, descripción y fecha límite; la lista muestra fecha de creación y fecha límite.
- Se añadió la acción para posponer la fecha límite tres meses desde la fecha planificada vigente. La API de próximos mantenimientos devuelve las fechas en orden y el dashboard las muestra.
- La tarjeta de unidades cuenta los residenciales devueltos por el endpoint existente.
- El borrado de usuarios se convierte en desactivación lógica, preservando pagos enlazados y excluyendo la cuenta del inicio de sesión y de la lista de usuarios.
- Se reutilizan las columnas ya existentes `mantenimientos.created_at` y `usuarios.estado`; no se requiere una migración nueva.
- La configuración MySQL corrige `root` a `host` y permite definir `DB_HOST`; se agregó `npm start` para iniciar explícitamente el backend actualizado.
- La auditoría encontró que el formulario de pagos enviaba nombres de campos incompatibles con la API. Ahora envía propietario, monto y fecha con los nombres esperados; el backend valida y guarda los tres valores. Como la columna `pagos.monto` es `INT`, el formulario solo acepta montos enteros para evitar que MySQL los trunque.
- Verificación: los GET de los módulos principales responden 200; se probó posponer un mantenimiento temporal dos veces y quedó tres meses después en cada ocasión; se probó desactivar un usuario con pago asociado y el pago permaneció. Los registros de prueba se eliminaron.
- La búsqueda, filtro por última columna, menú por fila y paginación se revisaron en el componente compartido de tablas. Compilación de frontend y lint correctos.

## Propiedad de los mantenimientos

- El formulario de mantenimiento ahora requiere seleccionar una propiedad del listado existente.
- Se agregó `mantenimientos.residencial_id` como clave foránea a `residenciales.id`; la tabla y el endpoint exponen el nombre de la propiedad.
- La tabla de mantenimientos y la lista del dashboard muestran la propiedad vinculada.
- Los mantenimientos históricos quedan como “Sin propiedad asignada”: la base de datos no contenía una relación que permita inferir su propiedad sin adivinar.
- La migración está documentada en `maintenance-app-project/sql/mantenimiento-residencial.sql` y ya fue aplicada a la base de datos local.
- En las filas históricas añadí una acción para asignar o cambiar la propiedad usando el mismo selector.

## Imagen, navegación y acceso

- Se reemplazó la imagen de piscina por el archivo compartido. El archivo es AVIF aunque llegó con extensión `.jpg`, así que se sirve con extensión `.avif`.
- El sidebar queda fijo mientras el panel principal tiene su propio scroll; el botón de cerrar sesión ocupa una fila debajo de la cuenta para que no se encime.
- La cuenta `admin.acceso@maintenance.local` no existía en la base de datos. La registré como ADMIN y confirmé un inicio de sesión correcto con la contraseña proporcionada.

## Estado e historial de mantenimiento

- La tabla permite cambiar el estado desde un selector que muestra los nombres de `estados_mantenimiento`, no los IDs.
- Se reutilizó la tabla `historial_mantenimiento` que ya existía en la base (con sus FK a mantenimiento y estado). Los triggers registran el estado inicial y cada transición real con fecha/hora en sus columnas existentes `estado_id` y `fecha`.
- La acción “Posponer 3 meses” también cambia el estado a ID 5 (“Próximo mantenimiento”).
- La migración está documentada en `maintenance-app-project/sql/historial-mantenimiento.sql` y fue aplicada a la base local.

## Número de mantenimiento y buscador en documentos

- Las tablas de mantenimientos (activos e historial) muestran una primera columna “N.º” con el número del mantenimiento (`#id`), que es el identificador que ya usaban la base de datos y los documentos. No hizo falta una columna nueva ni una migración.
- En el módulo de documentos, el desplegable de mantenimientos se reemplazó por un botón que abre un cuadro pequeño sobre el formulario (`MaintenancePicker.jsx`): un buscador filtra por número (`12` o `#12`, por coincidencia desde el inicio) y, si el texto no es un número, por actividad, descripción, propiedad, estado o técnico. La lista muestra 40 resultados e indica cuántos hay en total, para que con cientos de mantenimientos no haya que recorrer el desplegable.
- El mismo cuadro se usa al cambiar el mantenimiento de un documento ya guardado.
- El buscador recibe el foco al abrir, Enter elige el primer resultado sin enviar el formulario, y Escape o un clic fuera cierran el cuadro.
- La columna de estado editable de la tabla de mantenimientos se recorrió al índice 6 porque la columna del número va delante.
- Verificación: `npm run build` y `npm run lint` del frontend correctos (el aviso de `navigation` en `App.jsx` ya existía).

## Empaquetado en Docker

- `maintenance-app-frontend/.dockerignore` tenía solo `node_modules`. Se le añadieron `dist`, `.DS_Store`, `.env`, `.env*.local`, `*.log`, `*.md`, `CAMBIOS.txt` y el propio Dockerfile. `.git` no hace falta: el repositorio está en la carpeta padre, fuera del contexto de build.
- El Dockerfile del frontend ejecutaba `RUN npm run dev`, que levanta el servidor de Vite y nunca termina: el build quedaba colgado y jamás generaba `/app/dist`. Ahora ejecuta `npm run build`. El archivo se renombró de `dockerfile` a `Dockerfile`, porque en minúscula solo lo encuentra un sistema de archivos que ignore mayúsculas (macOS sí, Linux y CI no).
- Se creó `maintenance-app-frontend/nginx.conf`, que el Dockerfile ya esperaba copiar y no existía (la etapa 2 fallaba ahí). Sirve `dist`, proxea `/api` al servicio `backend` quitando ese prefijo —igual que el rewrite del proxy de Vite, porque el backend monta sus rutas en la raíz—, sube `client_max_body_size` a 20 MB para los PDF de mantenimientos (el valor por defecto de nginx, 1 MB, los habría cortado con un 413) y cachea los assets con hash pero no `index.html`.
- Se creó `maintenance-app-project/Dockerfile` (la API no tenía) sobre `node:20-slim` en lugar de alpine, porque bcrypt es un módulo nativo con binarios precompilados para glibc. Corre como usuario `node` y usa `CMD ["node", "app.js"]` para que el contenedor reciba SIGTERM.
- Se creó `maintenance-app-project/.dockerignore`. Excluye `.env` a propósito: las variables se pasan en ejecución desde compose para no hornear secretos en una capa de la imagen.
- El `docker-compose.yml` y la construcción de las imágenes quedan a cargo del autor del proyecto.
- Verificación: `npm run build` y `npm run lint` del frontend correctos. La configuración de nginx y los Dockerfiles no se pudieron comprobar en esta máquina porque no tiene instalados ni `docker` ni `nginx`; se revisaron contra los límites y rutas reales del código (20 MB en `documentos.service.js`, rewrite de `/api` en `vite.config.js`, `PORT` y `DB_HOST` en `src/config/env.js` y `src/config/db.js`).
