# @minimalart/mercatto-plugin-checkout-links

Links de Venta para tiendas Mercatto (Medusa 2.18+). Carritos precargados que se comparten por URL pública: el operador arma los items desde el admin (opcionalmente con cliente, dirección y promos) y comparte el link resultante `/{country}/c/{token}`. El cliente abre el link y cae directo al checkout con todo cargado.

## Ships

- `checkout_link` module con modelo `checkout_link` (token opaco base64url).
- Admin route `/app/checkout-links` con listado + FocusModal de creación/edición (4 tabs: general, productos, cliente, opciones).
- Admin API: `GET/POST /admin/checkout-links`, `GET/POST/DELETE /admin/checkout-links/:id`.
- Store API: `GET /store/checkout-links/:token` (resolver público), `POST /store/checkout-links/:token/consume` (marcar usado tras la orden).
- Workflow: `createCheckoutLinkWorkflow`.
- Site scoping: `channel_column` sobre `sales_channel_id` con `empty: 'all'` (link sin canal se ve en todas las tiendas — mostrar de más es recuperable, esconder no).

## Install

```
pnpm add @minimalart/mercatto-plugin-checkout-links
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-checkout-links', options: {} },
]
```

## Environment

- `STOREFRONT_URL` o `NEXT_PUBLIC_BASE_URL` — origen público con el que se arma el link. Sin ninguno, el link queda relativo (`/AR/c/xxx`) y no es shareable.
