# Directorio público de tiendas

El dominio raíz configurado para las tiendas muestra `/tiendas`. Esta ruta usa
un grupo `(directory)` independiente del layout comercial: no monta navegación,
footer, carrito ni consultas comerciales del layout de la tienda principal.
Los controles de acceso existentes se conservan.

## Edición con Puck

En **Tiendas → Editar directorio** (`/sites/directory`) se edita un documento Puck
propio de la instancia. Incluye header, hero con buscador, listado, invitación,
beneficios y footer. Las secciones se pueden ordenar y quitar, excepto el listado,
que es obligatorio. Cada tipo aparece una sola vez. Los campos de imagen usan la
biblioteca/subida de medios del editor existente.

Los colores se editan en la raíz del documento. Logos, títulos, descripciones,
imágenes, enlaces y contacto pertenecen al documento; no se heredan de la tienda
principal. Los textos vacíos se conservan. Sin documento guardado se usa una
configuración genérica, sin nombres, dominios ni recursos de clientes.

La persistencia reutiliza `site_setting`, namespace `extension:multistore`, clave
`SITES_HUB_PUCK`, scope de instancia. La API existente de ajustes conserva sus
permisos y validación; el endpoint público expone solamente la proyección editorial.
El guardado reemplaza el documento completo. No requiere migración de datos.

## Listado

`GET /store/sites?directory=1&offset=0&q=...` devuelve como máximo 20 tiendas
publicadas (`ready`, no principal, con canal), ordenadas por nombre e ID. La búsqueda
abarca todas las tiendas e ignora mayúsculas y tildes. `next_offset: null` indica fin.
Sin `directory=1`, la respuesta anterior `{ sites }` se conserva para consumidores
existentes como sitemap. El alias `demo-stores` mantiene el mismo contrato.

El storefront usa `/api/sites-directory` para continuar al acercarse al final de
la lista. Ofrece un botón alternativo accesible para cargar más y reintentar errores.
Con 20 resultados o menos no hay controles para continuar. Los resultados nuevos
de búsqueda reemplazan la lista y cancelan requests anteriores.

Las imágenes de una marca se suben a medios y se seleccionan en Puck. Los recursos
y documentos preparados en `output/` son vistas locales; no se publican con el
boilerplate ni configuran automáticamente un cliente.
