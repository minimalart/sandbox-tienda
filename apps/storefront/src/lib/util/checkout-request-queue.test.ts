import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCheckoutRequestQueue } from './checkout-request-queue';

test('requests in one session wait for the first response, while other sessions can proceed', async () => {
  const queue = createCheckoutRequestQueue();
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = queue('b2c:alpha', async () => { events.push('first'); await gate; events.push('cookie'); });
  const second = queue('b2c:alpha', async () => { events.push('second'); });
  await queue('b2b:alpha', async () => { events.push('other'); });
  assert.deepEqual(events, ['first', 'other']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'other', 'cookie', 'second']);
});

test('failure releases the queue and preserves the original rejection', async () => {
  const queue = createCheckoutRequestQueue();
  const failure = new Error('Fixture conflict');
  const first = queue('alpha', async () => { throw failure; });
  const second = queue('alpha', async () => 'retried');
  await assert.rejects(first, error => error === failure);
  assert.equal(await second, 'retried');
  assert.equal(await queue('alpha', async () => 'again'), 'again');
});

test('separate tabs use the same origin-scoped exclusive lock', async () => {
  const browserQueue = createCheckoutRequestQueue();
  const locks = { request: browserQueue };
  const tabA = createCheckoutRequestQueue();
  const tabB = createCheckoutRequestQueue();
  let running = 0;
  let maxRunning = 0;
  const task = async () => {
    running++;
    maxRunning = Math.max(running, maxRunning);
    await new Promise<void>(resolve => setImmediate(resolve));
    running--;
  };
  await Promise.all([tabA('same-session', task, locks), tabB('same-session', task, locks)]);
  assert.equal(maxRunning, 1);
});
