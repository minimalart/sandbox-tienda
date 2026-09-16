import { z } from 'zod';

export const STEP_KEYS = ['contact', 'address', 'delivery', 'billing', 'benefits', 'payment', 'review'] as const;
export type CheckoutStepKey = typeof STEP_KEYS[number];
export const SECTION_KEYS = ['contact', 'address', 'delivery', 'billing', 'benefits', 'payment', 'review', 'recipients'] as const;
export type CheckoutSectionKey = typeof SECTION_KEYS[number];
// `.min(1)` después del trim: un título en blanco no es "sin título" —la UI
// BORRA la clave cuando el campo queda vacío (`checkout-config.tsx`), nunca
// manda `''`—, así que un blanco sólo puede venir por API y dejaría la sección
// con un encabezado vacío en el checkout. Es la validación que este helper
// perdió al mover el copy desde `recipients`.
const text = (max: number) =>
  z.string().trim().min(1).max(max).refine(v => !/[<>]/.test(v), 'Usá texto sin HTML.');
const sectionCopy = z.object({
  title: text(100).optional(),
  subtitle: text(500).optional(),
}).strict().optional();
const optionalText = (max: number) => z.string().trim().max(max).optional();
// Default shipping address = INSTITUTIONAL address (school, warehouse, etc). Contact fields
// (first_name, last_name, phone) are intentionally excluded: they must come from the actual
// customer filling the checkout, not from an admin-configured default that would overwrite
// their real name. applyDefaultAddress in runtime.ts fills those from the cart's customer.
// Sin strict: DB puede contener first_name/last_name/phone legacy que Zod ahora strippea al leer,
// evitando romper readPolicy en tiendas ya configuradas antes del fix del customer name.
export const DefaultShippingAddressSchema = z.object({
  company: optionalText(200),
  address_1: z.string().trim().min(1).max(200),
  address_2: optionalText(200),
  city: z.string().trim().min(1).max(100),
  postal_code: optionalText(20),
  country_code: z.string().trim().toLowerCase().length(2),
  province: optionalText(100),
});
export type DefaultShippingAddress = z.infer<typeof DefaultShippingAddressSchema>;
export const CheckoutPolicySchema = z.object({
  steps: z.object({
    contact: z.boolean().optional(), address: z.boolean().optional(),
    delivery: z.boolean().optional(), billing: z.boolean().optional(),
    benefits: z.boolean().optional(),
    payment: z.boolean().optional(), review: z.boolean().optional(),
  }).strict().optional(),
  sections: z.object({
    contact: sectionCopy, address: sectionCopy, delivery: sectionCopy,
    billing: sectionCopy, benefits: sectionCopy, payment: sectionCopy,
    review: sectionCopy, recipients: sectionCopy,
  }).strict().optional(),
  defaults: z.object({
    shipping_address: DefaultShippingAddressSchema.optional(),
    shipping_option_id: z.string().trim().min(1).max(200).optional(),
  }).strict().optional(),
  // Carrusel "Te quedaste con ganas de agregar algo mas?" arriba del checkout.
  // Prendido por defecto; cada tienda puede apagarlo desde su pestana Checkout.
  suggestions: z.object({ enabled: z.boolean().optional() }).strict().optional(),
  // `title` y `help` vivían acá antes de moverse a `sections.recipients.{title,subtitle}`.
  // Sin strict: Zod los strippea al parsear la data legacy en DB, sin romper readPolicy.
  recipients: z.object({
    enabled: z.boolean().optional(),
    scope: z.enum(['all', 'selected']).optional(),
    product_ids: z.array(z.string().min(1)).max(1000).optional(),
    document_type: z.literal('dni').optional(), country: z.literal('AR').optional(),
    retention_days: z.number().int().min(1).max(90).optional(),
  }).optional(),
}).strict();
export type CheckoutPolicyInput = z.infer<typeof CheckoutPolicySchema>;
export function resolveCheckoutPolicy(input?: CheckoutPolicyInput) {
  return {
    steps: { contact: true, address: true, delivery: true, billing: true, benefits: true, payment: true, review: true, ...input?.steps },
    sections: { ...input?.sections },
    defaults: {
      shipping_address: input?.defaults?.shipping_address,
      shipping_option_id: input?.defaults?.shipping_option_id,
    },
    suggestions: { enabled: true, ...input?.suggestions },
    recipients: {
      enabled: false, scope: 'all' as 'all' | 'selected',
      document_type: 'dni' as const, country: 'AR' as const, retention_days: 7,
      ...input?.recipients,
      product_ids: [...(input?.recipients?.product_ids ?? [])],
    },
  };
}
export type CheckoutPolicy = ReturnType<typeof resolveCheckoutPolicy>;
export function mergeCheckoutPolicy(current: CheckoutPolicyInput = {}, patch: CheckoutPolicyInput = {}) {
  return resolveCheckoutPolicy({
    steps: { ...current.steps, ...patch.steps },
    sections: { ...current.sections, ...patch.sections },
    defaults: { ...current.defaults, ...patch.defaults },
    suggestions: { ...current.suggestions, ...patch.suggestions },
    recipients: { ...current.recipients, ...patch.recipients },
  });
}
export function requiresRecipient(policy: CheckoutPolicy, item: { product_id?: string | null }) {
  return policy.recipients.enabled && (policy.recipients.scope === 'all' || policy.recipients.product_ids.includes(item.product_id ?? ''));
}
