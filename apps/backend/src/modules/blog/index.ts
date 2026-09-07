/**
 * ⚠️ Módulo blog migrado a `@minimalart/mercatto-plugin-blog`.
 *
 * Este directorio NO se registra como módulo (medusa-config.ts ya no llama
 * `optionalModule('blog', 'blog')`). Se conserva como shim de helpers para
 * consumers in-tree que todavía necesitan:
 *
 * - `getBlogEditorExtensions` (Tiptap) — usado por ai-assistant native tools
 * - `renderBlogContentHtml` — usado por ai-assistant workflow engine
 * - `BlogModuleService` (type only) — idem
 * - `BLOG_MODULE` (string constant) — idem
 *
 * Migrations borradas: son propiedad del plugin. Mikro-orm no descubre los
 * modelos porque el módulo no está registrado. Cuando ai-assistant migre
 * a plugin propio o consuma directamente `@minimalart/mercatto-plugin-blog`
 * (bumpado con más exports), este directorio se puede borrar.
 */

export const BLOG_MODULE = 'blog';
