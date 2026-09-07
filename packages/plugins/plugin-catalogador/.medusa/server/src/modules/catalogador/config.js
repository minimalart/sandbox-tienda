"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATALOGADOR_SETTING_KEY = void 0;
exports.getCatalogadorDefaults = getCatalogadorDefaults;
exports.mergeCatalogadorConfig = mergeCatalogadorConfig;
exports.getCatalogadorConfig = getCatalogadorConfig;
exports.upsertCatalogadorConfig = upsertCatalogadorConfig;
const foreign_modules_1 = require("../../lib/foreign-modules");
const settings_1 = require("./settings");
/**
 * Configuración del Catalogador (PRD §22). Se persiste como un único setting
 * key/value en el módulo store-config (key `catalogador_config`), reutilizando
 * su API genérica `upsertSetting`/`listStoreSettings` — así NO se modifica el
 * código de store-config (la extensión sólo lo declara como dependencia). Los
 * secretos (API keys de barcode/scraping) NUNCA viven en este objeto (PRD §22.4):
 * se resuelven aparte, por `app-settings` (DB cifrada > env), en `settings.ts`.
 */
exports.CATALOGADOR_SETTING_KEY = 'catalogador_config';
/**
 * Defaults sensatos. Los dos modelos sólo se SIEMBRAN desde `app-settings`
 * (DB > env > default): la config guardada del Catalogador los sigue pisando.
 *
 * Es una FUNCIÓN y no una `const` a propósito: como `const` de nivel superior,
 * los modelos se congelaban en el primer import del proceso y guardar en el
 * admin no tenía efecto hasta reiniciar. El costo de rearmar este literal es
 * despreciable al lado de una sola llamada a OpenRouter.
 */
