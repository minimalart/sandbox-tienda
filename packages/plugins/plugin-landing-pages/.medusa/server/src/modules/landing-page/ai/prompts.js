"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_PROMPT = void 0;
exports.buildGenerateMessages = buildGenerateMessages;
exports.buildImproveCopyMessages = buildImproveCopyMessages;
exports.buildTranslateMessages = buildTranslateMessages;
exports.buildImagePrompt = buildImagePrompt;
exports.buildSeoMessages = buildSeoMessages;
/**
 * Especificación de componentes para el modelo. Mantener EN SYNC con
 * puck-schema.ts (la salida se valida contra ese schema de todas formas).
 */
const COMPONENT_SPEC = `Componentes permitidos y sus props EXACTAS (no inventar otras, no agregar props):
- Hero: { "title": string, "subtitle": string, "image": string (URL), "ctaLabel": string, "ctaHref": string (URL o ruta /...) }
- RichText: { "heading": string, "text": string }
- ImageBlock: { "src": string (URL), "alt": string, "caption": string }
- CTA: { "title": string, "description": string, "buttonLabel": string, "buttonHref": string (URL o ruta /...) }
- FAQ: { "heading": string, "items": [{ "q": string, "a": string }] }
- Testimonials: { "heading": string, "items": [{ "quote": string, "author": string }] }
- CollectionGrid: { "heading": string, "items": [{ "label": string, "handle": string, "href": string }] }
- ProductGrid: { "heading": string, "href": string (ruta /store...), "ctaLabel": string } (solo un botón "ver productos", NO trae productos)
- ProductsList: { "heading": string, "source": "newest"|"promotions"|"category"|"collection"|"tag"|"query", "value": string, "limit": number (1 a 24), "sortBy": ""|"created_at"|"price_asc"|"price_desc"|"relevance", "ctaLabel": string, "href": string } (trae productos REALES de Typesense. "value" es el nombre de la categoría/colección, el tag o el texto de búsqueda según "source"; para "newest" y "promotions" dejar "value" en ""; usar este componente cuando se quieran mostrar productos)
- Spacer: { "size": number (0 a 400) }`;
const OUTPUT_SHAPE = `La salida debe tener EXACTAMENTE esta forma:
{
  "content": [
    { "type": "Hero", "props": { "title": "..." } }
  ],
  "root": { "props": {} }
}`;
exports.SYSTEM_PROMPT = `Sos un generador de landing pages de ecommerce para un editor visual basado en Puck.

Reglas estrictas:
- Respondé EXCLUSIVAMENTE JSON válido. Nada de Markdown, HTML, JSX ni comentarios.
- No inventes componentes ni props fuera de la lista.
- No agregues event handlers (onClick, onLoad, etc.), scripts, iframes ni dangerouslySetInnerHTML.
- Las URLs de imagen pueden quedar vacías ("") si no tenés una real; no inventes dominios falsos.
- Los links internos deben ser rutas relativas (ej: "/store", "/store?category=...").
- Escribí en el idioma del campo "locale" del usuario (por defecto es-AR).
- Generá una landing coherente y vendedora: empezá con un Hero y cerrá con un CTA.

${COMPONENT_SPEC}

${OUTPUT_SHAPE}`;
const userContext = (input) => {
    const lines = [
        `Brief: ${input.brief}`,
        input.goal ? `Objetivo: ${input.goal}` : null,
        input.tone ? `Tono: ${input.tone}` : null,
        input.audience ? `Audiencia: ${input.audience}` : null,
        input.campaign ? `Campaña: ${input.campaign}` : null,
        `Locale: ${input.locale || 'es-AR'}`,
        input.components?.length
            ? `Priorizá estos componentes (en orden si tiene sentido): ${input.components.join(', ')}`
            : null,
        input.productContext ? `Contexto de productos/colecciones: ${input.productContext}` : null,
    ].filter(Boolean);
    return lines.join('\n');
};
function buildGenerateMessages(input) {
    const messages = [
        { role: 'system', content: exports.SYSTEM_PROMPT },
        { role: 'user', content: `Generá una landing page nueva.\n\n${userContext(input)}` },
    ];
    if (input.currentPuckData?.content?.length) {
        messages.push({
            role: 'user',
            content: `Landing actual (mejorá/expandí respetando lo bueno):\n${JSON.stringify(input.currentPuckData)}`,
        });
    }
    return messages;
}
function buildImproveCopyMessages(input) {
    return [
        {
            role: 'system',
            content: `${exports.SYSTEM_PROMPT}

MODO MEJORAR TEXTOS: te paso un puck_data existente. Devolvé el MISMO JSON con la MISMA estructura, MISMOS componentes, MISMO orden y MISMOS links/handles/imágenes. Sólo mejorá los textos. No agregues ni quites bloques.`,
        },
        {
            role: 'user',
            content: `Instrucción: ${input.instruction}\nLocale: ${input.locale || 'es-AR'}\n\npuck_data actual:\n${JSON.stringify(input.currentPuckData)}`,
        },
    ];
}
function buildTranslateMessages(input) {
    return [
        {
            role: 'system',
            content: `${exports.SYSTEM_PROMPT}

MODO TRADUCIR: te paso un puck_data. Devolvé el MISMO JSON con la MISMA estructura, MISMOS componentes, MISMO orden, MISMOS links, handles e imágenes (URLs). Traducí ÚNICAMENTE los textos visibles al locale destino.`,
        },
        {
            role: 'user',
            content: `Locale destino: ${input.targetLocale}\n\npuck_data actual:\n${JSON.stringify(input.currentPuckData)}`,
        },
    ];
}
/**
 * Regla anti-texto. Es lo más importante del prompt: nano banana (Gemini Image)
 * tiende a "escribir" en la imagen, sobre todo si le pasás copy. Por eso la
 * ponemos al PRINCIPIO y al FINAL del prompt (los modelos pesan más los
 * extremos) y enumeramos casos concretos.
 */
