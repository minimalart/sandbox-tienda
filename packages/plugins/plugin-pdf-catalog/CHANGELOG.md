# Changelog

## 1.3.2

- Feature: consumir el slot `SiteScopeBar` de `@minimalart/mercatto-plugin-runtime@^0.2.0` — la barra reaparece en `/app/pdf-catalogs` con la implementación del host.

## 1.3.1

- Fix: registrar middlewares del plugin vía `src/api/middlewares.ts` con `defineMiddlewares`. Sin este archivo Medusa no descubría el `admin/pdf-catalogs/middlewares.ts` nested, así que `validateAndTransformBody` no corría y las rutas de create/update fallaban con `Cannot read properties of undefined` al leer `req.validatedBody`.

## 1.3.0

- Initial migration from base extension. All functionality preserved from `packages/extensions/pdf-catalog/` at parity.
