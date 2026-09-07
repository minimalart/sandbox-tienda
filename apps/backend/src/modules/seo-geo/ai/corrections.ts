import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { chatComplete, isAiConfigured } from './openrouter';

/** Campos de contenido GEO que la IA puede generar (PRD §15). */
export const CORRECTION_GAPS = [
  'use_cases',
  'benefits',
  'materials',
  'comparison',
  'faq',
  'meta_title',
  'meta_description',
] as const;
export type CorrectionGap = (typeof CORRECTION_GAPS)[number];

const GAP_INSTRUCTIONS: Record<CorrectionGap, string> = {
  use_cases: 'casos de uso concretos (para qué sirve y en qué situaciones), como una lista breve',
  benefits: 'beneficios clave para el cliente, como una lista breve',
  materials: 'materiales y de qué está hecho el producto (si se puede inferir con seguridad)',
  comparison: 'atributos comparables (medidas, capacidad, peso, etc.) como pares clave: valor',
  faq: 'preguntas frecuentes con su respuesta, como lista de {question, answer}',
  meta_title: 'un meta title SEO de máximo 60 caracteres con la palabra clave principal',
  meta_description: 'una meta description SEO de máximo 155 caracteres, persuasiva',
};

export type CorrectionProposals = {
  product_id: string;
  proposals: Partial<Record<CorrectionGap, unknown>>;
  configured: boolean;
  used_catalogador: boolean;
};

type ProductCtx = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  material: string | null;
  categories: string[];
};

async function loadProduct(container: MedusaContainer, productId: string): Promise<ProductCtx | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: 'product',
    fields: ['id', 'title', 'subtitle', 'description', 'material', 'categories.name'],
    filters: { id: productId },
  });
  const p = (data as Array<Record<string, unknown>>)[0];
  if (!p) return null;
  return {
    id: p.id as string,
    title: (p.title as string) ?? '',
    subtitle: (p.subtitle as string) ?? null,
    description: (p.description as string) ?? null,
    material: (p.material as string) ?? null,
    categories: ((p.categories as Array<{ name?: string }>) ?? []).map((c) => c.name).filter(Boolean) as string[],
  };
}

/** ¿Está instalado el Catalogador? (integración opcional, sin acoplar el import). */
function catalogadorAvailable(container: MedusaContainer): boolean {
  try {
    container.resolve('catalogador');
    return true;
  } catch {
    return false;
  }
}

/**
 * Genera propuestas de contenido para cerrar gaps GEO de un producto (PRD §15).
 * NO escribe en el catálogo: devuelve propuestas para aprobación. Self-contained
 * (cliente OpenRouter propio). Cuando el Catalogador está instalado, la UI puede
 * derivar la generación/aplicación a su flujo revisable; acá se marca su
 * disponibilidad para que el frontend ofrezca ese atajo.
 */
export async function generateCorrections(
  container: MedusaContainer,
  productId: string,
  gaps: CorrectionGap[]
): Promise<CorrectionProposals> {
  const used_catalogador = catalogadorAvailable(container);
  if (!isAiConfigured()) {
    return { product_id: productId, proposals: {}, configured: false, used_catalogador };
  }
  const product = await loadProduct(container, productId);
  if (!product) throw new Error(`Producto ${productId} no encontrado`);

  const requested = gaps.length ? gaps : [...CORRECTION_GAPS];
  const wanted = requested.map((g) => `- "${g}": ${GAP_INSTRUCTIONS[g]}`).join('\n');

  const system =
    'Sos un redactor de fichas de producto para ecommerce. Generás contenido útil, honesto y en español. ' +
    'No inventes especificaciones, medidas ni materiales que no puedas inferir con seguridad. ' +
    'Respondé SOLO un objeto JSON con exactamente las claves pedidas.';
  const user =
    `Producto: ${product.title}\n` +
    (product.subtitle ? `Subtítulo: ${product.subtitle}\n` : '') +
    (product.material ? `Material: ${product.material}\n` : '') +
    (product.categories.length ? `Categorías: ${product.categories.join(', ')}\n` : '') +
    (product.description ? `Descripción actual: ${product.description.replace(/<[^>]+>/g, ' ').slice(0, 800)}\n` : '') +
    `\nGenerá un JSON con estas claves:\n${wanted}\n` +
    'Para "faq" devolvé un array de objetos {question, answer}. Para "comparison" un objeto clave:valor. ' +
    'El resto como texto o array de strings.';

  const raw = await chatComplete(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { response_format: { type: 'json_object' }, max_tokens: 1200 }
  );

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Si el modelo no devolvió JSON limpio, intentar recortar al primer objeto
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }

  const proposals: Partial<Record<CorrectionGap, unknown>> = {};
  for (const g of requested) if (g in parsed) proposals[g] = parsed[g];

  return { product_id: productId, proposals, configured: true, used_catalogador };
}

/**
 * Aplica propuestas aprobadas a un producto (conservador): meta_title/description
 * y faq van a metadata; use_cases/benefits/materials se ANEXAN a la descripción
 * sólo si el usuario lo aprueba. Nunca borra contenido existente.
 */
export async function applyCorrections(
  container: MedusaContainer,
  productId: string,
  approved: Partial<Record<CorrectionGap, unknown>>
): Promise<void> {
  const productService = container.resolve(Modules.PRODUCT) as unknown as {
    retrieveProduct: (id: string) => Promise<{ description?: string | null; metadata?: Record<string, unknown> | null }>;
    updateProducts: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  };
  const product = await productService.retrieveProduct(productId);
  const metadata: Record<string, unknown> = { ...(product.metadata ?? {}) };
  const patch: Record<string, unknown> = {};

  if (typeof approved.meta_title === 'string') metadata.meta_title = approved.meta_title;
  if (typeof approved.meta_description === 'string') metadata.meta_description = approved.meta_description;
  if (approved.faq) metadata.faq = approved.faq;
  if (approved.comparison) metadata.attributes = approved.comparison;

  // Anexos de texto a la descripción (sólo si vienen aprobados)
  const appendBlocks: string[] = [];
  const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : []);
  if (approved.benefits) appendBlocks.push('Beneficios: ' + asList(approved.benefits).join('; '));
  if (approved.use_cases) appendBlocks.push('Usos: ' + asList(approved.use_cases).join('; '));
  if (approved.materials) appendBlocks.push('Materiales: ' + asList(approved.materials).join('; '));

  if (appendBlocks.length) {
    patch.description = `${product.description ?? ''}\n\n${appendBlocks.join('\n')}`.trim();
  }
  patch.metadata = metadata;

  await productService.updateProducts(productId, patch);
}
