# @minimalart/mercatto-plugin-ga4

Envío server-side de eventos de ecommerce a Google Analytics 4 vía Measurement Protocol, con mapeo por evento (`ga4_event_mapping`), builtins configurables por tienda (`ga4_builtin_setting`) y una card de configuración por sitio (`ga4_settings`).

Migración directa de `packages/extensions/ga4/` a un plugin publicado. Consume `@minimalart/mercatto-plugin-runtime` para leer el snapshot de `app-settings` del host (namespace `extension:ga4`).

## Qué hace

- Dos subscribers escuchan el event bus de Medusa (`order.placed`, `cart.updated`, etc.) y despachan los eventos correspondientes a GA4 por Measurement Protocol.
- El storefront maneja `page_view`, `view_item` y `begin_checkout` con `gtag.js` client-side. Este plugin cubre el server-side: `purchase`, `add_to_cart`, `remove_from_cart`, `add_shipping_info`, `add_payment_info`, más los mapeos genéricos configurables desde el admin.
- Card de admin en `/admin/ga4` con dos rutas: **Eventos** (mapeo y builtins) y **Configuración** (Measurement ID, API secret, GTM ID y debug).

## Instalación

En `medusa-config.ts`:

```ts
import { defineConfig } from '@medusajs/framework/utils'

export default defineConfig({
  plugins: [
    { resolve: '@minimalart/mercatto-plugin-ga4', options: {} },
  ],
})
```

Correr migraciones después de instalar:

```sh
npx medusa db:migrate
```

## Variables de entorno

Todas son opcionales — la card del admin las pisa si están seteadas ahí.

| Var | Uso |
| --- | --- |
| `GA_MEASUREMENT_ID` | Measurement ID de la propiedad GA4 (empieza con `G-`). Sin esto y sin fila en la card, el dispatcher es no-op. |
| `GA_API_SECRET` | API secret del Measurement Protocol. Sin esto tampoco hay envío. |
| `GA_DEBUG` | `true` para mandar al endpoint `/debug/mp/collect` (valida y devuelve errores, NO registra el hit). |
| `GTM_ID` | Container ID de GTM, usado por la card del admin como referencia. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Fallback del `GA_MEASUREMENT_ID` cuando este no está seteado (compat con el storefront). |
| `NEXT_PUBLIC_GTM_ID` | Fallback del `GTM_ID` en el mismo sentido. |

Precedencia efectiva por campo: **snapshot de `app-settings` (namespace `extension:ga4`) > `ga4_settings` (fila legacy) > `process.env` > default**.

## Multi-tenant

`ga4_event_mapping` y `ga4_builtin_setting` tienen `site_id` con scope `site_column` (empty=`all`, que es "global / se aplica a toda tienda que no defina el suyo"). El middleware `siteFromRequest` completa el scope según la request.

## Tablas

- `ga4_event_mapping` — mapeos genéricos configurables (medusa_event → ga4_event_name + params).
- `ga4_builtin_setting` — configuración por tienda de los builtins ecommerce (activo, renombre, hidden).
- `ga4_settings` — fila legacy con `measurement_id`, `api_secret`, `gtm_id`, `debug`. Sigue viva por compat con instalaciones que ya tenían esa fila; `mergeWithLegacyRow` la fusiona con `app-settings`.
