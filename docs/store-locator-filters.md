# Filtros de sucursales y navegación de drawers

En **Tiendas → editar → Contenido → Página de sucursales** se configuran los tipos de sucursal y las zonas de cada tienda. Se guardan en `content_config.sucursales` y llegan a `assets.sucursales` del storefront.

## Tipos de sucursal (`types`)

Lista ordenada de `{ id, label, pickup, color? }`. La define **cada tienda**: hasta la versión 1.12.0 de la extensión los tres tipos (`point_of_sale`, `wholesale`, `distribution_center`) estaban clavados en el código.

- El **id** se genera del nombre al crear el tipo y es **inmutable**: `store_location.store_type` lo referencia y no hay foreign key que arrastre un rename. El nombre se puede editar cuando se quiera.
- El **orden** de la lista es el orden de los chips del filtro y del listado de sucursales.
- **`pickup`** decide si las sucursales de ese tipo aparecen en "Retiro en tienda" del checkout. Antes esto era un `store_type !== 'distribution_center'` hardcodeado en `use-store-pickup-locations`; ahora lo resuelve `app/api/store/store-locations/route.ts`, que es quien puede ver el tenant, y lo devuelve como `pickup` por sucursal.
- **`color`** sale de una paleta cerrada de 8 tokens (`primary | green | blue | slate | purple | amber | red | teal`). No es un hex libre: el storefront pinta con clases de Tailwind y el purge se come cualquier clase armada en runtime. `primary` usa `--primary-color` de la tienda.
- Lista **vacía** = la tienda no clasifica sus sucursales: no hay filtro por categoría ni etiquetas. Clave **ausente** = todavía no se configuró y valen los tres de siempre (`resolveBranchTypes`, en `apps/backend/src/lib/branch-types.ts` y su espejo `apps/storefront/src/lib/util/branch-types.ts`).
- La clave vieja `categories` se sigue **leyendo** para los sitios que nunca se guardaron con la pantalla nueva; ya no se escribe.

El Select de la ficha de sucursal se llena con `GET /admin/branch-types?sales_channel_ids=…`, que devuelve la unión de los tipos de las tiendas en cuyos canales está publicada. Sin la extensión `multistore` instalada, ese endpoint devuelve los tres tipos históricos.

## Zonas de ubicación (`regions`)

Lista de zonas en dos formas:

- **Del catálogo argentino**: `{ id, label, preset }`, donde `preset` es un id ISO 3166-2:AR en minúscula (`ar-b`, `ar-c`, …). Se guardan **por referencia**: el `content_config` viaja entero en cada guardado y el POST del admin corta arriba de ~100 KB, así que 130 KB de polígonos no entran; y mejorar un polígono beneficia a todas las tiendas sin tocarles la fila. Las geometrías viven en `apps/storefront/src/lib/data/geo-zones-ar.ts` (generado, ver abajo) y el índice de ids/nombres en `apps/backend/src/lib/geo-zones-ar-index.ts`.
- **Propias**: `{ id, label, geometry }` con GeoJSON `Polygon` o `MultiPolygon`, coordenadas `[longitud, latitud]` y anillos cerrados. Se dibujan en el mapa (o se importan de un `.geojson`) desde el drawer anidado "Nueva zona". Se validan rangos, superficie e ids únicos al guardar. Se admiten agujeros y zonas separadas.

`active: false` apaga una zona propia sin perder su polígono. Un preset apagado directamente sale de la lista: no hay nada que conservar. El template resuelve los presets a geometría **en el servidor**, así que al browser sólo le llegan las zonas prendidas y el catálogo entero nunca se descarga.

## Comportamiento del filtrado

- Sin zonas (`regions` omitido o vacío) no aparece el bloque Ubicación. Las sucursales no se descartan por provincia o país supuesto.
- Sin selección se muestran todos los resultados. Varias zonas se combinan con OR; ubicación, categoría y Abierto se combinan con AND. Una sucursal sin coordenadas aparece sin filtro geográfico, pero no pertenece a ninguna zona seleccionada.
- `showLocationFilters`, `showCategoryFilters` y el layout compacto siguen disponibles. El modo compacto no muestra filtros.
- No se requiere un servicio externo: se compara cada coordenada de sucursal con los polígonos (`lib/util/store-locator-zones.ts`, ray-casting con agujeros).

## Regenerar el catálogo de zonas

```
cd apps/backend
node --experimental-transform-types --import ./test-register.mjs \
  src/scripts/build-geo-zones-ar.mjs
```

Baja los límites provinciales oficiales de `infra.datos.gob.ar/georef/provincias.geojson` (Servicio de Normalización de Datos Geográficos, JGM — límites del IGN), descarta los agujeros y las islas fuera del continente + Tierra del Fuego, y simplifica con Douglas-Peucker a 1 km: 23.207 puntos → 6.667, 133 KB. El script falla si el índice del backend quedó desalineado con el catálogo generado.

## Drawers

Para tabs de drawers del backoffice, usar `src/admin/components/drawer-tabs.tsx`, extraído del drawer B2B. Tiendas, empresas B2B y cuentas corporativas comparten la misma fila horizontal, con desplazamiento y flechas. Los pasos de FocusModal y tabs de páginas completas mantienen sus componentes propios.

El drawer de la ficha de la tienda es `z-[60]` y sus `Select.Content` van en `z-[70]`. El drawer **anidado** de "Nueva zona" va en `z-[70]`, y cualquier popover suyo en `z-[80]`.

La quick view no muestra las líneas técnicas `catalog_commercial.presentation` y `measurementUnit` encima de Agregar al carrito. El control de stock y los límites de cantidad siguen en ProductActions.
