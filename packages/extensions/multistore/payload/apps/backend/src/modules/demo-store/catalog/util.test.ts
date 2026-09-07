import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Shrink the throttle/backoff so retry paths run fast in the test.
process.env.DEMO_IMPORT_THROTTLE_MS = '0';
process.env.DEMO_IMPORT_BACKOFF_BASE_MS = '1';

import { resilientFetch, fetchJson, RateLimitedError } from './util.ts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('resilientFetch retries a 429 then succeeds', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return calls === 1 ? new Response('slow down', { status: 429 }) : json({ ok: true });
  }) as typeof fetch;

  const res = await resilientFetch('https://x.test/a');
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
});

test('resilientFetch throws RateLimitedError on a persistent block', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('blocked', { status: 403 });
  }) as typeof fetch;

  await assert.rejects(
    () => resilientFetch('https://x.test/b', undefined, 3),
    (err: unknown) => {
      assert.ok(err instanceof RateLimitedError);
      assert.equal((err as RateLimitedError).status, 403);
      return true;
    },
  );
  assert.equal(calls, 3); // exhausted all retries before throwing
});

test('fetchJson returns [] on 404 (empty-page signal) and parses 200', async () => {
  globalThis.fetch = (async () => new Response('nope', { status: 404 })) as typeof fetch;
  assert.deepEqual(await fetchJson('https://x.test/c'), []);

  globalThis.fetch = (async () => json([1, 2, 3])) as typeof fetch;
  assert.deepEqual(await fetchJson('https://x.test/d'), [1, 2, 3]);
});

test('resilientFetch returns non-blocking non-ok (e.g. 404) without retrying', async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  const res = await resilientFetch('https://x.test/e');
  assert.equal(res.status, 404);
  assert.equal(calls, 1);
});
