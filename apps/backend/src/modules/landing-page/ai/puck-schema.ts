import { z } from 'zod';

/**
 * Fuente de verdad del schema de `puck_data` para el generador AI, los
 * validators de las APIs y la sanitización previa a guardar.
 *
 * IMPORTANTE: estos componentes y props deben mantenerse EN SYNC con:
 *   - apps/backend/src/admin/lib/puck/config.tsx (editor)
 *   - apps/storefront/src/modules/landing-page/components/landing-renderer.tsx
 *
 * No renombrar componentes existentes sin migración/backward-compat.
 */

export const ALLOWED_PUCK_COMPONENTS = [
  'Hero',
  'RichText',
  'ImageBlock',
  'CTA',
  'FAQ',
  'Testimonials',
  'CollectionGrid',
  'ProductGrid',
  'ProductsList',
  'ImageText',
  'FeatureGrid',
  'Spacer',
] as const;

export type AllowedPuckComponent = (typeof ALLOWED_PUCK_COMPONENTS)[number];

export const EMPTY_PUCK_DATA = { content: [], root: { props: {} } } as const;

const MAX_TEXT = 5000;
const MAX_HREF = 2000;
const MAX_ITEMS = 24;

/**
 * Quita tags HTML (script/iframe/etc.) y caracteres de control, preservando
 * tab y newline (legítimos en textareas). Nunca devuelve null.
 */
const sanitizeString = (value: unknown, maxLen = MAX_TEXT): string => {
  if (typeof value !== 'string') return '';
  const noHtml = value.replace(/<[^>]*>/g, '');
  let out = '';
  for (const ch of noHtml) {
    const code = ch.charCodeAt(0);
    if (code === 9 || code === 10 || code >= 32) out += ch;
  }
  return out.slice(0, maxLen).trim();
};

/** Solo permite http(s) o rutas relativas; bloquea javascript:/data:/vbscript:. */
const sanitizeHref = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  if (/^(javascript|data|vbscript|file):/i.test(v)) return '';
  return v.slice(0, MAX_HREF);
};

/**
 * Color CSS válido y acotado: hex (#rgb…#rrggbbaa), rgb()/rgba(), hsl()/hsla()
 * o un nombre CSS (white, transparent…). Cualquier otra cosa → "" (= auto, usa
 * el color por defecto del tema). Evita meter expresiones raras en el style.
 */
const sanitizeColor = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v) return '';
  const ok =
    /^#[0-9a-fA-F]{3,8}$/.test(v) ||
    /^rgba?\(\s*[\d.,%\s/]+\)$/i.test(v) ||
    /^hsla?\(\s*[\d.,%\s/]+\)$/i.test(v) ||
    /^[a-zA-Z]{3,20}$/.test(v);
  return ok ? v.slice(0, 64) : '';
};

// Helpers zod: strings opcionales sanitizadas (nunca fallan).
const text = () =>
  z.preprocess((v) => sanitizeString(v), z.string().default(''));
const link = () =>
  z.preprocess((v) => sanitizeHref(v), z.string().default(''));
const color = () =>
  z.preprocess((v) => sanitizeColor(v), z.string().default(''));

// --- Props por componente (todas opcionales/sanitizadas) ---------------------

// Props de color comunes a la mayoría de los bloques. `background`/`textColor`
// vacíos = usar el color por defecto del tema. `accentColor` aplica al botón.
const bgFg = { background: color(), textColor: color() };

const HeroProps = z
  .object({
    title: text(),
    eyebrow: text(),
    layout: z.enum(['overlay', 'split']).catch('overlay'),
    subtitle: text(),
    image: link(),
    imagePrompt: text(),
    ctaLabel: text(),
    ctaHref: link(),
    ...bgFg,
    accentColor: color(),
  })
  .strip();

const RichTextProps = z
  .object({ heading: text(), text: text(), ...bgFg })
  .strip();

const ImageBlockProps = z
  .object({ src: link(), alt: text(), caption: text(), imagePrompt: text(), ...bgFg })
  .strip();

