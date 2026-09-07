import type { CatalogadorConfig } from '../config';

/** Campos de texto soportados por el enriquecimiento IA (PRD §12.1). */
export const TEXT_FIELDS = [
  'subtitle',
  'description',
  'meta_title',
  'meta_description',
  'keywords',
  'categories',
  'tags',
  'alt_text',
] as const;

export type TextField = (typeof TEXT_FIELDS)[number];

/** Descripción por campo para instruir al modelo (defaults; la config las pisa). */
const FIELD_INSTRUCTIONS: Record<TextField, string> = {
  subtitle: 'Subtítulo corto y atractivo (máx 120 caracteres). Sin repetir el título literal.',
  description:
    'Descripción de producto clara y comercial (2-4 párrafos, máx 600 caracteres). Basada SÓLO en información disponible; no inventar especificaciones.',
  meta_title: 'Meta title SEO (máx 60 caracteres) con la palabra clave principal.',
  meta_description: 'Meta description SEO (máx 155 caracteres), persuasiva y con llamada a la acción sutil.',
  keywords: 'Array de 5-8 keywords SEO en minúsculas, sin marcas de terceros ni repetir el título entero.',
  categories:
    'Array con los NOMBRES o PATHS de categorías que MEJOR aplican, ELEGIDOS EXCLUSIVAMENTE de la lista de categorías existentes provista. Nunca inventar categorías nuevas.',
  tags: 'Array de tags ELEGIDOS EXCLUSIVAMENTE de la lista de tags existentes provista. Nunca inventar tags nuevos.',
  alt_text: 'Texto alternativo descriptivo de la imagen principal (máx 125 caracteres), accesible y con la keyword principal.',
};

export type ProductContext = {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  collection?: string | null;
  brand?: string | null;
  category_paths: string[];
  tag_values: string[];
  variant_skus: string[];
  metadata?: Record<string, unknown> | null;
  has_image: boolean;
};

/**
 * Construye el prompt de sistema + usuario para generar los campos pedidos.
 * `allowedCategories`/`allowedTags` fuerzan a reutilizar entidades existentes.
 */
export function buildEnrichmentMessages(opts: {
  config: CatalogadorConfig;
  fields: TextField[];
  product: ProductContext;
  allowedCategories: string[];
  allowedTags: string[];
  imageDataUrl?: string | null;
  externalContext?: string | null;
}): {
  system: string;
  userText: string;
  imageDataUrl?: string | null;
} {
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
