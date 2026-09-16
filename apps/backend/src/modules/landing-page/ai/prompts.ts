import type { ChatMessage } from './client';
import type {
  GenerateLandingInput,
  ImproveCopyInput,
  SeoInput,
  TranslateInput,
} from './types';

/**
 * Especificación de componentes para el modelo. Mantener EN SYNC con
 * puck-schema.ts (la salida se valida contra ese schema de todas formas).
 */
const COMPONENT_SPEC = `Componentes permitidos y sus props EXACTAS (no inventar otras, no agregar props):
- Hero: { "title": string, "eyebrow": string, "layout": "overlay"|"split", "subtitle": string, "image": string (URL), "imagePrompt": string, "ctaLabel": string, "ctaHref": string (URL o ruta /...) }
- RichText: { "heading": string, "text": string }
- ImageBlock: { "src": string (URL), "alt": string, "caption": string, "imagePrompt": string }
- ImageText: { "eyebrow": string, "heading": string, "text": string, "image": string (URL), "alt": string, "imagePrompt": string, "imagePosition": "left"|"right", "ctaLabel": string, "ctaHref": string }
- FeatureGrid: { "heading": string, "description": string, "items": [{ "title": string, "text": string }] } (3 a 6 beneficios reales o ideas de uso; no inventar condiciones comerciales)
- CTA: { "title": string, "description": string, "buttonLabel": string, "buttonHref": string (URL o ruta /...) }
- FAQ: { "heading": string, "items": [{ "q": string, "a": string }] }
- Testimonials: { "heading": string, "items": [{ "quote": string, "author": string }] }
- CollectionGrid: { "heading": string, "items": [{ "label": string, "handle": string, "href": string }] }
- ProductGrid: { "heading": string, "href": string (ruta /store...), "ctaLabel": string } (solo un botón "ver productos", NO trae productos)
- ProductsList: { "heading": string, "source": "newest"|"promotions"|"category"|"collection"|"tag"|"query", "value": string, "limit": number (1 a 24), "sortBy": ""|"created_at"|"price_asc"|"price_desc"|"relevance", "ctaLabel": string, "href": string } (trae productos REALES de Typesense. "value" es el nombre de la categoría/colección, el tag o el texto de búsqueda según "source"; para "newest" y "promotions" dejar "value" en ""; usar este componente cuando se quieran mostrar productos)
- Spacer: { "size": number (0 a 400) }
Todos los bloques excepto Spacer aceptan "background" y "textColor" (colores CSS o vacío para heredar la marca). Hero, ImageText y CTA también aceptan "accentColor" para el botón.`;

const OUTPUT_SHAPE = `La salida debe tener EXACTAMENTE esta forma:
{
  "content": [
    { "type": "Hero", "props": { "title": "..." } }
  ],
  "root": { "props": {} }
}`;

export const SYSTEM_PROMPT = `Sos un generador de landing pages de ecommerce para un editor visual basado en Puck.

Reglas estrictas:
- Respondé EXCLUSIVAMENTE JSON válido. Nada de Markdown, HTML, JSX ni comentarios.
- No inventes componentes ni props fuera de la lista.
- No agregues event handlers (onClick, onLoad, etc.), scripts, iframes ni dangerouslySetInnerHTML.
- Las URLs de imagen pueden quedar vacías ("") si no tenés una real; no inventes dominios falsos.
- Los links internos deben ser rutas relativas (ej: "/store", "/store?category=...").
- Escribí en el idioma del campo "locale" del usuario (por defecto es-AR).
- Generá una landing coherente y vendedora: empezá con un Hero y cerrá con un CTA.
- Proponé una composición editorial de 5 a 8 secciones con ritmo visual: Hero, productos relevantes, ImageText, FeatureGrid y cierre. Variá la composición según el brief; evitá repetir bloques de texto y grandes espaciadores. Preferí Hero split para combinar fotografía y título legible.
- Usá títulos específicos, copy breve, jerarquía clara y una paleta coherente con buen contraste. Dejá colores vacíos si no se indicó identidad visual; no impongas una marca inventada.
- Incluí 2 o 3 espacios de imagen (Hero/ImageText/ImageBlock). Sus URLs deben quedar vacías salvo que el usuario aporte una real. Escribí imagePrompt con dirección de arte concreta: escena, productos genéricos, luz, composición y paleta; SIN texto ni marcas. Las imágenes se generarán en una segunda etapa automática.
- Categorías y colecciones son entidades de Medusa, no temas creativos. Sin evidencia del catálogo usá ProductsList source="query" con un término breve (por ejemplo un tipo de producto). Nunca inventes IDs, handles, categorías ni enlaces filtrados. El servidor validará referencias y resultados; el texto del brief NO es evidencia de una categoría existente.
- Para mostrar productos usá ProductsList, NO ProductGrid (que sólo es un enlace). Los enlaces de búsqueda usan /store?q=texto. No afirmes cantidades, precios, descuentos, stock, envío gratis ni fechas que no estén confirmados en el brief.
- No inventes testimonios, personas ni garantías. Omití Testimonials sin testimonios aportados. FAQ sólo con respuestas sustentadas por la información recibida.

${COMPONENT_SPEC}

${OUTPUT_SHAPE}`;

