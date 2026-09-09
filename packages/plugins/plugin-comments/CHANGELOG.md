# Changelog

## 1.4.4

- Fix: `useUpdateCommentSettings` filtra los campos read-only del row (`id`, `site_id`, `created_at`, `updated_at`, `deleted_at`) antes del `POST /admin/comments/settings`. El form del admin persistía el `data.settings` entero (row completo) y el Zod strict del backend (`AdminUpdateCommentSettingsSchema`) devolvía `400 Invalid request: Unrecognized fields`. Ahora un helper `pickMutableSettings` hace un pick explícito de los 9 campos mutables antes del POST. Sin este fix el toggle "Comentarios habilitados" (u otros settings) no se puede guardar per-site.

## 1.4.3

- Version bump — versión intermedia que integró el fix del site scope junto al scaffold del plugin. Sin cambios funcionales sobre 1.4.2 más allá del propio bump.

## 1.4.2

- Feature: consumir el slot `SiteScopeBar` de `@minimalart/mercatto-plugin-runtime@^0.2.0` — la barra de contexto de tienda reaparece en `/app/comments` con la MISMA implementación que las pantallas del host. El scope de la pantalla se resuelve contra el map del host vía el registrador que ese archivo dispara al importarse.

## 1.4.1

- Fix: registrar middlewares del plugin vía `src/api/middlewares.ts` con `defineMiddlewares`. Sin este archivo Medusa no descubría los `admin/comments/middlewares.ts` y `store/comments/middlewares.ts` nested, así que `validateAndTransformQuery`/`validateAndTransformBody` nunca corrían y las rutas explotaban con `Cannot read properties of undefined (reading 'status')` al primer acceso a `req.validatedQuery`.

## 1.4.0

- Initial migration from base extension. All functionality preserved from `packages/extensions/comments/` at parity.
