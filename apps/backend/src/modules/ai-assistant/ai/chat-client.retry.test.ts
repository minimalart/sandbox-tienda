import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatComplete, ChatAiError } from './chat-client.ts';

function okBody(): string {
  return JSON.stringify({
    choices: [
      {
        message: { role: 'assistant', content: 'listo' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1 },
  });
}

/** Corre `fn` con fetch mockeado y la API key seteada; restaura todo al salir. */
async function withMockedFetch(
  impl: () => Promise<Response>,
  fn: () => Promise<void>,
): Promise<void> {
  const origFetch = globalThis.fetch;
  const origKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  globalThis.fetch = impl as any;
  try {
    await fn();
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origKey;
  }
}

test('chatComplete: reintenta ante 429 transitorio y termina bien', async () => {
  let calls = 0;
  await withMockedFetch(
    async () => {
      calls++;
      if (calls === 1) return new Response('rate limited', { status: 429 });
      return new Response(okBody(), { status: 200 });
    },
    async () => {
      const msg = await chatComplete({ messages: [{ role: 'user', content: 'hola' }] });
      assert.equal(msg.content, 'listo');
      assert.equal(calls, 2);
    },
  );
});

test('chatComplete: reintenta ante caída de red y termina bien', async () => {
  let calls = 0;
  await withMockedFetch(
    async () => {
      calls++;
      if (calls === 1) throw new Error('ECONNRESET');
      return new Response(okBody(), { status: 200 });
    },
    async () => {
      const msg = await chatComplete({ messages: [{ role: 'user', content: 'hola' }] });
      assert.equal(msg.content, 'listo');
      assert.equal(calls, 2);
    },
  );
});

test('chatComplete: NO reintenta errores no transitorios (400)', async () => {
  let calls = 0;
  await withMockedFetch(
    async () => {
      calls++;
      return new Response('bad request', { status: 400 });
    },
    async () => {
      await assert.rejects(
        chatComplete({ messages: [{ role: 'user', content: 'hola' }] }),
        (e: unknown) => e instanceof ChatAiError && /400/.test((e as Error).message),
      );
      assert.equal(calls, 1);
    },
  );
});

test('chatComplete: agota los reintentos y tira el último error', async () => {
  let calls = 0;
  await withMockedFetch(
    async () => {
      calls++;
      return new Response('upstream down', { status: 502 });
    },
    async () => {
      await assert.rejects(
        chatComplete({ messages: [{ role: 'user', content: 'hola' }] }),
        (e: unknown) => e instanceof ChatAiError,
      );
      assert.equal(calls, 3);
    },
  );
});