const ImageTextProps = z.object({
  heading: text(), text: text(), eyebrow: text(), image: link(), alt: text(), imagePrompt: text(),
  imagePosition: z.enum(['left', 'right']).catch('left'),
  ctaLabel: text(), ctaHref: link(), ...bgFg, accentColor: color(),
}).strip();

const FeatureGridProps = z.object({
  heading: text(), description: text(),
  items: z.array(z.object({ title: text(), text: text() }).strip()).max(6).default([]),
  ...bgFg,
}).strip();

const CTAProps = z
  .object({
    title: text(),
    description: text(),
    buttonLabel: text(),
    buttonHref: link(),
    ...bgFg,
    accentColor: color(),
  })
  .strip();

const FAQProps = z
  .object({
    heading: text(),
    items: z
      .array(z.object({ q: text(), a: text() }).strip())
      .max(MAX_ITEMS)
      .default([]),
    ...bgFg,
  })
  .strip();

const TestimonialsProps = z
  .object({
    heading: text(),
    items: z
      .array(z.object({ quote: text(), author: text() }).strip())
      .max(MAX_ITEMS)
      .default([]),
    ...bgFg,
  })
  .strip();

const CollectionGridProps = z
  .object({
    heading: text(),
    items: z
      .array(z.object({ label: text(), handle: text(), href: link() }).strip())
      .max(MAX_ITEMS)
      .default([]),
    ...bgFg,
  })
  .strip();

const ProductGridProps = z
  .object({ heading: text(), href: link(), ctaLabel: text(), ...bgFg })
  .strip();

const PRODUCTS_SOURCES = [
  'category',
  'collection',
  'tag',
  'promotions',
  'newest',
  'query',
] as const;
const PRODUCTS_SORTS = [
  '',
  'created_at',
  'price_asc',
  'price_desc',
  'relevance',
] as const;

const ProductsListProps = z
  .object({
    heading: text(),
    source: z.preprocess(
      (v) =>
        (PRODUCTS_SOURCES as readonly string[]).includes(v as string)
          ? v
          : 'newest',
      z.enum(PRODUCTS_SOURCES).default('newest'),
    ),
    value: text(),
    limit: z.preprocess((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), 24) : 8;
    }, z.number().default(8)),
    sortBy: z.preprocess(
      (v) =>
        (PRODUCTS_SORTS as readonly string[]).includes(v as string) ? v : '',
      z.enum(PRODUCTS_SORTS).default(''),
    ),
    ctaLabel: text(),
    href: link(),
    ...bgFg,
  })
  .strip();

const SpacerProps = z
  .object({
    size: z.preprocess((v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 0), 400) : 32;
    }, z.number().default(32)),
    background: color(),
  })
  .strip();

/** Schema de props por componente (para sanitizar/normalizar). */
export const COMPONENT_PROP_SCHEMAS: Record<AllowedPuckComponent, z.ZodTypeAny> = {
  Hero: HeroProps,
  RichText: RichTextProps,
  ImageBlock: ImageBlockProps,
  CTA: CTAProps,
  FAQ: FAQProps,
  Testimonials: TestimonialsProps,
  CollectionGrid: CollectionGridProps,
  ProductGrid: ProductGridProps,
  ProductsList: ProductsListProps,
  ImageText: ImageTextProps,
  FeatureGrid: FeatureGridProps,
  Spacer: SpacerProps,
};

/** Un bloque Puck válido (discriminado por `type`). */
export const PuckBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Hero'), props: HeroProps }),
  z.object({ type: z.literal('RichText'), props: RichTextProps }),
  z.object({ type: z.literal('ImageBlock'), props: ImageBlockProps }),
  z.object({ type: z.literal('CTA'), props: CTAProps }),
  z.object({ type: z.literal('FAQ'), props: FAQProps }),
  z.object({ type: z.literal('Testimonials'), props: TestimonialsProps }),
  z.object({ type: z.literal('CollectionGrid'), props: CollectionGridProps }),
  z.object({ type: z.literal('ProductGrid'), props: ProductGridProps }),
  z.object({ type: z.literal('ProductsList'), props: ProductsListProps }),
  z.object({ type: z.literal('ImageText'), props: ImageTextProps }),
  z.object({ type: z.literal('FeatureGrid'), props: FeatureGridProps }),
  z.object({ type: z.literal('Spacer'), props: SpacerProps }),
]);

