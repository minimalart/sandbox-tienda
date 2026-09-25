/**
 * ⚠️ Módulo banner migrado a `@minimalart/mercatto-plugin-banners`.
 *
 * Este directorio NO se registra como módulo (`medusa-config.ts` ya no llama
 * `optionalModule('banner', 'banner')`). Se conserva como shim de helpers para
 * consumers in-tree que todavía necesitan el string literal del módulo o los
 * tipos del service:
 *
 * - `BANNER_MODULE` — usado por:
 *     * `api/admin/ai-assistant/threads/[id]/campaign/route.ts` para resolver
 *       el service via `req.scope.resolve(BANNER_MODULE)` (que ahora apunta al
 *       plugin).
 *     * `modules/ai-assistant/ai/campaign-enrich.ts` (mismo patrón).
 *     * `workflows/create-banner.ts` (shim in-tree, ver más abajo).
 *
 * - `service.ts` + `types.ts` — importados como TYPE por
 *   `workflows/create-banner.ts`, el workflow que quedó en el host porque
 *   `modules/ai-assistant/ai/native-tools/artifact-tools.ts` lo carga con
 *   `loadLazyModule` (ver `lib/lazy-module.ts`). Los tipos se
 *   borran en build; no acoplan runtime.
 *
 * - `site-scope.ts`, `models/`, `ai/*` — se dejan por si un futuro consumer
 *   in-tree los necesita como types/utils; no se importan hoy, y como no hay
 *   Module() registrado, mikro-orm no descubre los modelos.
 *
 * Migrations borradas: son propiedad del plugin. Cuando ai-assistant migre a
 * su propio plugin (o consuma `@minimalart/mercatto-plugin-banners` con más
 * exports públicos), este directorio se puede borrar.
 */

export const BANNER_MODULE = 'banner';
