import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkoutCookieName, handleCheckoutSession } from './checkout-session';
import { createCheckoutRequestQueue } from '../util/checkout-request-queue';

const success = () => Promise.resolve(Response.json({ configured: true }));
const conflict = () => Object.assign(new Error('El carrito ya está vinculado a otra sesión de compra.'), { status: 409 });

test('a rejected concurrent initialization cannot overwrite the accepted cookie', async () => {
  let binding: string | undefined;
  let cookie: string | undefined;
  let release!: () => void;
  const winnerFinished = new Promise<void>(resolve => { release = resolve; });
  const winner = handleCheckoutSession({
    bind: async token => { binding = token; },
    request: success,
  });
  const loser = handleCheckoutSession({
    bind: async token => {
      assert.notEqual(token, binding);
      await winnerFinished; // The failed response arrives LAST.
      throw conflict();
    },
    request: () => { throw new Error('Rejected binding must not call Store'); },
  });
  const first = await winner;
  cookie = first.newToken;
  release();
  const second = await loser;
  if (second.newToken) cookie = second.newToken;
  assert.equal(second.status, 409);
  assert.equal(second.newToken, undefined);
  assert.equal(cookie, binding);
  assert.match(cookie!, /^[a-f0-9]{64}$/);
});

test('an accepted binding keeps its cookie even when the subsequent request fails', async () => {
  for (const request of [
    async () => Response.json({ message: 'Invalid recipients' }, { status: 422 }),
    async () => { throw new Error('Network unavailable'); },
  ]) {
    let binding: string | undefined;
    const response = await handleCheckoutSession({ bind: async token => { binding = token; }, request });
    assert.ok(response.status >= 400);
    assert.equal(response.newToken, binding);
  }
});

test('existing cookies are reused without rotation, and mismatched capabilities stay rejected', async () => {
  const existingToken = 'a'.repeat(64);
  const response = await handleCheckoutSession({ existingToken,
    bind: async token => { assert.equal(token, existingToken); },
    request: async token => { assert.equal(token, existingToken); return Response.json({ configured: true }); },
  });
  assert.equal(response.status, 200);
  assert.equal(response.newToken, undefined);
  const rejected = await handleCheckoutSession({ existingToken, bind: async () => { throw conflict(); }, request: success });
  assert.equal(rejected.status, 409);
  assert.equal(rejected.newToken, undefined);
});

test('optional extension absent and Store-only installations remain supported', async () => {
  const missing = await handleCheckoutSession({ bind: async () => { throw Object.assign(new Error('Not found'), { status: 404 }); }, request: success });
  assert.deepEqual(missing, { body: { configured: false }, status: 200 });
  const missingStore = await handleCheckoutSession({ request: async () => new Response('', { status: 404 }) });
  assert.deepEqual(missingStore, { body: { configured: false }, status: 200 });
  const storeOnly = await handleCheckoutSession({ request: success });
  assert.equal(storeOnly.status, 200);
  assert.ok(storeOnly.newToken);
  const failedStore = await handleCheckoutSession({ request: async () => Response.json({}, { status: 403 }) });
  assert.equal(failedStore.newToken, undefined);
});

test('concurrent initializations reuse the accepted token in base, site and wholesale contexts', async () => {
  const queue = createCheckoutRequestQueue();
  const cookies = new Map<string, string>();
  const bindings = new Map<string, string>();
  const contexts = [null, 'alpha', 'beta', 'main'].flatMap(site =>
    (['b2c', 'b2b'] as const).map(mode => ({ mode, site })),
  );
  const keys = contexts.map(context => checkoutCookieName(context, 'cart_fixture'));
  assert.equal(new Set(keys).size, contexts.length);
  assert.notEqual(keys[0], checkoutCookieName(contexts[0], 'cart_other'));
  await Promise.all(keys.flatMap(key => Array.from({ length: 5 }, () => queue(key, async () => {
    const result = await handleCheckoutSession({ existingToken: cookies.get(key),
      bind: async token => {
        const bound = bindings.get(key);
        if (bound && bound !== token) throw conflict();
        bindings.set(key, token);
      }, request: success,
    });
    if (result.newToken) cookies.set(key, result.newToken);
    assert.equal(result.status, 200);
  }))));
  assert.deepEqual(cookies, bindings);
  assert.equal(new Set(cookies.values()).size, contexts.length);
});
