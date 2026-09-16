# Identidad, presentación y cobertura del importador

Los IDs externos identifican productos y variantes dentro de una conexión y un destino. Se conservan en metadata y no se usan como presentación ni como sufijo del título de variante.

VTEX usa la etiqueta configurada, atributos de variación o el nombre real del SKU cuando difiere del producto. Sin información usa `Único`; no deriva un peso del identificador ni del multiplicador de venta. Cuando varios SKUs tienen la misma etiqueta, opciones neutras numeradas (`Único`, `Único (2)`) mantienen variantes distintas porque Medusa exige combinaciones de opciones únicas.

Al actualizar se conservan los IDs internos. Los valores generados por versiones anteriores (`Presentación: ID` y `título · ID`) se reparan. Los valores distintos de ese patrón se consideran posibles correcciones manuales. En nuevas importaciones se registra el último valor escrito y se detectan cambios posteriores; esas correcciones y los campos protegidos tienen prioridad. Una respuesta parcial nunca elimina variantes ausentes. Los valores de opción técnicos se retiran únicamente cuando ninguna variante los usa.

## Catálogos grandes

Cada consulta VTEX solicita 50 productos por página y como máximo 50 páginas. Intelligent Search descubre los filtros de la consulta con el endpoint `facets`: primero categorías y después otros atributos disponibles. Las consultas que exceden el límite se subdividen, manteniendo el canal explícito. El adaptador legacy usa el árbol de categorías. La recuperación se limita a 3.000 solicitudes, 200 particiones y 8 niveles; conserva lo recuperado e informa cobertura pendiente si alcanza esos límites.

Los productos se deduplican por ID externo antes de validar sus SKUs y ofertas: categorías superpuestas no duplican importaciones ni exclusiones. El total estimado pertenece a la consulta raíz y no se reemplaza por el total de una subcategoría. Sin un total verificable, particiones exitosas no prueban cobertura completa.

El historial en Tiendas → Catálogo muestra IDs revisados, total informado, última página de cada consulta, errores HTTP y cobertura pendiente. Los IDs revisados incluyen exclusiones; 5.986 productos publicados no implican 5.986 importables. Una falla de acceso detiene la recuperación; errores de páginas posteriores conservan un resultado parcial.

Reintentar una recuperación incompleta vuelve a consultar el origen con particiones. Si la recuperación fue completa y falló únicamente la persistencia, se conserva el snapshot. Se respeta siempre el máximo de productos configurado y la cancelación.

La actualización del boilerplate no migra automáticamente proyectos derivados ni ejecuta reimportaciones en ellos. Validar y desplegar la corrección en el derivado antes de volver a importar; no ejecutar una limpieza masiva como parte de esta actualización.

Contrato del proveedor: [filtros disponibles de Intelligent Search](https://developers.vtex.com/docs/guides/get-a-list-of-the-possible-facets-for-a-specific-search).