const userContext = (input: GenerateLandingInput): string => {
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

export function buildGenerateMessages(input: GenerateLandingInput): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Generá una landing page nueva.\n\n${userContext(input)}` },
  ];
  if (input.currentPuckData?.content?.length) {
    messages.push({
      role: 'user',
      content: `Landing actual (mejorá/expandí respetando lo bueno):\n${JSON.stringify(
        input.currentPuckData,
      )}`,
    });
  }
  return messages;
}

export function buildImproveCopyMessages(input: ImproveCopyInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}

MODO MEJORAR TEXTOS: te paso un puck_data existente. Devolvé el MISMO JSON con la MISMA estructura, MISMOS componentes, MISMO orden y MISMOS links/handles/imágenes. Sólo mejorá los textos. No agregues ni quites bloques.`,
    },
    {
      role: 'user',
      content: `Instrucción: ${input.instruction}\nLocale: ${input.locale || 'es-AR'}\n\npuck_data actual:\n${JSON.stringify(
        input.currentPuckData,
      )}`,
    },
  ];
}

export function buildTranslateMessages(input: TranslateInput): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT}

MODO TRADUCIR: te paso un puck_data. Devolvé el MISMO JSON con la MISMA estructura, MISMOS componentes, MISMO orden, MISMOS links, handles e imágenes (URLs). Traducí ÚNICAMENTE los textos visibles al locale destino.`,
    },
    {
      role: 'user',
      content: `Locale destino: ${input.targetLocale}\n\npuck_data actual:\n${JSON.stringify(
        input.currentPuckData,
      )}`,
    },
  ];
}

/**
 * Regla anti-texto. Es lo más importante del prompt: nano banana (Gemini Image)
 * tiende a "escribir" en la imagen, sobre todo si le pasás copy. Por eso la
 * ponemos al PRINCIPIO y al FINAL del prompt (los modelos pesan más los
 * extremos) y enumeramos casos concretos.
 */
const NO_TEXT_RULE =
  'IMAGEN SIN NINGÚN TEXTO. Está terminantemente prohibido renderizar texto, palabras, letras, números, títulos, leyendas, subtítulos, tipografía, frases, carteles, señalización, etiquetas, packaging con texto legible, logos, marcas, marcas de agua, sellos, firmas o cualquier elemento de interfaz. Si en la escena una superficie normalmente tendría texto (carteles, envases, pizarras, pantallas), dejala vacía, lisa o desenfocada. Generá una imagen 100% visual, sin una sola letra.';

/**
 * Construye el prompt de generación de IMAGEN para un slot (Hero/ImageBlock).
 *
 * IMPORTANTE: el copy del bloque (título, subtítulo, caption) se usa SOLO como
 * contexto temático para inspirar la escena, NUNCA como texto a dibujar — si se
 * lo pasás como "Título: X" el modelo lo escribe dentro de la imagen. El texto
 * real se superpone aparte en el storefront. El aspect ratio va por image_config.
 */
export function buildImagePrompt(opts: {
  kind: 'hero' | 'imageBlock';
  landingTitle: string;
  slotTitle?: string;
  slotSubtitle?: string;
  alt?: string;
  caption?: string;
  styleHint?: string;
}): string {
  const role =
    opts.kind === 'hero'
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
    ? `Contexto temático para inspirar la escena (es solo referencia conceptual: NO escribas estas palabras ni ninguna otra dentro de la imagen): ${themeBits.join(
        ' — ',
      )}.`
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

export function buildSeoMessages(input: SeoInput): ChatMessage[] {
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
