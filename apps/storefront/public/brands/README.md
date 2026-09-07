# Logos de marcas (banner sticky del footer)

Dejá acá los logos de las marcas que aparecen en el banner fijo del pie
(`BrandsStickyBanner`). Formatos recomendados: `.svg` o `.webp`, fondo
transparente.

Luego referencialos en la lista `BRANDS` de:
`src/modules/layout/components/brands-sticky-banner/client.tsx`

Ejemplo:

```ts
const BRANDS: Brand[] = [
  { name: 'Acme', src: '/brands/acme.svg' },
  { name: 'Globex', src: '/brands/globex.webp' },
];
```

Si una marca no tiene `src` (o el archivo falla), el banner muestra el
`name` como chip de texto, así nunca queda roto ni invisible.
