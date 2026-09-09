# Changelog

## 1.0.2 - Docs: corrige el comentario sobre `onRowClick` en la tabla de eventos.

- El comentario afirmaba que `onRowClick` estaba roto en esta versión de `@medusajs/ui` porque "el render lee `instance.Ln`". No aplica: tanto el build CJS como el ESM de 4.1.19 leen `instance.onRowClick`. Lo que sí engaña es el tipo — entrega la `Row` de TanStack, no el registro.
- La pantalla no cambia: sigue abriendo el drawer desde el botón del título, que es lo correcto porque cada fila abre un drawer distinto según su `kind`.

## 1.0.0

- Initial migration from base extension. All functionality preserved from `packages/extensions/ga4/` at parity. Consumes `@minimalart/mercatto-plugin-runtime` for app-settings snapshot reads.
