/**
 * ⚠️ Módulo landing-page migrado a `@minimalart/mercatto-plugin-landing-pages`.
 *
 * Este directorio NO se registra como módulo (medusa-config.ts ya no llama
 * `optionalModule('landing_page', 'landing-page')`). Se conserva como shim de
 * helpers para consumers in-tree que todavía necesitan:
 *
 * - `ChatMessage` / `callOpenRouter` / `getAiConfig` (ai/client) — usados por
 *   `modules/banner/ai/{generator,prompts}.ts`.
 * - `LandingAiError` (ai/types) — usado por `modules/banner/ai/generator.ts`.
 * - `generateImage` / `AspectRatio` (ai/image-client) — usados por
 *   `modules/ai-assistant/ai/native-tools/index.ts` y por
 *   `modules/ai-assistant/ai/campaign-enrich.ts`.
 * - `optimizeToWebp` (ai/image-optimize) — mismo par de consumers.
 * - `generateLandingPuckData` (ai/generator) + `sanitizePuckData` (ai/puck-schema)
 *   — usados por `modules/ai-assistant/ai/campaign-enrich.ts`.
 * - `LANDING_PAGE_MODULE` (string constant) — la usa `campaign-enrich` para
 *   resolver el service via `req.scope.resolve(LANDING_PAGE_MODULE)`, que ahora
 *   apunta al plugin.
 *
 * Migrations borradas: son propiedad del plugin. Mikro-orm no descubre los
 * modelos porque el módulo no está registrado. Cuando banner y ai-assistant
 * migren a plugins propios (o consuman `@minimalart/mercatto-plugin-landing-pages`
 * bumpeado con más exports), este directorio se puede borrar.
 */

export const LANDING_PAGE_MODULE = 'landing_page';
