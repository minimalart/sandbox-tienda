# @minimalart/mercatto-plugin-blog

Blog editorial comprable para tiendas Mercatto (Medusa 2.18+). Cada post se edita con Tiptap (JSON), se renderiza a HTML sanitizado en el storefront (SSR) y puede linkearse a productos ordenados por drag & drop. Segmentación por sales channel a nivel de post.

## Ships

- `blog` module con modelos `blog_post`, `blog_category`, `blog_post_product`, `blog_settings`.
- Admin routes en `/app/blog` con articulos (listado + editor con Tiptap), categorías (drawer) y configuración por tienda.
- Admin API: `GET/POST /admin/blog-posts`, `GET/POST/DELETE /admin/blog-posts/:id`, `/admin/blog-posts/:id/publish|unpublish|duplicate|products`, `GET/POST /admin/blog-categories`, `GET/POST/DELETE /admin/blog-categories/:id`, `GET/POST /admin/blog-settings`.
- Store API: `GET /store/blog-posts` (paginado), `GET /store/blog-posts/:slug` (detalle + related + product_ids), `GET /store/blog-categories`, `GET /store/blog-settings`.
- Renderer: Tiptap JSON → HTML sanitizado con allowlist alineado al set del editor (headings, listas, tablas, YouTube/Vimeo embeds).

## Install

```
pnpm add @minimalart/mercatto-plugin-blog
```

Then register in `medusa-config.ts`:

```ts
plugins: [
  { resolve: '@minimalart/mercatto-plugin-blog', options: {} },
]
```
