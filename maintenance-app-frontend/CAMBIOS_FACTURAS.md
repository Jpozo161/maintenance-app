# Cambios: repositorio de facturas

- Se reemplazó la comparación de documentos por un flujo de análisis OCR, vista previa de lo que se guardará y confirmación explícita.
- Se agregó un repositorio con búsqueda, enlace al original y asociación/desasociación manual de un mantenimiento.
- La pantalla muestra nombre, MIME, tamaño, clave S3, SHA-256 y los campos que el OCR pudo reconocer.
- Desde cada fila de mantenimiento se puede consultar y abrir las facturas asociadas.
- La subida final requiere la configuración de S3; el análisis y la vista previa están disponibles antes de configurarla.
