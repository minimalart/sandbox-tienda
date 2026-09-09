import cleanupCheckoutRecipients from '../../../jobs/cleanup-checkout-recipients.ts';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { Migration20260908180000DemoStore } from '../migrations/Migration20260908180000DemoStore.ts';
import { beginCheckout, saveRecipients, prepareCheckoutPayment, validateCheckoutCompletion, releaseCheckoutCompletion, readPolicy, writePolicy, assertCartAccess, sessionFor, invalidateCheckoutPayment, bindCartContext, beginCartMutation, endCartMutation } from './runtime.ts';

const require = createRequire(import.meta.url);
const knex = createRequire(require.resolve('@medusajs/framework/mikro-orm/knex'))('knex');
it('persists policy, isolated recipients, concurrent revisions and immutable pre-payment snapshots in PostgreSQL', { skip: !process.env.CHECKOUT_TEST_DATABASE_URL }, async (t) => {
  const schema = `checkout_spec_${randomUUID().replaceAll('-', '')}`;
  const pg = knex({ client: 'pg', connection: process.env.CHECKOUT_TEST_DATABASE_URL, searchPath: [schema], pool: { min: 0, max: 4 } });
  try {
    await pg.raw('create schema ??', [schema]);
    await pg.raw('create table demo_store (id text primary key, slug text, is_main boolean default false, content_config jsonb, sales_channel_id text, b2b_sales_channel_id text, deleted_at timestamptz, updated_at timestamptz)');
    const statements: string[] = [];
    const migration = Object.create(Migration20260908180000DemoStore.prototype);
    migration.addSql = (sql: string) => statements.push(sql);
    await migration.up();
    for (const sql of statements) await pg.raw(sql);
    for (const sql of statements) await pg.raw(sql); // additive/idempotent migration
    await pg('demo_store').insert([{ id: 'site_a', slug: 'site-a', sales_channel_id: 'channel_a', content_config: JSON.stringify({ description: 'preserve' }) }, { id: 'site_b', slug: 'site-b', sales_channel_id: 'channel_b' }]);
    const cart: any = { id: 'cart_a', sales_channel_id: 'channel_a', email: 'fixture@example.test', currency_code: 'ars', total: 20, region_id: 'region_a', metadata: {}, items: [{ id: 'line_a', product_id: 'product_a', variant_id: 'variant_a', quantity: 2, unit_price: 10, requires_shipping: false, metadata: {} }] };
    let orderExists = false;
    let cancelFails = false;
    let cancelled = 0;
    const scope = { resolve(key: string): any {
      if (key === ContainerRegistrationKeys.PG_CONNECTION) return pg;
      if (key === 'demo_store') return { retrieveDemoStore: (id: string) => pg('demo_store').where({ id }).first(), listDemoStores: async (filter: any) => { const channel = filter.$or[0].sales_channel_id; return pg('demo_store').where('sales_channel_id', channel).orWhere('b2b_sales_channel_id', channel); } };
      if (key === ContainerRegistrationKeys.QUERY) return { graph: async ({ entity }: any) => ({ data: entity === 'cart' ? [structuredClone(cart)] : entity === 'order_cart' && orderExists ? [{ order_id: 'order_fixture' }] : [] }) };
      if (key === Modules.CART) return { retrieveCart: async () => structuredClone(cart), updateLineItems: async (id: string, value: any) => { Object.assign(cart.items.find((i: any) => i.id === id), value); } };
      if (key === Modules.CUSTOMER) return { retrieveCustomer: async () => ({ has_account: true }) };
      if (key === Modules.PAYMENT) return { deletePaymentSession: async () => { if (cancelFails) throw new Error("Synthetic provider unavailable"); cancelled++; cart.payment_collection.payment_sessions = []; } };
      throw new Error(`Unexpected fixture dependency: ${key}`);
    } };
    const req: any = { scope, headers: { 'x-checkout-access': 'a'.repeat(64) }, publishable_key_context: { sales_channel_ids: ['channel_a'] } };
    await assert.rejects(bindCartContext(scope, cart.id, 'site-b', 'b2c', req.headers['x-checkout-access']), /no pertenece/);
    const base = await readPolicy(scope, 'site_a');
    await writePolicy(scope, 'site_a', { recipients: { enabled: true }, steps: { contact: false } }, base.version);
    assert.equal((await pg('demo_store').where({ id: 'site_a' }).first()).content_config.description, 'preserve');
    assert.equal((await readPolicy(scope, 'site_b')).policy.recipients.enabled, false);
    await assert.rejects(writePolicy(scope, 'site_a', { recipients: { enabled: false } }, base.version), /configuración cambió/);
    await bindCartContext(scope, cart.id, 'site-a', 'b2c', req.headers['x-checkout-access']);
    const state: any = await beginCheckout(req, structuredClone(cart));
    assert.equal(state.units.length, 2);
    await assert.rejects(prepareCheckoutPayment(scope, cart), /destinatarios/);
    await assert.rejects(assertCartAccess({ ...req, publishable_key_context: { sales_channel_ids: ['channel_b'] } }, cart), /no encontrado/);
    await assert.rejects(assertCartAccess({ ...req, headers: { 'x-checkout-access': 'b'.repeat(64) } }, cart, await sessionFor(scope, cart.id)), /abrir el checkout/);
    await assert.rejects(assertCartAccess(req, { ...cart, customer_id: 'registered-customer' }), /no encontrado/);
    const p = { id: randomUUID(), document: '30111222', first_name: 'Persona', last_name: 'Prueba' };
    const input = { revision: state.revision, people: [p], assignments: [], global_person_id: p.id };
    const concurrent = await Promise.allSettled([saveRecipients(req, cart, input), saveRecipients(req, cart, input)]);
    assert.equal(concurrent.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(r => r.status === 'rejected').length, 1);
    await prepareCheckoutPayment(scope, cart);
    await prepareCheckoutPayment(scope, cart);
    const mutation = await beginCartMutation(scope, cart.id);
    await assert.rejects(prepareCheckoutPayment(scope, cart), /actualizando/);
    await assert.rejects(beginCartMutation(scope, cart.id), /operación en curso/);
    await endCartMutation(scope, cart.id, mutation);
    assert.equal((await pg('site_checkout_snapshot')).length, 1);
    const snapshot = await pg('site_checkout_snapshot').first();
    assert.equal(snapshot.people[0].document, p.document);
    assert.ok(!JSON.stringify(cart).includes(p.document));
    cart.payment_collection = { amount: 19, currency_code: 'ars', payment_sessions: [{ id: 'session_a', amount: 19, currency_code: 'ars', status: 'pending' }] };
    await assert.rejects(validateCheckoutCompletion(scope, cart), /importe cambió/);
    cart.payment_collection.amount = 20; cart.payment_collection.payment_sessions[0].amount = 20;
    assert.equal(await validateCheckoutCompletion(scope, cart), cart.id);
    await assert.rejects(invalidateCheckoutPayment(scope, cart), /confirmando/);
    await releaseCheckoutCompletion(scope, cart.id);
    const currentPolicy = await readPolicy(scope, 'site_a');
    await writePolicy(scope, 'site_a', { recipients: { enabled: false } }, currentPolicy.version);
    const pinned: any = await beginCheckout(req, cart);
    assert.equal(pinned.policy.recipients.enabled, true);
    cart.items[0].quantity = 3; cart.total = 30;
    await assert.rejects(validateCheckoutCompletion(scope, cart), /Revisá el checkout/);
    const changed: any = await beginCheckout(req, cart);
    assert.equal(changed.units.length, 3); assert.ok(changed.units.every((u: any) => u.person_id === p.id));
    assert.equal(snapshot.units.length, 2);
    // An adopted/shared channel still selects the original site through the
    // immutable server binding, rather than whichever row is listed first.
    await pg('demo_store').where({ id: 'site_b' }).update({ sales_channel_id: 'channel_a' });
    const stillPinned: any = await beginCheckout(req, cart);
    assert.equal(stillPinned.version, pinned.version);
    await assert.rejects(bindCartContext(scope, cart.id, 'site-b', 'b2c', req.headers['x-checkout-access']), /otra sesión/);
    await assert.rejects(saveRecipients(req, cart, { ...input, revision: changed.revision - 1 }), /carrito cambió/);

    const originalCart = { id: 'cart_a', sales_channel_id: 'channel_a', email: 'fixture@example.test', currency_code: 'ars', total: 20, region_id: 'region_a', metadata: {}, items: [{ id: 'line_a', product_id: 'product_a', variant_id: 'variant_a', quantity: 2, unit_price: 10, requires_shipping: false, metadata: {} }] };
    async function fresh(total = 20) {
      orderExists = false; cancelFails = false; cancelled = 0;
      await pg('site_checkout_snapshot').delete(); await pg('site_checkout_session').delete(); await pg('site_checkout_cart_context').delete();
      await pg('demo_store').where({ id: 'site_b' }).update({ sales_channel_id: 'channel_b' });
      await pg('demo_store').where({ id: 'site_a' }).update({ content_config: JSON.stringify({ checkout: { recipients: { enabled: true } } }) });
      for (const key of Object.keys(cart)) delete cart[key]; Object.assign(cart, structuredClone(originalCart), { total });
      await bindCartContext(scope, cart.id, 'site-a', 'b2c', req.headers['x-checkout-access']);
      const opened: any = await beginCheckout(req, cart);
      const saved: any = await saveRecipients(req, cart, { revision: opened.revision, people: [p], assignments: [], global_person_id: p.id });
      await prepareCheckoutPayment(scope, cart);
      return saved;
    }
    for (const status of ['pending', 'requires_more', 'authorized', 'captured', 'pending_authorization']) await t.test('accepts matching payment status ' + status, async () => {
      await fresh(); cart.payment_collection = { amount: 20, currency_code: 'ars', payment_sessions: [{ id: 'pay', amount: 20, currency_code: 'ars', status }] };
      assert.equal(await validateCheckoutCompletion(scope, cart), cart.id);
    });
    for (const status of ['error', 'canceled', 'deleted']) await t.test('rejects unusable payment status ' + status, async () => {
      await fresh(); cart.payment_collection = { amount: 20, currency_code: 'ars', payment_sessions: [{ id: 'pay', amount: 20, currency_code: 'ars', status }] };
      await assert.rejects(validateCheckoutCompletion(scope, cart), /importe cambió/); assert.equal((await sessionFor(scope, cart.id)).finalizing, false);
    });
    for (const variant of ['no-collection', 'no-session', 'session-amount', 'collection-amount', 'session-currency', 'collection-currency']) await t.test('blocks stale payment: ' + variant, async () => {
      await fresh(); cart.payment_collection = { amount: 20, currency_code: 'ars', payment_sessions: [{ id: 'pay', amount: 20, currency_code: 'ars', status: 'pending' }] };
      if (variant === 'no-collection') delete cart.payment_collection;
      else if (variant === 'no-session') cart.payment_collection.payment_sessions = [];
      else if (variant === 'session-amount') cart.payment_collection.payment_sessions[0].amount = 19;
      else if (variant === 'collection-amount') cart.payment_collection.amount = 19;
      else if (variant === 'session-currency') cart.payment_collection.payment_sessions[0].currency_code = 'usd';
      else cart.payment_collection.currency_code = 'usd';
      await assert.rejects(validateCheckoutCompletion(scope, cart), /importe cambió/);
    });
    await t.test('multiple active payment sessions cannot authorize twice', async () => {
      await fresh(); cart.payment_collection = { amount: 20, currency_code: 'ars', payment_sessions: [{ id: 'pay-a', amount: 20, currency_code: 'ars', status: 'pending' }, { id: 'pay-b', amount: 20, currency_code: 'ars', status: 'pending' }] };
      await assert.rejects(validateCheckoutCompletion(scope, cart), /sesiones de pago/); assert.equal((await sessionFor(scope, cart.id)).finalizing, false);
    });
    await t.test('zero outstanding total needs no gateway, while a partial credit still needs payment', async () => {
      await fresh(0); assert.equal(await validateCheckoutCompletion(scope, cart), cart.id); assert.equal(cancelled, 0);
      await fresh(1); await assert.rejects(validateCheckoutCompletion(scope, cart), /importe cambió/);
    });
    await t.test('provider cancellation failure keeps snapshot and recipients available', async () => {
      await fresh(); const before = await sessionFor(scope, cart.id); cart.payment_collection = { payment_sessions: [{ id: 'pay', status: 'pending' }] }; cancelFails = true;
      await assert.rejects(invalidateCheckoutPayment(scope, cart), /Synthetic provider/);
      assert.equal((await sessionFor(scope, cart.id)).snapshot_id, before.snapshot_id); assert.deepEqual((await sessionFor(scope, cart.id)).people, before.people);
    });
    for (const status of ['authorized', 'captured', 'pending_authorization']) await t.test('cannot edit while provider status is ' + status, async () => {
      const saved = await fresh(); cart.payment_collection = { payment_sessions: [{ id: 'pay', status }] };
      await assert.rejects(saveRecipients(req, cart, { revision: saved.revision, people: [p], assignments: [], global_person_id: p.id }), /pago en proceso/); assert.equal(cancelled, 0);
    });
    await t.test('expired sessions cannot prepare new payments', async () => {
      await fresh(); await pg('site_checkout_session').where({ cart_id: cart.id }).update({ expires_at: new Date(Date.now() - 1000) }); await assert.rejects(prepareCheckoutPayment(scope, cart), /antes de pagar/);
    });
    await t.test('concurrent preparations create one immutable snapshot', async () => {
      await fresh(); await pg('site_checkout_snapshot').delete(); await pg('site_checkout_session').update({ snapshot_id: null });
      await Promise.all(Array.from({ length: 8 }, () => prepareCheckoutPayment(scope, cart))); assert.equal((await pg('site_checkout_snapshot')).length, 1);
    });
    await t.test('only the mutation owner can release its lease', async () => {
      await fresh(); const token = await beginCartMutation(scope, cart.id); await endCartMutation(scope, cart.id, 'foreign'); await assert.rejects(beginCartMutation(scope, cart.id)); await endCartMutation(scope, cart.id, token); assert.ok(await beginCartMutation(scope, cart.id));
    });
    await t.test('a completed cart cannot rewrite the historical recipient data', async () => {
      const saved = await fresh(); cart.completed_at = new Date(); await assert.rejects(saveRecipients(req, cart, { revision: saved.revision, people: [], assignments: [], global_person_id: null }), /confirmado/); assert.equal((await sessionFor(scope, cart.id)).people[0].document, p.document);
    });
    await t.test('untrusted renewal metadata does not bypass payment validation', async () => {
      await fresh(); cart.metadata = { recurring_order_id: 'forged', is_renewal: true }; await assert.rejects(validateCheckoutCompletion(scope, cart), /importe cambió/);
    });

    await t.test('retention erases abandoned recipients after successful payment cancellation', async () => {
      await fresh(); cart.payment_collection = { payment_sessions: [{ id: 'pending', status: 'pending' }] };
      await pg('site_checkout_session').update({ expires_at: new Date(Date.now() - 1000) });
      await cleanupCheckoutRecipients(scope as any); assert.equal(cancelled, 1); assert.equal(await sessionFor(scope, cart.id), undefined); assert.equal((await pg('site_checkout_snapshot')).length, 0);
    });
    await t.test('retention preserves historical recipients linked to an order', async () => {
      await fresh(); orderExists = true; await pg('site_checkout_session').update({ expires_at: new Date(Date.now() - 1000) });
      await cleanupCheckoutRecipients(scope as any); assert.equal((await sessionFor(scope, cart.id)).people[0].document, p.document); assert.equal((await pg('site_checkout_snapshot')).length, 1);
    });
    await t.test('retention cannot erase recipients while confirmation is in flight', async () => {
      await fresh(); await pg('site_checkout_session').update({ expires_at: new Date(Date.now() - 1000), finalizing: true });
      await cleanupCheckoutRecipients(scope as any); assert.equal((await pg('site_checkout_snapshot')).length, 1);
    });
    await t.test('retention retries later if the provider cannot cancel a pending payment', async () => {
      await fresh(); cancelFails = true; cart.payment_collection = { payment_sessions: [{ id: 'pending', status: 'pending' }] }; await pg('site_checkout_session').update({ expires_at: new Date(Date.now() - 1000) });
      await cleanupCheckoutRecipients(scope as any); assert.equal((await pg('site_checkout_snapshot')).length, 1); assert.equal((await sessionFor(scope, cart.id)).mutation_token, null);
    });
  } finally {
    await pg.raw('drop schema if exists ?? cascade', [schema]);
    await pg.destroy();
  }
});