const NO_TEXT_RULE = 'IMAGEN SIN NINGÚN TEXTO. Está terminantemente prohibido renderizar texto, palabras, letras, números, títulos, leyendas, subtítulos, tipografía, frases, carteles, señalización, etiquetas, packaging con texto legible, logos, marcas, marcas de agua, sellos, firmas o cualquier elemento de interfaz. Si en la escena una superficie normalmente tendría texto (carteles, envases, pizarras, pantallas), dejala vacía, lisa o desenfocada. Generá una imagen 100% visual, sin una sola letra.';
/**
 * Construye el prompt de generación de IMAGEN para un slot (Hero/ImageBlock).
 *
 * IMPORTANTE: el copy del bloque (título, subtítulo, caption) se usa SOLO como
 * contexto temático para inspirar la escena, NUNCA como texto a dibujar — si se
 * lo pasás como "Título: X" el modelo lo escribe dentro de la imagen. El texto
 * real se superpone aparte en el storefront. El aspect ratio va por image_config.
 */
function buildImagePrompt(opts) {
    const role = opts.kind === 'hero'
        ? 'Imagen de banner hero para ecommerce profesional, atractiva y de alta calidad'
        : 'Imagen editorial de producto/lifestyle para ecommerce, limpia y de alta calidad';
    // El copy va como inspiración temática, con prohibición explícita de escribirlo.
    const themeBits = [
        opts.landingTitle,
        opts.slotTitle,
        opts.slotSubtitle,
        opts.alt,
        opts.caption,
    ]
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean);
    const theme = themeBits.length
        ? `Contexto temático para inspirar la escena (es solo referencia conceptual: NO escribas estas palabras ni ninguna otra dentro de la imagen): ${themeBits.join(' — ')}.`
        : '';
    return [
        NO_TEXT_RULE,
        role + '.',
        theme,
        opts.styleHint ? `Estilo: ${opts.styleHint}.` : null,
        'Composición fotográfica realista, buena iluminación, foco en el producto/tema.',
        // El texto del banner se superpone aparte en el storefront: la imagen debe
        // dejar lugar para que se lea. Pedimos zonas tonales uniformes y buen
        // contraste (sin detalle ni brillo fuerte en el centro/parte superior).
        opts.kind === 'hero'
            ? 'Se usará como FONDO de un banner con textos superpuestos: dejá áreas de tono parejo y buen contraste (evitá detalle, brillo o zonas claras en el centro y la parte superior) para que el texto sea legible.'
            : null,
        // Repetimos la regla al cierre para reforzarla.
        NO_TEXT_RULE,
    ]
        .filter(Boolean)
        .join(' ');
}
function buildSeoMessages(input) {
    return [
        {
            role: 'system',
            content: `Sos un especialista SEO de ecommerce. Respondé EXCLUSIVAMENTE JSON válido, sin Markdown ni comentarios, con esta forma exacta:
{ "title": string (max 60 chars), "description": string (max 155 chars), "image": string (URL o ""), "noindex": boolean }`,
        },
        {
            role: 'user',
            content: [
                `Título de la landing: ${input.title}`,
                `Locale: ${input.locale || 'es-AR'}`,
                input.keywords?.length ? `Keywords: ${input.keywords.join(', ')}` : null,
                input.currentPuckData
                    ? `Contenido (para contexto):\n${JSON.stringify(input.currentPuckData).slice(0, 4000)}`
                    : null,
            ]
                .filter(Boolean)
                .join('\n'),
        },
    ];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvbXB0cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xhbmRpbmctcGFnZS9haS9wcm9tcHRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQStEQSxzREFjQztBQUVELDREQWVDO0FBRUQsd0RBZUM7QUFtQkQsNENBK0NDO0FBRUQsNENBcUJDO0FBaE1EOzs7R0FHRztBQUNILE1BQU0sY0FBYyxHQUFHOzs7Ozs7Ozs7O3VDQVVnQixDQUFDO0FBRXhDLE1BQU0sWUFBWSxHQUFHOzs7Ozs7RUFNbkIsQ0FBQztBQUVVLFFBQUEsYUFBYSxHQUFHOzs7Ozs7Ozs7OztFQVczQixjQUFjOztFQUVkLFlBQVksRUFBRSxDQUFDO0FBRWpCLE1BQU0sV0FBVyxHQUFHLENBQUMsS0FBMkIsRUFBVSxFQUFFO0lBQzFELE1BQU0sS0FBSyxHQUFHO1FBQ1osVUFBVSxLQUFLLENBQUMsS0FBSyxFQUFFO1FBQ3ZCLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLGFBQWEsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO1FBQzdDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFNBQVMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO1FBQ3pDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO1FBQ3RELEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJO1FBQ3BELFdBQVcsS0FBSyxDQUFDLE1BQU0sSUFBSSxPQUFPLEVBQUU7UUFDcEMsS0FBSyxDQUFDLFVBQVUsRUFBRSxNQUFNO1lBQ3RCLENBQUMsQ0FBQywyREFBMkQsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMs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