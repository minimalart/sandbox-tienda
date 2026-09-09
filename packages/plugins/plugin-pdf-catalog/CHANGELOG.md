# Changelog

## 1.3.4 - Fix: el click en la fila abría el drawer de edición con el wrapper de TanStack.

- `useDataTable` de `@medusajs/ui` tipa el segundo argumento de `onRowClick` como el registro, pero en runtime entrega la `Row` de TanStack (`instance.onRowClick(e, row)` en `data-table-table.js`). Ahora se desenvuelve `.original`.
- Mismo síntoma que en brands: el form arrancaba vacío hasta que resolvía `usePdfCatalog`.

## 1.3.2

- Feature: consumir el slot `SiteScopeBar` de `@minimalart/mercatto-plugin-runtime@^0.2.0` — la barra reaparece en `/app/pdf-catalogs` con la implementación del host.

## 1.3.1

- Fix: registrar middlewares del plugin vía `src/api/middlewares.ts` con `defineMiddlewares`. Sin este archivo Medusa no descubría el `admin/pdf-catalogs/middlewares.ts` nested, así que `validateAndTransformBody` no corría y las rutas de create/update fallaban con `Cannot read properties of undefined` al leer `req.validatedBody`.

## 1.3.0

- Initial migration from base extension. All functionality preserved from `packages/extensions/pdf-catalog/` at parity.
