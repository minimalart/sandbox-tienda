# Botón flotante de WhatsApp

Toggle de la extensión **WhatsApp** que muestra un botón de contacto flotante en el storefront. Apagado por default.

## Admin

`Admin → WhatsApp → Ajustes` (`src/admin/routes/whatsapp/settings/page.tsx`, card en `components/floating-button-card.tsx`):

| Campo     | Notas                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Toggle    | Guarda al instante. Es el único switch: la ubicación no es configurable.  |
| Teléfono  | Se escribe libre (`+54 9 11 …`); el backend guarda solo dígitos.          |
| Mensaje   | Texto pre-cargado en el chat. Vacío ⇒ conversación en blanco.             |
| Texto     | Tooltip y nombre accesible del botón.                                    |

El badge del card muestra si el botón realmente se ve en la tienda: **activado + teléfono válido** (≥ 8 dígitos). Con el toggle prendido y sin teléfono no se muestra nada — un botón que abre `wa.me` sin número es peor que ningún botón.

## Persistencia

Una sola fila JSON en `store_setting` (módulo `store-config`), clave `whatsapp_floating_button` — mismo mecanismo que los bindings de plantillas, así que no hay migración propia. Normalización y merge en `src/modules/kapso-whatsapp/floating-button.ts` (con tests en `floating-button.test.ts`).

## Endpoints

- `GET /admin/kapso/floating-button` → `{ floating_button, live }`.
- `POST /admin/kapso/floating-button` → patch parcial (zod en `floating-button/validators.ts`), devuelve la config normalizada.
- `GET /store/whatsapp/floating-button` (público) → `{ floating_button: { phone, message, label } | null }`. Devuelve `null` si está apagado, si falta el teléfono o ante cualquier error: nunca 500.

## Storefront

- `lib/data/whatsapp.ts` → `getWhatsappFloatingButton()`, cacheado (`cache()` + `revalidate: 60`), `null` ante cualquier error.
- `modules/whatsapp/components/floating-button` → el botón (client).
- `lib/whatsapp-slot.tsx` → **generado por el composer** (`renderWhatsappFloatingSlot`). El layout de `(main)` importa siempre desde acá: en un proyecto sin la extensión el slot devuelve `null` y el build no se rompe. No editar a mano.

Vive en el layout de `[countryCode]/(main)`, así que no aparece en checkout, catálogo PDF ni en la app del repartidor (cada uno tiene su propio route group).

## Anti-colisión (`data-floating-obstacle`)

La esquina inferior del storefront está poblada: nav mobile, barra sticky de agregar al carrito de la ficha (que también existe en desktop y mide ~112px), volver arriba, bandeja de comparación, sticky de marcas, nudge de envío gratis y banner de cookies. Hardcodear offsets por breakpoint se rompe en cuanto uno cambia de alto.

En su lugar hay un contrato declarativo en `lib/util/floating-obstacle.ts`: cada elemento anclado abajo se marca con `{...floatingObstacle('nombre', FLOATING_LAYER.x)}` (atributos inertes), y `useSafeBottomOffset` (en `lib/hooks/use-safe-bottom-offset.ts`, compartido con el banner de cookies) mide los rects en runtime. El botón arranca a 20px del borde y sube justo por encima de cualquier obstáculo que lo cruce **y** que además lo solape en horizontal — por eso no se mueve por "volver arriba" en mobile (está a la izquierda) pero sí lo esquiva en desktop (comparten columna). Se re-mide en scroll, resize, cambios del DOM y fin de transición/animación.

El esquive es **unidireccional**: cada obstáculo declara su capa en la escalera de `FLOATING_LAYER` (barras del borde → barras apiladas → bandejas → avisos → botones flotantes) y cada elemento esquiva **solo** las capas menores a la propia. Si dos se esquivaran mutuamente, cada movimiento del uno empujaría al otro y los dos treparían hasta el techo del viewport — el botón de WhatsApp esquiva al banner de cookies, y el banner ignora al botón. La propiedad está fijada en `lib/util/floating-obstacle.test.ts`.

Resultado en los casos que importan:

| Situación                | Offset del botón                                  |
| ------------------------ | ------------------------------------------------- |
| Página normal, mobile    | arriba del nav inferior (64px + safe-area)        |
| Ficha, mobile            | arriba de la barra de agregar al carrito          |
| Página normal, desktop   | 20px, por debajo de volver arriba                 |
| Ficha, desktop           | arriba de la barra Y de volver arriba             |

Al agregar otro elemento fijo abajo, marcarlo con `floatingObstacle()`. El `z-index` del botón es `998`: por debajo de drawers/modales (≥ 9000), del nav (9999), del banner de cookies (9998) y de volver arriba (1000); por encima del contenido de página (barra del PDP: 30).
