"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEXT_FIELDS = void 0;
exports.buildEnrichmentMessages = buildEnrichmentMessages;
/** Campos de texto soportados por el enriquecimiento IA (PRD §12.1). */
exports.TEXT_FIELDS = [
    'subtitle',
    'description',
    'meta_title',
    'meta_description',
    'keywords',
    'categories',
    'tags',
    'alt_text',
];
/** Descripción por campo para instruir al modelo (defaults; la config las pisa). */
const FIELD_INSTRUCTIONS = {
    subtitle: 'Subtítulo corto y atractivo (máx 120 caracteres). Sin repetir el título literal.',
    description: 'Descripción de producto clara y comercial (2-4 párrafos, máx 600 caracteres). Basada SÓLO en información disponible; no inventar especificaciones.',
    meta_title: 'Meta title SEO (máx 60 caracteres) con la palabra clave principal.',
    meta_description: 'Meta description SEO (máx 155 caracteres), persuasiva y con llamada a la acción sutil.',
    keywords: 'Array de 5-8 keywords SEO en minúsculas, sin marcas de terceros ni repetir el título entero.',
    categories: 'Array con los NOMBRES o PATHS de categorías que MEJOR aplican, ELEGIDOS EXCLUSIVAMENTE de la lista de categorías existentes provista. Nunca inventar categorías nuevas.',
    tags: 'Array de tags ELEGIDOS EXCLUSIVAMENTE de la lista de tags existentes provista. Nunca inventar tags nuevos.',
    alt_text: 'Texto alternativo descriptivo de la imagen principal (máx 125 caracteres), accesible y con la keyword principal.',
};
/**
 * Construye el prompt de sistema + usuario para generar los campos pedidos.
 * `allowedCategories`/`allowedTags` fuerzan a reutilizar entidades existentes.
 */
function buildEnrichmentMessages(opts) {
    const { config, fields, product } = opts;
    const language = config.text.language || 'es';
    const tone = config.text.tone || 'claro y comercial';
    const fieldSpecs = fields
        .map((f) => `- "${f}": ${config.text.field_prompts[f] || FIELD_INSTRUCTIONS[f]}`)
        .join('\n');
    const system = [
        `Sos un catalogador experto de e-commerce. Redactás contenido en ${language}, con tono ${tone}.`,
        config.text.base_prompt || '',
        'Reglas: no inventar especificaciones técnicas ni atributos que no puedas inferir con seguridad.',
        'Cuando falte información, preferí ser conservador antes que inventar.',
        'Respondé EXCLUSIVAMENTE con un objeto JSON válido con exactamente las claves pedidas. Sin texto adicional ni fences.',
    ]
        .filter(Boolean)
        .join(' ');
    const catList = opts.allowedCategories.length
        ? opts.allowedCategories.slice(0, 300).map((c) => `  • ${c}`).join('\n')
        : '  (no hay categorías existentes; devolvé categories: [])';
    const tagList = opts.allowedTags.length
        ? opts.allowedTags.slice(0, 300).map((t) => `  • ${t}`).join('\n')
        : '  (no hay tags existentes; devolvé tags: [])';
    const userText = [
        'DATOS DEL PRODUCTO EXISTENTE:',
        `- Título: ${product.title}`,
        product.subtitle ? `- Subtítulo actual: ${product.subtitle}` : null,
        product.description ? `- Descripción actual: ${truncate(product.description, 800)}` : null,
        product.brand ? `- Marca: ${product.brand}` : null,
        product.collection ? `- Colección: ${product.collection}` : null,
        product.category_paths.length ? `- Categorías actuales: ${product.category_paths.join('; ')}` : null,
        product.tag_values.length ? `- Tags actuales: ${product.tag_values.join(', ')}` : null,
        product.variant_skus.length ? `- SKUs: ${product.variant_skus.slice(0, 10).join(', ')}` : null,
        product.metadata && Object.keys(product.metadata).length
            ? `- Metadata: ${truncate(JSON.stringify(product.metadata), 500)}`
            : null,
        opts.externalContext ? `\nCONTEXTO EXTERNO ENCONTRADO (usar sólo como referencia, verificar):\n${truncate(opts.externalContext, 1500)}` : null,
        fields.includes('categories') ? `\nCATEGORÍAS EXISTENTES (elegí SÓLO de esta lista):\n${catList}` : null,
        fields.includes('tags') ? `\nTAGS EXISTENTES (elegí SÓLO de esta lista):\n${tagList}` : null,
        opts.imageDataUrl ? '\nSe adjunta la imagen principal del producto: analizala para el contenido.' : null,
        '\nGENERÁ un JSON con EXACTAMENTE estas claves:',
        fieldSpecs,
    ]
        .filter(Boolean)
        .join('\n');
    return { system, userText, imageDataUrl: opts.imageDataUrl };
}
function truncate(s, n) {
    return s.length > n ? `${s.slice(0, n)}…` : s;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NhdGFsb2dhZG9yL2FpL3Byb21wdHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK0NBLDBEQThEQztBQTNHRCx3RUFBd0U7QUFDM0QsUUFBQSxXQUFXLEdBQUc7SUFDekIsVUFBVTtJQUNWLGFBQWE7SUFDYixZQUFZO0lBQ1osa0JBQWtCO0lBQ2xCLFVBQVU7SUFDVixZQUFZO0lBQ1osTUFBTTtJQUNOLFVBQVU7Q0FDRixDQUFDO0FBSVgsb0ZBQW9GO0FBQ3BGLE1BQU0sa0JBQWtCLEdBQThCO0lBQ3BELFFBQVEsRUFBRSxrRkFBa0Y7SUFDNUYsV0FBVyxFQUNULG9KQUFvSjtJQUN0SixVQUFVLEVBQUUsb0VBQW9FO0lBQ2hGLGdCQUFnQixFQUFFLHdGQUF3RjtJQUMxRyxRQUFRLEVBQUUsOEZBQThGO0lBQ3hHLFVBQVUsRUFDUix5S0FBeUs7SUFDM0ssSUFBSSxFQUFFLDRHQUE0RztJQUNsSCxRQUFRLEVBQUUsa0hBQWtIO0NBQzdILENBQUM7QUFlRjs7O0dBR0c7QUFDSCxTQUFnQix1QkFBdUIsQ0FBQyxJQVF2QztJQUtDLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQztJQUN6QyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUM7SUFDOUMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksbUJBQW1CLENBQUM7SUFFckQsTUFBTSxVQUFVLEdBQUcsTUFBTTtTQUN0QixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxFQUFFLENB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