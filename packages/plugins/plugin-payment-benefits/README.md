# @minimalart/mercatto-plugin-payment-benefits

Beneficios de Pago para tiendas Mercatto (Medusa 2.18+). Muestra en storefront/backoffice los beneficios asociados a los medios de pago (cuotas, descuentos, reintegros, promos bancarias/wallet). A diferencia de las Promotions comerciales de Medusa (que mueven el precio), estos beneficios son **informativos**: nunca modifican el precio del producto.

## Ships

- `payment_benefits` module con modelos `payment_benefit`, `payment_method_catalog`, `payment_sync_log`.
- Admin routes `/app/payment-benefits`, `/app/payment-benefits/benefits`, `/app/payment-benefits/benefits/:id`, `/app/payment-benefits/settings`.
- Admin API: `GET/POST /admin/payment-benefits`, `GET/POST/DELETE /admin/payment-benefits/:id`, `GET /admin/payment-benefits/catalog`, `GET /admin/payment-benefits/dashboard`, `POST /admin/payment-benefits/sync/:provider`.
- Store API: `GET /store/payment-benefits` (beneficios visibles), `GET /store/payment-methods` (catálogo público con logos).
- Providers: `manual-adapter` y `mercadopago-adapter` (sync de medios + snapshot de cuotas por BIN de referencia).
- Site scoping: `channel_array` sobre `payment_benefit.sales_channel_ids` con `empty: 'all'`; `site_column` sobre `payment_method_catalog.site_id` con `empty: 'all'`.

## Install

```
pnpm add @minimalart/mercatto-plugin-payment-benefits
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-payment-benefits', options: {} },
]
```

## Environment

- `MERCADOPAGO_ACCESS_TOKEN` — token de acceso a Mercado Pago. Sin él, el sync del proveedor `mercadopago` queda deshabilitado (`isMpBenefitsSyncEnabled` devuelve `false`) y el operador tiene que cargar los beneficios a mano.