function getCatalogadorDefaults() {
    const settings = (0, settings_1.getCatalogadorSettings)();
    return {
        text: {
            // Mismo enfoque que selectio-ia-tool (OpenRouter, modelo multimodal para
            // analizar la imagen del producto). selectio lo tomaba de env; acá se fija
            // un default vision-capable, configurable.
            model: settings.textModel,
            temperature: 0.7,
            max_tokens: 1200,
            reasoning_effort: 'low',
            language: 'es',
            tone: 'claro y comercial',
            max_retries: 2,
            base_prompt: 'Analizá el producto usando su información existente y, si hay, su imagen. Generá contenido de catálogo en español, claro y comercial. No inventes especificaciones, medidas ni atributos que no puedas inferir con seguridad; si falta información, sé conservador.',
            // Reglas portadas de selectio-ia-tool (generalizadas de juguetes a producto).
            field_prompts: {
                subtitle: 'Subtítulo breve y atractivo (máximo 150 caracteres), sin repetir literalmente el título.',
                description: 'Descripción del producto en español (máximo 500 caracteres) con características, beneficios y detalles relevantes, basada sólo en información disponible.',
                keywords: 'Exactamente 8 palabras clave de búsqueda en español. Cada una debe ser UNA SOLA PALABRA (solo letras, sin números, guiones, barras ni espacios). NO incluir género, rango etario, nombres de categorías, marcas, colores genéricos ni materiales genéricos. Deben ser sinónimos, variantes o términos alternativos con los que un usuario buscaría el producto. Si en la imagen se ve el packaging, UNA debe ser exactamente una de: caja, blister, bolsa, pack, tubo, display, ventana.',
                meta_title: 'Meta title SEO (máximo 60 caracteres) con la palabra clave principal.',
                meta_description: 'Meta description SEO (máximo 155 caracteres), persuasiva y con una llamada a la acción sutil.',
            },
        },
        image_ai: {
            // nano-banana (Gemini 2.5 Flash Image), igual que selectio-ia-tool (OPENROUTER_UNIFY_MODEL).
            model: settings.imageModel,
            aspect_ratio: '1:1',
            variations: 2,
            max_images_per_product: 4,
            base_prompt: '',
            // Prompt de estandarización sobre fondo blanco, portado de selectio-ia-tool
            // (PRIMARY_PROMPT), generalizado de "toy" a "product".
            recreate_prompt: 'You are a professional product catalog designer. Standardize this product photo into a clean, consistent catalog shot. Requirements: PURE WHITE BACKGROUND (#FFFFFF) — no gray, off-white or gradients. Square 1:1 canvas with the complete product fully visible and centered. Fit the entire product so its longest side occupies ~78% of the canvas, with at least 10% clear white padding on every edge. Do not zoom, crop, cut off, or let the product touch the edge. Maintain realistic colors, textures and printed branding from the original. Remove uneven shadows, clutter, measurement arrows, size callouts, spec tables, price tags, stickers or extra text overlays that are not printed on the packaging itself. Preserve only legitimate branding printed on the product/package. Soft natural light. Output a realistic, high-quality e-commerce image on a pure white background.',
            lifestyle_prompt: 'Create a realistic lifestyle scene featuring this exact product in a natural, appealing context of use. Keep the product faithful to the reference photo (shape, colors, printed branding). Professional e-commerce photography with soft, natural lighting. Do not add text overlays.',
            background_prompt: 'Place this exact product on the configured background, keeping it faithful to the reference. Studio-quality, 1:1, soft lighting, no text overlays.',
            missing_prompt: 'Generate a clean product photo based on the product name and any reference, on a pure white background (#FFFFFF), centered, square 1:1.',
            preserve_product: true,
            editable_lifestyle_enabled: true,
            editable_lifestyle_default_scale: 0.25,
        },
        image_technical: {
            output_format: 'webp',
            webp_quality: 82,
            max_kb: 200,
            max_dimension: 1600,
            min_dimension: 500,
            keep_originals: true,
        },
        external: {
            barcode_enabled: false,
            barcode_provider: '',
            scraping_enabled: false,
            scraping_provider: 'tavily',
            allowed_domains: [],
            blocked_domains: [],
            max_pages_per_product: 3,
            timeout_ms: 8000,
            user_agent: 'MercattoCatalogador/1.0',
        },
        rules: {
            do_not_overwrite_manual: true,
            only_fill_empty: false,
            allow_improve_existing: true,
            reuse_existing_categories: true,
            reuse_existing_tags: true,
            reuse_existing_brands: true,
            forbid_create_categories: true,
            forbid_create_tags: true,
            forbid_create_brands: true,
            keep_original_images: true,
            no_auto_replace_main_image: true,
            snapshot_before_apply: true,
            require_review_generated_images: true,
            require_review_low_confidence: true,
            low_confidence_threshold: 0.7,
        },
        limits: {
            max_products_per_execution: 500,
            max_concurrent_generations: 4,
            max_regenerations: 5,
            max_retries: 2,
            time_budget_per_product_ms: 60000,
        },
    };
}
/** Merge superficial por sección sobre defaults (nunca devuelve parcial). */
function mergeCatalogadorConfig(value) {
    const v = (value && typeof value === 'object' ? value : {});
    const defaults = getCatalogadorDefaults();
    return {
        text: { ...defaults.text, ...(v.text ?? {}) },
        image_ai: { ...defaults.image_ai, ...(v.image_ai ?? {}) },
        image_technical: { ...defaults.image_technical, ...(v.image_technical ?? {}) },
        external: { ...defaults.external, ...(v.external ?? {}) },
        rules: { ...defaults.rules, ...(v.rules ?? {}) },
        limits: { ...defaults.limits, ...(v.limits ?? {}) },
    };
}
// StoreConfigLike y STORE_CONFIG_MODULE viven en `lib/foreign-modules.ts`
// porque el modulo `storeConfig` es AJENO al plugin (vive en el host) y se
// resuelve por string literal en runtime. La razon del `readSetting`
// —vs. `listStoreSettings({ key })`— sigue igual: desde que `store_setting`
// tiene `site_id`, la segunda puede devolver DOS filas (la de la tienda y la
// global) y quedarse con `rows[0]` da un resultado que depende del plan de
// ejecucion.
/** Lee la config efectiva (merge sobre defaults). */
async function getCatalogadorConfig(container, siteId) {
    const storeConfig = container.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
    const row = await storeConfig.readSetting(exports.CATALOGADOR_SETTING_KEY, siteId);
    return mergeCatalogadorConfig(row?.value);
}
/** Persiste la config (merge parcial sobre lo guardado) y devuelve el resultado. */
async function upsertCatalogadorConfig(container, patch, siteId) {
    const storeConfig = container.resolve(foreign_modules_1.STORE_CONFIG_MODULE);
    const row = await storeConfig.readSetting(exports.CATALOGADOR_SETTING_KEY, siteId);
    const current = mergeCatalogadorConfig(row?.value);
    const merged = mergeCatalogadorConfig({ ...current, ...patch });
    await storeConfig.upsertSetting(exports.CATALOGADOR_SETTING_KEY, merged, siteId);
    return merged;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvY2F0YWxvZ2Fkb3IvY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQW1JQSx3REE0RkM7QUFHRCx3REFXQztBQVdELG9EQUlDO0FBR0QsMERBV0M7QUExUUQsK0RBQXNGO0FBQ3RGLHlDQUFvRDtBQUdwRDs7Ozs7OztHQU9HO0FBQ1UsUUFBQSx1QkFBdUIsR0FBRyxvQkFBb0IsQ0FBQztBQThHNUQ7Ozs7Ozs7O0dBUUc7QUFDSCxTQUFnQixzQkFBc0I7SUFDcEMsTUFBTSxRQUFRLEdBQUcsSUFBQSxpQ0FBc0IsR0FBRSxDQUFDO0lBQzFDLE9BQU87UUFDTCxJQUFJLEVBQUU7WUFDSix5RUFBeUU7WUFDekUsMkVBQTJFO1lBQzNFLDJDQUEyQztZQUMzQyxLQUFLLEVBQUUsUUFBUSxDQUFDLFNBQVM7WUFDekIsV0FBVyxFQUFFLEdBQUc7WUFDaEIsVUFBVSxFQUFFLElBQUk7WUFDaEIsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixRQUFRLEVBQUUsSUFBSTtZQUNkLElBQUksRUFBRSxtQkFBbUI7WUFDekIsV0FBVyxFQUFFLENBQUM7WUFDZCxXQUFXLEVBQ1QscVFBQXFRO1lBQ3ZRLDhFQUE4RTtZQUM5RSxhQUFhLEVBQUU7Z0JBQ2IsUUFBUSxFQUFFLDBGQUEwRjtnQkFDcEcsV0FBVyxFQUNULDJKQUEySjtnQkFDN0osUUFBUSxFQUNOLDBkQUEwZDtnQkFDNWQsVUFBVSxFQUFFLHVFQUF1RTtnQkFDbkYsZ0JBQWdCLEVBQUUsK0ZBQStGO2FBQ2xIO1NBQ0Y7UUFDRCxRQUFRLEVBQUU7WUFDUiw2RkFBNkY7WUFDN0YsS0FBSyxFQUFFLFFBQVEsQ0FBQyxVQUFVO1lBQzFCLFlBQVksRUFBRSxLQUFLO1lBQ25CLFVBQVUsRUFBRSxDQUFDO1lBQ2Isc0JBQXNCLEVBQUUsQ0FBQztZQUN6QixXQUFXLEVBQUUsRUFBRTtZQUNmLDRFQUE0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