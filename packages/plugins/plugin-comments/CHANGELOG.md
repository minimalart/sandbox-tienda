# Changelog

## 1.4.2

- Feature: consumir el slot `SiteScopeBar` de `@minimalart/mercatto-plugin-runtime@^0.2.0` — la barra de contexto de tienda reaparece en `/app/comments` con la MISMA implementación que las pantallas del host. El scope de la pantalla se resuelve contra el map del host vía el registrador que ese archivo dispara al importarse.

## 1.4.1

- Fix: registrar middlewares del plugin vía `src/api/middlewares.ts` con `defineMiddlewares`. Sin este archivo Medusa no descubría los `admin/comments/middlewares.ts` y `store/comments/middlewares.ts` nested, así que `validateAndTransformQuery`/`validateAndTransformBody` nunca corrían y las rutas explotaban con `Cannot read properties of undefined (reading 'status')` al primer acceso a `req.validatedQuery`.

## 1.4.0

- Initial migration from base extension. All functionality preserved from `packages/extensions/comments/` at parity.