/** Estructura completa de `puck_data`. */
export const PuckDataSchema = z.object({
  content: z.array(PuckBlockSchema).default([]),
  root: z
    .object({ props: z.record(z.string(), z.unknown()).default({}) })
    .default({ props: {} }),
  zones: z.record(z.string(), z.array(PuckBlockSchema)).optional(),
});

export type PuckBlock = z.infer<typeof PuckBlockSchema>;
export type PuckData = z.infer<typeof PuckDataSchema>;

const isAllowed = (type: unknown): type is AllowedPuckComponent =>
  typeof type === 'string' &&
  (ALLOWED_PUCK_COMPONENTS as readonly string[]).includes(type);

/**
 * Sanea un bloque arbitrario: descarta componentes desconocidos y props
 * peligrosas (onClick/script/iframe/etc., que no están en el schema → .strip),
 * y normaliza strings. Devuelve null si el bloque no es recuperable.
 */
const makeId = (): string => {
  try {
    return globalThis.crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.random().toString(36).slice(2, 10);
  }
};

const sanitizeBlock = (raw: unknown): PuckBlock | null => {
  if (!raw || typeof raw !== 'object') return null;
  const type = (raw as { type?: unknown }).type;
  if (!isAllowed(type)) return null;
  const schema = COMPONENT_PROP_SCHEMAS[type];
  const rawProps = (raw as { props?: unknown }).props;
  const props = (
    rawProps && typeof rawProps === 'object' ? rawProps : {}
  ) as Record<string, unknown>;
  const parsed = schema.safeParse(props);
  const clean = (parsed.success ? parsed.data : schema.parse({})) as Record<
    string,
    unknown
  >;
  // Preservar el `id` que Puck usa para tracking (o generar uno estable si
  // falta, p. ej. en contenido generado por AI) para no romper el editor al
  // recargar. El renderer del storefront ignora este campo.
  const rawId = props.id;
  clean.id =
    typeof rawId === 'string' && rawId ? rawId.slice(0, 200) : `${type}-${makeId()}`;
  return { type, props: clean } as PuckBlock;
};

/**
 * Punto de entrada para limpiar cualquier `puck_data` (venga del editor humano
 * o del generador AI). NUNCA lanza: devuelve siempre una estructura válida y
 * segura, descartando lo que no se reconoce. Mantiene `root.props` aunque esté
 * vacío y valida `zones` con el mismo criterio.
 */
export function sanitizePuckData(input: unknown): PuckData {
  if (!input || typeof input !== 'object') {
    return { content: [], root: { props: {} } };
  }
  const obj = input as Record<string, unknown>;

  const content = Array.isArray(obj.content)
    ? obj.content.map(sanitizeBlock).filter((b): b is PuckBlock => b !== null)
    : [];

  const rootProps =
    obj.root && typeof obj.root === 'object'
      ? ((obj.root as { props?: unknown }).props as Record<string, unknown>) ?? {}
      : {};

  const result: PuckData = {
    content,
    root: { props: rootProps && typeof rootProps === 'object' ? rootProps : {} },
  };

  if (obj.zones && typeof obj.zones === 'object' && !Array.isArray(obj.zones)) {
    const zones: Record<string, PuckBlock[]> = {};
    for (const [key, value] of Object.entries(
      obj.zones as Record<string, unknown>,
    )) {
      if (Array.isArray(value)) {
        zones[key] = value
          .map(sanitizeBlock)
          .filter((b): b is PuckBlock => b !== null);
      }
    }
    result.zones = zones;
  }

  return result;
}
