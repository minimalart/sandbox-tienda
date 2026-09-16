import { assertPaymentMatchesCart } from './payment';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { listShippingOptionsForCartWithPricingWorkflow, addShippingMethodToCartWorkflow } from '@medusajs/core-flows';
import { CheckoutPolicySchema, mergeCheckoutPolicy, resolveCheckoutPolicy, type CheckoutPolicy } from './policy';
import { assertCoverage, cartFingerprint, cartFingerprintComponents, CheckoutError, reconcileUnits, type Person } from './assignments';

export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const policyVersion = (policy: CheckoutPolicy) => digest(JSON.stringify(policy));
/**
 * Log de diagnostico del fingerprint (#1046). Resolver el logger NUNCA puede
 * tirar abajo un checkout: un container sin `logger` registrado (el fixture de
 * `runtime.integration.test.ts`, un script suelto) lo convierte en no-op.
 */
function debugLog(scope: any, message: string) {
  try { scope.resolve(ContainerRegistrationKeys.LOGGER)?.info?.(message); } catch { /* sin logger: silencio */ }
}
const db = (scope: any): any => scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
// Fields para query.graph con sintaxis dot-star: en Medusa v2 es la única forma
// de traer relations cross-module (Cart → Product → ShippingProfile del ProductModule).
// `retrieveCart` del CartModule no expande relations que atraviesan otros módulos.
// El patrón viejo `*items` traía items vacíos; hay que usar `items.*` y expandir cada nested.
export const SESSION_FIELDS = ['*', 'items.*', 'items.variant.*', 'items.variant.product.*', 'items.variant.product.shipping_profile.*', 'shipping_address.*', 'billing_address.*', 'shipping_methods.*', 'payment_collection.*', 'payment_collection.payment_sessions.*'];
export async function checkoutCart(scope: any, id: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'cart', fields: SESSION_FIELDS, filters: { id } });
  if (!data[0]) throw new CheckoutError('CART_NOT_FOUND', 'Carrito no encontrado.', 'contact');
  await resolvePickup(scope, data[0]);
  const site = await cartSite(scope, data[0]);
  if (site?.content_config?.checkout) await shippingEligibility(scope, data[0]);
  return data[0];
}
async function shippingEligibility(scope: any, cart: any) {
  if (!(cart.items ?? []).some((i: any) => i.requires_shipping !== false)) return;
  const { result: options } = await listShippingOptionsForCartWithPricingWorkflow(scope).run({ input: { cart_id: cart.id } });
  evaluateShippingEligibility(cart, options);
}
/** Pure evaluation of live options; the workflow remains responsible for fetching availability. */
export function evaluateShippingEligibility(cart: any, options: any[]) {
  const eligible = options.filter((o: any) => !o.insufficient_inventory);
  cart.checkout_pickup_only = eligible.length > 0 && eligible.every((o: any) => o.data?.pickup_kind === 'store');
  const selected = cart.shipping_methods ?? [];
  const profiles = new Set(cart.items.filter((i: any) => i.requires_shipping !== false).map((i: any) => i.variant?.product?.shipping_profile_id ?? i.variant?.product?.shipping_profile?.id));
  const selectedOptions = selected.map((m: any) => eligible.find((o: any) => o.id === m.shipping_option_id && Number(o.amount) === Number(m.amount)));
  cart.checkout_shipping_valid = selected.length > 0 && selectedOptions.every(Boolean) && [...profiles].every(p => selectedOptions.some((o: any) => o?.shipping_profile_id === p)) && (!selectedOptions.some((o: any) => o?.data?.pickup_kind === 'store') || cart.checkout_pickup === true);
}
async function storePickupLocations(scope: any, channel: string) {
  let service: any;
  try { service = scope.resolve('storeLocation'); } catch { return []; }
  return (await service.listStoreLocations({ active: true, is_visible: true })).filter((l: any) => Array.isArray(l.sales_channel_ids) && l.sales_channel_ids.includes(channel));
}
async function resolvePickup(scope: any, cart: any) {
  cart.checkout_pickup = false;
  if (!cart.shipping_methods?.length) return;
  const { data: options } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'shipping_option', fields: ['id', 'data'], filters: { id: cart.shipping_methods.map((m: any) => m.shipping_option_id) } });
  if (options.length !== cart.shipping_methods.length || !options.every((o: any) => o.data?.pickup_kind === 'store')) return;
  const locations = await storePickupLocations(scope, cart.sales_channel_id);
  cart.checkout_pickup = cart.shipping_methods.every((m: any) => locations.some((l: any) => l.id === m.data?.branch_id));
}
async function applyDefaultAddress(scope: any, cart: any, policy: CheckoutPolicy) {
  if (policy.steps.address !== false || !policy.defaults.shipping_address) return false;
  if (cart.shipping_address?.address_1) return false;
  const person: Record<string, string | null> = { first_name: null, last_name: null, phone: null };
  if (cart.customer_id) {
    const customer = await scope.resolve(Modules.CUSTOMER).retrieveCustomer(cart.customer_id).catch(() => null);
    if (customer?.first_name) person.first_name = customer.first_name;
    if (customer?.last_name) person.last_name = customer.last_name;
    if (customer?.phone) person.phone = customer.phone;
  }
  await scope.resolve(Modules.CART).updateCarts(cart.id, { shipping_address: { ...policy.defaults.shipping_address, ...person } });
  return true;
}
async function simplifyDelivery(scope: any, cart: any, policy: CheckoutPolicy) {
  if (policy.steps.delivery || cart.shipping_methods?.length || !(cart.items ?? []).some((i: any) => i.requires_shipping !== false)) return false;
  const { result: options } = await listShippingOptionsForCartWithPricingWorkflow(scope).run({ input: { cart_id: cart.id } });
  const profiles = new Set(cart.items.filter((i: any) => i.requires_shipping !== false).map((i: any) => i.variant?.product?.shipping_profile_id ?? i.variant?.product?.shipping_profile?.id));
  const eligible = options.filter((o: any) => !o.insufficient_inventory && Number.isFinite(Number(o.amount)));
  const defaultId = policy.defaults.shipping_option_id;
  const option = defaultId ? eligible.find((o: any) => o.id === defaultId) : (eligible.length === 1 ? eligible[0] : null);
  if (!option) return false;
  if (profiles.size !== 1 || !profiles.has(option.shipping_profile_id)) return false;
  let data: Record<string, unknown> = {};
  if (option.data?.pickup_kind === 'store') {
    const locations = await storePickupLocations(scope, cart.sales_channel_id);
    if (locations.length !== 1) return false;
    data = { pickup_kind: 'store', branch_id: locations[0].id, branch_name: locations[0].name, branch_address: locations[0].street };
  } else if (!cart.shipping_address?.address_1 || option.price_type !== 'flat' || option.provider_id !== 'manual_manual') return false;
  await addShippingMethodToCartWorkflow(scope).run({ input: { cart_id: cart.id, options: [{ id: option.id, data }] } });
  return true;
}
export async function cartSite(scope: any, cart: any) {
  let service: any;
  try { service = scope.resolve('demo_store'); } catch { return null; }
  const bound = await db(scope)('site_checkout_cart_context').where({ cart_id: cart.id }).first();
  if (bound) {
    const site = await service.retrieveDemoStore(bound.site_id);
    const channel = bound.mode === 'b2b' ? site.b2b_sales_channel_id : site.sales_channel_id;
    if (channel !== cart.sales_channel_id) throw new CheckoutError('CHECKOUT_CONTEXT_CHANGED', 'El carrito ya no pertenece al contexto de esta tienda.', 'contact');
    return site;
  }
  const sites = await service.listDemoStores({ $or: [{ sales_channel_id: cart.sales_channel_id }, { b2b_sales_channel_id: cart.sales_channel_id }] });
  if (!sites.length) return null;
  // Shared/adopted channels cannot identify a site securely. Require unique context.
  if (sites.length !== 1) {
    if (sites.every((s: any) => !s.content_config?.checkout)) return null;
    throw new CheckoutError('CHECKOUT_SITE_AMBIGUOUS', 'Abrí el checkout desde la tienda para verificar el contexto de compra.', 'contact');
  }
  return sites[0];
}
/** Called only by an authenticated server-side admin client, never by Store input. */
export async function bindCartContext(scope: any, cartId: string, slug: string | null, mode: 'b2c' | 'b2b', token: string) {
  const pg = db(scope);
  const site = await pg('demo_store').where(slug ? { slug } : { is_main: true }).whereNull('deleted_at').first();
  if (!site) { if (slug) throw new CheckoutError('SITE_NOT_FOUND', 'Tienda no encontrada.', 'contact'); return; }
  const cart = await scope.resolve(Modules.CART).retrieveCart(cartId);
  if ((mode === 'b2b' ? site.b2b_sales_channel_id : site.sales_channel_id) !== cart.sales_channel_id) throw new CheckoutError('CHECKOUT_CONTEXT_CHANGED', 'El carrito no pertenece a esta tienda.', 'contact');
  if (!site.content_config?.checkout && !await pg('site_checkout_cart_context').where({ cart_id: cartId }).first()) return;
  const value = { cart_id: cartId, site_id: site.id, mode, access_hash: digest(token) };
  await pg('site_checkout_cart_context').insert(value).onConflict('cart_id').ignore();
  const existing = await pg('site_checkout_cart_context').where({ cart_id: cartId }).first();
  if (existing.site_id !== site.id || existing.mode !== mode || existing.access_hash !== value.access_hash) throw new CheckoutError('CHECKOUT_CONTEXT_CHANGED', 'El carrito ya está vinculado a otra sesión de compra.', 'contact');
}
export async function readPolicy(scope: any, siteId: string) {
  const site = await scope.resolve('demo_store').retrieveDemoStore(siteId);
  const policy = resolveCheckoutPolicy(CheckoutPolicySchema.parse(site.content_config?.checkout ?? {}));
  return { policy, version: policyVersion(policy), configured: !!site.content_config?.checkout };
}
export async function writePolicy(scope: any, siteId: string, patch: unknown, expectedVersion: string) {
  const parsed = CheckoutPolicySchema.parse(patch);
  return db(scope).transaction(async (trx: any) => {
    const site = await trx('demo_store').where({ id: siteId }).whereNull('deleted_at').forUpdate().first();
    if (!site) throw new CheckoutError('SITE_NOT_FOUND', 'Tienda no encontrada.', 'configuration');
    // Parse alineado con readPolicy: sin esto los campos legacy strippeados por Zod (recipients.title/help pre-PR#1011) alteran el hash y CHECKOUT_REVISION_CONFLICT se dispara sin cambios reales.
    const current = resolveCheckoutPolicy(CheckoutPolicySchema.parse(site.content_config?.checkout ?? {}));
    if (policyVersion(current) !== expectedVersion) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'La configuración cambió. Volvé a cargarla antes de guardar.', 'configuration');
    const policy = mergeCheckoutPolicy(current, parsed);
    if (policy.steps.address === false && !policy.defaults.shipping_address) throw new CheckoutError('CHECKOUT_DEFAULT_ADDRESS_REQUIRED', 'Cargá una dirección por defecto para poder ocultar el paso de dirección.', 'configuration');
    if (policy.steps.delivery === false && !policy.defaults.shipping_option_id) throw new CheckoutError('CHECKOUT_DEFAULT_SHIPPING_REQUIRED', 'Elegí un método de envío por defecto para poder ocultar el paso de entrega.', 'configuration');
    if (policy.defaults.shipping_option_id) {
      const channels = [site.sales_channel_id, site.b2b_sales_channel_id].filter(Boolean);
      const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'shipping_option', fields: ['id', 'service_zone.fulfillment_set.location.sales_channels.id'], filters: { id: policy.defaults.shipping_option_id } });
      const opt = data[0];
      if (!opt) throw new CheckoutError('CHECKOUT_DEFAULT_SHIPPING_INVALID', 'El método de envío por defecto no existe.', 'configuration');
      const optChannels: string[] = opt.service_zone?.fulfillment_set?.location?.sales_channels?.map((c: any) => c.id) ?? [];
      if (!optChannels.some((c) => channels.includes(c))) throw new CheckoutError('CHECKOUT_DEFAULT_SHIPPING_INVALID', 'El método de envío por defecto no pertenece a esta tienda.', 'configuration');
    }
    if (policy.recipients.enabled && policy.recipients.scope === 'selected' && !policy.recipients.product_ids.length) throw new CheckoutError('CHECKOUT_PRODUCTS_REQUIRED', 'Seleccioná al menos un producto.', 'configuration');
    if (policy.recipients.product_ids.length) {
      const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'product', fields: ['id', 'sales_channels.id'], filters: { id: policy.recipients.product_ids } });
      const channels = [site.sales_channel_id, site.b2b_sales_channel_id].filter(Boolean);
      if (data.length !== new Set(policy.recipients.product_ids).size || data.some((p: any) => !p.sales_channels?.some((c: any) => channels.includes(c.id)))) throw new CheckoutError('CHECKOUT_PRODUCTS_INVALID', 'Hay productos que no pertenecen a esta tienda.', 'configuration');
    }
    if (policy.recipients.enabled) {
      const channels = [site.sales_channel_id, site.b2b_sales_channel_id].filter(Boolean);
      if (!channels.length) throw new CheckoutError('CHECKOUT_CHANNEL_REQUIRED', 'Asigná un canal de ventas a la tienda.', 'configuration');
    }
    await trx('demo_store').where({ id: siteId }).update({ content_config: JSON.stringify({ ...site.content_config, checkout: policy }), updated_at: new Date() });
    return { policy, version: policyVersion(policy), configured: true };
  });
}
export async function assertCartAccess(req: any, cart: any, session?: any) {
  const channels = req.publishable_key_context?.sales_channel_ids ?? [];
  if (!channels.includes(cart.sales_channel_id)) throw new CheckoutError('CART_NOT_FOUND', 'Carrito no encontrado.', 'contact');
  const actor = req.auth_context?.actor_id;
  if (cart.customer_id) {
    const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(cart.customer_id);
    if (customer.has_account && actor !== cart.customer_id) throw new CheckoutError('CART_NOT_FOUND', 'Carrito no encontrado.', 'contact');
  }
  const token = req.headers['x-checkout-access'];
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) throw new CheckoutError('CHECKOUT_ACCESS_REQUIRED', 'Volvé a abrir el checkout desde tu carrito.', 'contact');
  if (session && !timingSafeEqual(Buffer.from(session.access_hash), Buffer.from(digest(token)))) throw new CheckoutError('CHECKOUT_ACCESS_REQUIRED', 'Volvé a abrir el checkout desde tu carrito.', 'contact');
  const binding = await db(req.scope)('site_checkout_cart_context').where({ cart_id: cart.id }).first();
  if (binding && binding.access_hash !== digest(token)) throw new CheckoutError('CHECKOUT_ACCESS_REQUIRED', 'Volvé a abrir el checkout desde tu carrito.', 'contact');
}
export async function sessionFor(scope: any, cartId: string) { return db(scope)('site_checkout_session').where({ cart_id: cartId }).first(); }
export async function beginCartMutation(scope: any, cartId: string) {
  if (!await sessionFor(scope, cartId)) return null;
  const token = randomUUID();
  const count = await db(scope)('site_checkout_session').where({ cart_id: cartId, finalizing: false }).where((q: any) => q.whereNull('mutation_until').orWhere('mutation_until', '<', new Date())).update({ mutation_token: token, mutation_until: new Date(Date.now() + 120000) });
  if (count !== 1) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Hay otra operación en curso. Esperá su resultado y volvé a intentar.', 'review');
  return token;
}
export async function endCartMutation(scope: any, cartId: string, token: string | null) {
  if (token) await db(scope)('site_checkout_session').where({ cart_id: cartId, mutation_token: token }).update({ mutation_token: null, mutation_until: null });
}
export async function invalidateCheckoutPayment(scope: any, cart: any) {
  const session = await sessionFor(scope, cart.id);
  if (!session) return;
  if (session.finalizing || cart.completed_at) throw new CheckoutError('CHECKOUT_PAYMENT_IN_PROGRESS', 'La compra se está confirmando. Esperá el resultado del pago antes de editar.', 'payment');
  const sessions = cart.payment_collection?.payment_sessions ?? [];
  if (sessions.some((s: any) => ['authorized', 'captured', 'pending_authorization'].includes(s.status))) throw new CheckoutError('CHECKOUT_PAYMENT_IN_PROGRESS', 'Hay un pago en proceso. Esperá su resultado antes de editar.', 'payment');
  for (const s of sessions.filter((s: any) => ['pending', 'requires_more'].includes(s.status))) {
    // Provider cancellation must succeed before changing a cart with an external payment URL.
    await scope.resolve(Modules.PAYMENT).deletePaymentSession(s.id);
  }
  const count = await db(scope)('site_checkout_session').where({ cart_id: cart.id, finalizing: false }).update({ snapshot_id: null });
  if (count !== 1) throw new CheckoutError('CHECKOUT_PAYMENT_IN_PROGRESS', 'La compra se está confirmando.', 'payment');
}
export async function beginCheckout(req: any, cart: any) {
  const site = await cartSite(req.scope, cart);
  if (!site?.content_config?.checkout) return { configured: false };
  if (!await db(req.scope)('site_checkout_cart_context').where({ cart_id: cart.id }).first()) throw new CheckoutError('CHECKOUT_CONTEXT_REQUIRED', 'Abrí el checkout desde la tienda para verificar el contexto de compra.', 'contact');
  await assertCartAccess(req, cart, await sessionFor(req.scope, cart.id));
  if (cart.completed_at) throw new CheckoutError('CHECKOUT_COMPLETED', 'El pedido ya fue confirmado.', 'review');
  const pinned = await sessionFor(req.scope, cart.id);
  if (pinned?.finalizing) {
    if (pinned.fingerprint !== cartFingerprint(cart)) throw new CheckoutError('CHECKOUT_PAYMENT_IN_PROGRESS', 'Esperá el resultado del pago antes de editar la compra.', 'payment');
    return sessionView(pinned, cart);
  }
  if (pinned?.mutation_until && new Date(pinned.mutation_until).getTime() > Date.now()) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Hay una actualización del carrito en curso. Volvé a intentar.', 'review');
  if (pinned && new Date(pinned.expires_at).getTime() < Date.now()) await invalidateCheckoutPayment(req.scope, cart);
  const resolvedPolicy = pinned?.policy ?? resolveCheckoutPolicy(site.content_config.checkout);
  let deliveryChanged = false;
  if (await applyDefaultAddress(req.scope, cart, resolvedPolicy)) { cart = await checkoutCart(req.scope, cart.id); deliveryChanged = true; }
  if (await simplifyDelivery(req.scope, cart, resolvedPolicy)) deliveryChanged = true;
  // Prepare only opaque references before payment; personal documents never enter cart metadata.
  const cartService = req.scope.resolve(Modules.CART);
  if (!cart.email && cart.customer_id) {
    const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer(cart.customer_id);
    if (customer.email) { await cartService.updateCarts(cart.id, { email: customer.email }); deliveryChanged = true; }
  }
  for (const item of cart.items ?? []) {
    if (!item.metadata?.checkout_line_key) await cartService.updateLineItems(item.id, { metadata: { ...item.metadata, checkout_line_key: randomUUID() } });
  }
  cart = await checkoutCart(req.scope, cart.id);
  return db(req.scope).transaction(async (trx: any) => {
    await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [`checkout:${cart.id}`]);
    let session = await trx('site_checkout_session').where({ cart_id: cart.id }).forUpdate().first();
    if (session?.mutation_until && new Date(session.mutation_until).getTime() > Date.now()) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Hay una actualización del carrito en curso. Volvé a intentar.', 'review');
    if (session && session.site_id !== site.id) throw new CheckoutError('CHECKOUT_CONTEXT_CHANGED', 'El carrito cambió de tienda. Iniciá una nueva compra.', 'contact');
    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      const policy = resolveCheckoutPolicy(site.content_config.checkout);
      const { units } = reconcileUnits([], cart.items ?? [], policy, null);
      const row = { cart_id: cart.id, site_id: site.id, access_hash: digest(req.headers['x-checkout-access']), policy: JSON.stringify(policy), policy_version: policyVersion(policy), fingerprint: cartFingerprint(cart), people: '[]', units: JSON.stringify(units), revision: (session?.revision ?? -1) + 1, global_person_id: null, snapshot_id: null, expires_at: new Date(Date.now() + policy.recipients.retention_days * 86400000), updated_at: new Date() };
      await trx('site_checkout_session').insert(row).onConflict('cart_id').merge();
      session = await trx('site_checkout_session').where({ cart_id: cart.id }).first();
    }
    const fingerprint = cartFingerprint(cart);
    if (session.fingerprint !== fingerprint) {
      const { units, conflicts } = reconcileUnits(session.units, cart.items ?? [], session.policy, session.global_person_id);
      if (!conflicts.length) session.units = units;
      session.fingerprint = fingerprint;
      session.revision++;
      session.snapshot_id = null;
      await trx('site_checkout_session').where({ cart_id: cart.id }).update({ units: JSON.stringify(session.units), fingerprint, revision: session.revision, snapshot_id: null, updated_at: new Date() });
    }
    return { ...sessionView(session, cart), cart_changed: deliveryChanged };
  });
}
export function sessionView(session: any, cart: any) {
  const { conflicts } = reconcileUnits(session.units, cart.items ?? [], session.policy, session.global_person_id);
  let complete = true;
  try { assertCoverage(session.units, session.people, cart.items ?? [], session.policy); } catch { complete = false; }
  return { configured: true, policy: session.policy, version: session.policy_version, revision: session.revision, people: session.people, units: session.units, global_person_id: session.global_person_id, conflicts, recipients_complete: complete, flow: effectiveFlow(cart, session.policy, complete) };
}
export function effectiveFlow(cart: any, policy: CheckoutPolicy, recipientsComplete: boolean) {
  const physical = (cart.items ?? []).some((i: any) => i.requires_shipping !== false);
  const pickup = cart.checkout_pickup === true;
  const addressRequired = physical && !pickup && !cart.checkout_pickup_only;
  const addressComplete = !addressRequired || !!(cart.shipping_address?.address_1 && cart.shipping_address?.city && cart.shipping_address?.country_code);
  const shippingComplete = !physical || ((cart.shipping_methods?.length ?? 0) > 0 && cart.checkout_shipping_valid !== false);
  const billingRequired = cart.metadata?.invoice_type === 'invoice_a';
  const billingComplete = !billingRequired || !!cart.metadata?.billing_snapshot;
  const blocks = [
    { id: 'personal', key: 'contact', complete: !!cart.email, applicable: true },
    { id: 'address', key: 'address', complete: addressComplete, applicable: addressRequired },
    { id: 'delivery', key: 'delivery', complete: shippingComplete, applicable: physical },
    { id: 'billing', key: 'billing', complete: billingComplete, applicable: billingRequired },
    { id: 'recipients', key: null, complete: recipientsComplete, applicable: policy.recipients.enabled },
    { id: 'benefits', key: 'benefits', complete: true, applicable: true },
    { id: 'payment', key: 'payment', complete: Number(cart.total) === 0 || !!cart.payment_collection?.payment_sessions?.some((p: any) => ['pending', 'requires_more', 'authorized', 'captured'].includes(p.status)), applicable: Number(cart.total) !== 0 },
    { id: 'review', key: 'review', complete: true, applicable: true },
  ];
  // `!== false` es explícito: undefined = permitido; sólo `false` oculta el paso incluso si faltan datos.
  return { address_required: addressRequired, shipping_required: physical, billing_required: billingRequired, blocks: blocks.map(b => ({ ...b, visible: b.applicable && (!b.key || policy.steps[b.key as keyof typeof policy.steps] !== false), reason: !b.complete ? 'Se necesita información para completar la compra.' : 'Información completa.' })), ready: !!cart.email && addressComplete && shippingComplete && billingComplete && recipientsComplete };
}
export async function saveRecipients(req: any, cart: any, input: { revision: number; people: Person[]; assignments: { unit_id: string; person_id: string }[]; global_person_id: string | null; keep_unit_ids?: string[] }) {
  if (cart.completed_at) throw new CheckoutError('CHECKOUT_COMPLETED', 'El pedido ya fue confirmado.', 'review');
  await assertCartAccess(req, cart, await sessionFor(req.scope, cart.id));
  const existing = await sessionFor(req.scope, cart.id);
  if (existing?.revision !== input.revision) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'El carrito cambió. Revisá las unidades antes de guardar.');
  await invalidateCheckoutPayment(req.scope, cart);
  return db(req.scope).transaction(async (trx: any) => {
    const session = await trx('site_checkout_session').where({ cart_id: cart.id }).forUpdate().first();
    if (!session) throw new CheckoutError('CHECKOUT_NOT_STARTED', 'Volvé a abrir el checkout.');
    if (session.finalizing || (session.mutation_until && new Date(session.mutation_until).getTime() > Date.now())) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Hay otra operación en curso. Volvé a intentar.', 'review');
    await assertCartAccess(req, cart, session);
    if (new Date(session.expires_at).getTime() < Date.now() || session.revision !== input.revision || session.fingerprint !== cartFingerprint(cart)) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'El carrito cambió. Revisá las unidades antes de guardar.');
    if (input.global_person_id && !input.people.some(p => p.id === input.global_person_id)) throw new CheckoutError('RECIPIENTS_INCOMPLETE', 'Seleccioná una persona válida.');
    const { units, conflicts } = reconcileUnits(session.units, cart.items ?? [], session.policy, input.global_person_id, input.keep_unit_ids);
    if (conflicts.length) throw new CheckoutError('RECIPIENT_SELECTION_REQUIRED', 'Elegí qué asignaciones conservar.');
    const assigned = new Map(input.assignments.map(a => [a.unit_id, a.person_id]));
    if (assigned.size !== input.assignments.length || input.assignments.some(a => !units.some(u => u.id === a.unit_id))) throw new CheckoutError('RECIPIENTS_INCOMPLETE', 'Las asignaciones no pertenecen a este carrito.');
    const nextUnits = units.map(u => ({ ...u, person_id: input.global_person_id ?? assigned.get(u.id) ?? null }));
    assertCoverage(nextUnits, input.people, cart.items ?? [], session.policy);
    const next = { ...session, units: nextUnits, people: input.people, global_person_id: input.global_person_id, revision: session.revision + 1, snapshot_id: null };
    await trx('site_checkout_session').where({ cart_id: cart.id }).update({ units: JSON.stringify(next.units), people: JSON.stringify(next.people), global_person_id: next.global_person_id, revision: next.revision, snapshot_id: null, updated_at: new Date() });
    return sessionView(next, cart);
  });
}
/** Durable immutable snapshot before the provider can charge. No totals are mutated here. */
export async function prepareCheckoutPayment(scope: any, cart: any) {
  const site = await cartSite(scope, cart);
  const session = site ? await sessionFor(scope, cart.id) : null;
  if (!site?.content_config?.checkout && !session) return;
  if (!session || new Date(session.expires_at).getTime() < Date.now()) throw new CheckoutError('CHECKOUT_NOT_STARTED', 'Revisá el checkout antes de pagar.', 'review');
  const _fp = cartFingerprint(cart);
  debugLog(scope, `[CHECKOUT_DEBUG] prepareCheckoutPayment cart=${cart.id} sessionFp=${session.fingerprint} cartFp=${_fp} match=${session.fingerprint === _fp} components=${JSON.stringify(cartFingerprintComponents(cart))}`);
  if (session.fingerprint !== _fp) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'El carrito cambió. Revisá la compra antes de pagar.', 'review');
  assertCoverage(session.units, session.people, cart.items ?? [], session.policy);
  if (!effectiveFlow(cart, session.policy, true).ready) throw new CheckoutError('CHECKOUT_REQUIRED', 'Completá los datos pendientes antes de pagar.', 'review');
  const id = randomUUID();
  await db(scope).transaction(async (trx: any) => {
    const current = await trx('site_checkout_session').where({ cart_id: cart.id }).forUpdate().first();
    if (current.mutation_until && new Date(current.mutation_until).getTime() > Date.now()) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'El carrito se está actualizando. Volvé a intentar.', 'review');
    if (current.revision !== session.revision) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Los destinatarios cambiaron. Revisá la compra.', 'review');
    await trx('site_checkout_snapshot').insert({ id, cart_id: cart.id, site_id: session.site_id, policy: JSON.stringify(session.policy), policy_version: session.policy_version, revision: session.revision, fingerprint: session.fingerprint, people: JSON.stringify(session.people), units: JSON.stringify(session.units), expires_at: session.expires_at }).onConflict(['cart_id', 'revision']).ignore();
    const snapshot = await trx('site_checkout_snapshot').where({ cart_id: cart.id, revision: session.revision }).first();
    await trx('site_checkout_session').where({ cart_id: cart.id }).update({ snapshot_id: snapshot.id });
  });
}
export async function validateCheckoutCompletion(scope: any, cart: any) {
  // Exempt only a cart actually owned by the trusted renewal scheduler. A
  // metadata flag supplied by a Store API caller never grants an exemption.
  let recurring: any;
  try { recurring = scope.resolve('recurringOrder'); } catch { /* optional module */ }
  if (recurring?.listRenewalCycles) {
    const cycles = await recurring.listRenewalCycles({ cart_id: cart.id });
    if (cycles.length) return;
  }
  const site = await cartSite(scope, cart);
  if (!site) return;
  const session = await sessionFor(scope, cart.id);
  if (!site.content_config?.checkout && !session) return;
  await resolvePickup(scope, cart);
  await shippingEligibility(scope, cart);
  const snapshot = session?.snapshot_id ? await db(scope)('site_checkout_snapshot').where({ id: session.snapshot_id, cart_id: cart.id, site_id: site.id }).first() : null;
  const _fp = cartFingerprint(cart);
  debugLog(scope, `[CHECKOUT_DEBUG] validateCheckoutCompletion cart=${cart.id} snapshotFp=${snapshot?.fingerprint ?? 'NO_SNAPSHOT'} cartFp=${_fp} match=${snapshot?.fingerprint === _fp} components=${JSON.stringify(cartFingerprintComponents(cart))}`);
  if (!snapshot || snapshot.fingerprint !== _fp) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'Revisá el checkout antes de finalizar la compra.', 'review');
  assertCoverage(snapshot.units, snapshot.people, cart.items ?? [], snapshot.policy);
  if (!effectiveFlow(cart, snapshot.policy, true).ready) throw new CheckoutError('CHECKOUT_REQUIRED', 'La entrega o los datos de la compra cambiaron. Revisá el checkout.', 'review');
  assertPaymentMatchesCart(cart);
  const locked = await db(scope)('site_checkout_session').where({ cart_id: cart.id, snapshot_id: snapshot.id, revision: snapshot.revision }).where((q: any) => q.whereNull('mutation_until').orWhere('mutation_until', '<', new Date())).update({ finalizing: true });
  if (locked !== 1) throw new CheckoutError('CHECKOUT_REVISION_CONFLICT', 'El carrito cambió durante la confirmación. Revisá la compra.', 'review');
  return cart.id as string;
}
export async function releaseCheckoutCompletion(scope: any, cartId?: string) {
  if (cartId) await db(scope)('site_checkout_session').where({ cart_id: cartId }).update({ finalizing: false });
}
