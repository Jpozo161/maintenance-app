# Cambios OCR

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
