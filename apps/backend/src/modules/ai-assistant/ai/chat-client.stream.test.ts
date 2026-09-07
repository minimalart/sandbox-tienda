import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatCompleteStream } from './chat-client.ts';

/** Arma un cuerpo SSE estilo OpenRouter a partir de objetos de frame. */
function sseBody(frames: unknown[]): string {
  return frames.map((f) => `data: ${JSON.stringify(f)}`).join('\n\n') + '\n\ndata: [DONE]\n\n';
}

test('chatCompleteStream: ensambla content, emite tokens y arma tool_calls troceados', async () => {
  const sse = sseBody([
    { choices: [{ delta: { content: 'Hola' } }] },
    { choices: [{ delta: { content: ' mundo' } }] },
    {
      choices: [
        {
          delta: {
            tool_calls: [
              {
                index: 0,
                id: 'call_1',
                type: 'function',
                function: { name: 'manage_medusa_admin_orders', arguments: '{"acti' },
              },
            ],
          },
        },
      ],
    },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'on":"list"}' } }] } }] },
    { choices: [{ finish_reason: 'tool_calls' }], usage: { prompt_tokens: 10, completion_tokens: 5 } },
  ]);

  const origFetch = globalThis.fetch;
  const origKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  globalThis.fetch = (async () =>
    new Response(sse, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })) as any;

  try {
    const tokens: string[] = [];
    const msg = await chatCompleteStream(
      { messages: [{ role: 'user', content: 'hola' }] },
      (t) => tokens.push(t),
    );

    assert.deepEqual(tokens, ['Hola', ' mundo']);
    assert.equal(msg.content, 'Hola mundo');
    assert.equal(msg.finish_reason, 'tool_calls');
    assert.equal(msg.usage?.prompt_tokens, 10);
    assert.equal(msg.tool_calls?.length, 1);
    assert.equal(msg.tool_calls?.[0].id, 'call_1');
    assert.equal(msg.tool_calls?.[0].function.name, 'manage_medusa_admin_orders');
    assert.equal(msg.tool_calls?.[0].function.arguments, '{"action":"list"}');
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origKey;
  }
});

test('chatCompleteStream: respuesta solo-texto sin tool_calls', async () => {
  const sse = sseBody([
    { choices: [{ delta: { content: 'Respuesta final.' } }] },
    { choices: [{ finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } },
  ]);
  const origFetch = globalThis.fetch;
  const origKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  globalThis.fetch = (async () => new Response(sse, { status: 200 })) as any;
  try {
    const msg = await chatCompleteStream({ messages: [{ role: 'user', content: 'x' }] });
    assert.equal(msg.content, 'Respuesta final.');
    assert.equal(msg.finish_reason, 'stop');
    assert.equal(msg.tool_calls, undefined);
  } finally {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origKey;
  }
});
