import { z } from 'zod';

export const STEP_KEYS = ['contact', 'address', 'delivery', 'billing', 'payment', 'review'] as const;
export type CheckoutStepKey = typeof STEP_KEYS[number];
const text = (max: number) => z.string().trim().max(max).refine(v => !/[<>]/.test(v), 'Usá texto sin HTML.');
export const CheckoutPolicySchema = z.object({
  steps: z.object({
    contact: z.boolean().optional(), address: z.boolean().optional(),
    delivery: z.boolean().optional(), billing: z.boolean().optional(),
    payment: z.boolean().optional(), review: z.boolean().optional(),
  }).strict().optional(),
  recipients: z.object({
    enabled: z.boolean().optional(),
    scope: z.enum(['all', 'selected']).optional(),
    product_ids: z.array(z.string().min(1)).max(1000).optional(),
    title: text(100).pipe(z.string().min(1)).optional(),
    help: text(500).optional(),
    document_type: z.literal('dni').optional(), country: z.literal('AR').optional(),
    retention_days: z.number().int().min(1).max(90).optional(),
  }).strict().optional(),
}).strict();
export type CheckoutPolicyInput = z.infer<typeof CheckoutPolicySchema>;
export function resolveCheckoutPolicy(input?: CheckoutPolicyInput) {
  return {
    steps: { contact: true, address: true, delivery: true, billing: true, payment: true, review: true, ...input?.steps },
    recipients: {
      enabled: false, scope: 'all' as 'all' | 'selected',
      title: 'Destinatarios de productos', help: 'Indicá quién recibirá cada unidad de tu compra.',
      document_type: 'dni' as const, country: 'AR' as const, retention_days: 7,
      ...input?.recipients,
      product_ids: [...(input?.recipients?.product_ids ?? [])],
    },
  };
}
export type CheckoutPolicy = ReturnType<typeof resolveCheckoutPolicy>;
export function mergeCheckoutPolicy(current: CheckoutPolicyInput = {}, patch: CheckoutPolicyInput = {}) {
  return resolveCheckoutPolicy({ steps: { ...current.steps, ...patch.steps }, recipients: { ...current.recipients, ...patch.recipients } });
}
export function requiresRecipient(policy: CheckoutPolicy, item: { product_id?: string | null }) {
  return policy.recipients.enabled && (policy.recipients.scope === 'all' || policy.recipients.product_ids.includes(item.product_id ?? ''));
}
