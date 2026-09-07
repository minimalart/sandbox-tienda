# @minimalart/mercatto-plugin-brands

Marcas (brands) para tiendas Mercatto (Medusa 2.18+). Cada marca tiene handle, descripción, estado y una o más imágenes (logo/thumbnail + banner). Se linkea a productos mediante un pivote gestionado por el core (`product ↔ brand` via `product_product_brand_brand`).

## Ships

- `brand` module con modelos `brand` y `brand_image`.
- Admin route `/app/brands` con listado, drawer de creación/edición, bulk CSV, export y detalle por marca con sus imágenes.
- Admin API: `GET/POST /admin/brands`, `GET/POST/DELETE /admin/brands/:brand_id`, imágenes en `/admin/brands/:brand_id/images`, productos linkeados en `/admin/brands/:brand_id/products`, bulk en `/admin/brands/bulk` y export en `/admin/brands/export`.
- Store API: `GET /store/brands`, `GET /store/brands/:brand_id`, imágenes en `/store/brands/:brand_id/images`.
- Workflows: `createBrandWorkflow`, `createBrandImagesWorkflow`.
- Link: `product ↔ brand`.

## Install

```
pnpm add @minimalart/mercatto-plugin-brands
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-brands', options: {} },
]
```
