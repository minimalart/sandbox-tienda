# @minimalart/mercatto-plugin-wishlist

Mercatto plugin: favoritos por cliente.

## What it does

Cada cliente autenticado tiene un unico wishlist con N items. Cada item apunta a un `product_variant` (con `product_id` de conveniencia). Sin multi-tenant, sin app-settings, sin workflows.

## What ships in the plugin

- Backend module `wishlist` (dos modelos: `wishlist` + `wishlist_item`) con migrations.
- Endpoints Store montados bajo el auth de customer:
  - `GET  /store/customers/me/wishlist`
  - `POST /store/customers/me/wishlist/items`
  - `DELETE /store/customers/me/wishlist/items?productId=&productVariantId=`

## What stays in the host

Todo el storefront (Next.js): el boton, el drawer, la vista de account overview, las rutas proxy en `app/api/store/wishlist/*`, los hooks, y los stores. El host no importa nada del plugin: llama los endpoints backend por HTTP como antes.

## Install

```jsonc
// medusa-config.ts
{
  "plugins": ["@minimalart/mercatto-plugin-wishlist"]
}
```

Luego correr migrations del modulo `wishlist` como cualquier otro modulo Medusa.
