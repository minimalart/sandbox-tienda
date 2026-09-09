# Changelog

## 1.2.4

- Elimina la nota técnica de ajustes por sitio debajo de la lista de videos.

## 1.2.2

- Feature: consumir el slot `SiteScopeBar` de `@minimalart/mercatto-plugin-runtime@^0.2.0` (variant `card`) — la barra reaparece en `/app/videos` con la implementación del host.

## 1.2.1

- Fix: registrar middlewares del plugin vía `src/api/middlewares.ts` con `defineMiddlewares`. Sin este archivo Medusa no descubría los `admin/videos/middlewares.ts` y `admin/vimeo/middlewares.ts` nested, así que las validaciones no corrían y las rutas de CRUD + Vimeo OAuth + upload fallaban al leer `req.validatedQuery`/`req.validatedBody`.

## 1.2.0

- Initial migration from base extension. All functionality preserved from
  `packages/extensions/videos/` at parity. Consumes
  `@minimalart/mercatto-plugin-runtime` for app-settings snapshot reads.
