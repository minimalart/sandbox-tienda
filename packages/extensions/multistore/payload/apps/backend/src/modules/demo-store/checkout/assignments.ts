import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { requiresRecipient, type CheckoutPolicy } from './policy';

export const PersonSchema = z.object({
  id: z.string().uuid(),
  // Opcional: '' (o solo separadores) vale como "sin documento" y se normaliza a
  // undefined, asi ni el chequeo de duplicados ni el enmascarado ven un string vacio.
  document: z.string().transform(v => v.replace(/[.\s-]/g, '')).refine(v => v === '' || /^\d{7,8}$/.test(v), 'Ingresá un DNI de 7 u 8 dígitos.').transform(v => v || undefined).optional(),
  first_name: z.string().trim().min(1).max(100), last_name: z.string().trim().min(1).max(100),
  grade: z.string().trim().max(50).optional(),
}).strict();
export type Person = z.infer<typeof PersonSchema>;
export type Unit = { id: string; line_id: string; line_key: string; variant_id: string | null; person_id: string | null };
export type Line = { id: string; product_id?: string | null; variant_id?: string | null; quantity: number; metadata?: Record<string, any> | null };
export class CheckoutError extends Error {
  constructor(public code: string, message: string, public block = 'recipients', public units: string[] = []) { super(message); }
}
export function validatePeople(people: Person[]) {
  const ids = new Set<string>();
  const documents = new Map<string, string>();
  for (const p of people) {
    if (ids.has(p.id)) throw new CheckoutError('RECIPIENT_DUPLICATE', 'Hay una persona repetida.');
    ids.add(p.id);
    if (!p.document) continue;
    const name = `${p.first_name} ${p.last_name}`.normalize('NFKC').toLocaleLowerCase('es');
    if (documents.has(p.document)) throw new CheckoutError('RECIPIENT_DUPLICATE', documents.get(p.document) === name ? 'Reutilizá la persona ya cargada para ese documento.' : 'El mismo documento tiene nombres distintos. Corregí o reutilizá la persona.');
    documents.set(p.document, name);
  }
}
/** Stable unit IDs survive reorder; reductions with different people require an explicit selection. */
export function reconcileUnits(previous: Unit[], lines: Line[], policy: CheckoutPolicy, globalPerson: string | null, keep?: string[]) {
  const units: Unit[] = [];
  const conflicts: string[] = [];
  for (const line of lines.filter(i => requiresRecipient(policy, i))) {
    const key = String(line.metadata?.checkout_line_key ?? line.id);
    const candidates = previous.filter(u => (u.line_id === line.id || u.line_key === key || (!lines.some(l => l.id === u.line_id) && lines.filter(l => l.variant_id === u.variant_id).length === 1)) && u.variant_id === (line.variant_id ?? null));
    let existing = candidates;
    if (candidates.length > Number(line.quantity)) {
      if (keep) existing = candidates.filter(u => keep.includes(u.id));
      else if (new Set(candidates.map(u => u.person_id)).size > 1) { conflicts.push(line.id); continue; }
      else existing = candidates.slice(0, Number(line.quantity));
      if (existing.length !== Number(line.quantity)) throw new CheckoutError('RECIPIENT_SELECTION_REQUIRED', 'Elegí qué unidades conservar.', 'recipients', candidates.map(u => u.id));
    }
    units.push(...existing.map(u => ({ ...u, line_id: line.id, line_key: key })));
    for (let n = existing.length; n < Number(line.quantity); n++) units.push({ id: randomUUID(), line_id: line.id, line_key: key, variant_id: line.variant_id ?? null, person_id: globalPerson });
  }
  return { units, conflicts };
}
export function assertCoverage(units: Unit[], people: Person[], lines: Line[], policy: CheckoutPolicy) {
  validatePeople(people);
  const ids = new Set(people.map(p => p.id));
  const unitIds = new Set(units.map(u => u.id));
  if (unitIds.size !== units.length) throw new CheckoutError('RECIPIENTS_INCOMPLETE', 'Hay asignaciones duplicadas.');
  const required = lines.filter(i => requiresRecipient(policy, i));
  const lineIds = new Set(required.map(l => l.id));
  if (units.some(u => !lineIds.has(u.line_id))) throw new CheckoutError('RECIPIENTS_INCOMPLETE', 'Hay unidades que ya no pertenecen al carrito.');
  for (const line of required) {
    const assigned = units.filter(u => u.line_id === line.id);
    if (assigned.length !== Number(line.quantity) || assigned.some(u => !u.person_id || !ids.has(u.person_id) || u.variant_id !== (line.variant_id ?? null) || u.line_key !== String(line.metadata?.checkout_line_key ?? line.id)))
      throw new CheckoutError('RECIPIENTS_INCOMPLETE', 'Completá los destinatarios de todas las unidades.', 'recipients', assigned.filter(u => !u.person_id || !ids.has(u.person_id)).map(u => u.id));
  }
}
export function cartFingerprintComponents(cart: any) {
  const address = (a: any) => a ? ['first_name', 'last_name', 'address_1', 'address_2', 'city', 'province', 'postal_code', 'country_code', 'phone', 'company'].map(k => a[k] ?? null) : null;
  return {
    customer: cart.customer_id ?? cart.customer?.id ?? null, channel: cart.sales_channel_id, region: cart.region_id ?? cart.region?.id ?? null, email: cart.email,
    // `total` intentionally excluded: q.graph vs completeCartWorkflow-refreshed cart diverge (undefined vs computed) and cause false CHECKOUT_REVISION_CONFLICT at finalize. Price safety is enforced by assertPaymentMatchesCart (compares cart.total vs payment session/collection amounts) and by items[unit_price] + shipping_methods[amount] already in the fingerprint.
    currency: cart.currency_code,
    shipping: address(cart.shipping_address), billing: address(cart.billing_address),
    methods: cart.shipping_methods?.map((m: any) => [m.shipping_option_id, Number(m.amount), m.data?.branch_id ?? null]).sort((a: any, b: any) => String(a[0]).localeCompare(String(b[0]))),
    items: [...(cart.items ?? [])].sort((a, b) => a.id.localeCompare(b.id)).map((i: any) => [i.id, i.variant_id, Number(i.quantity), Number(i.unit_price), i.metadata?.checkout_line_key]),
    billing_snapshot: cart.metadata?.billing_snapshot,
  };
}
export function cartFingerprint(cart: any) {
  return createHash('sha256').update(JSON.stringify(cartFingerprintComponents(cart))).digest('hex');
}
export function maskedPeople(people: Person[]) { return people.map(p => ({ ...p, document: p.document ? `••••${p.document.slice(-3)}` : undefined })); }
/** Mapping is by an opaque line key copied by Medusa, never by array position or SKU. */
export function mapOrderUnits(units: Unit[], orderItems: any[]) {
  return units.map(unit => {
    const matches = orderItems.filter(i => i.metadata?.checkout_line_key === unit.line_key);
    if (matches.length !== 1) throw new CheckoutError('ORDER_RECIPIENT_MAPPING_INVALID', 'No se pudo vincular una unidad al pedido.');
    return { ...unit, order_line_id: matches[0].id };
  });
}
