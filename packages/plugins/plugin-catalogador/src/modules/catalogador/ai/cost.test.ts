import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatComplete,
  createAiUsageScope,
  emptyAiUsage,
  generateImage,
  mergeAiUsage,
} from './openrouter.ts';

/** Respuesta mínima de chat-completions con el `usage.cost` que informa OpenRouter. */
const chatResponse = (cost: number | null) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [{ message: { content: '{"subtitle":"x"}' }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 20,
      ...(cost === null ? {} : { cost }),
    },
  }),
  text: async () => '',
});

/** Respuesta mínima de imagen (nano-banana devuelve la imagen como data URL). */
const imageResponse = (cost: number) => ({
  ok: true,
  status: 200,
  json: async () => ({
    choices: [
      {
        message: {
          images: [{ image_url: { url: 'data:image/png;base64,aGk=' } }],
        },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 0, cost },
  }),
  text: async () => '',
});

/** Corre `fn` con `fetch` y la API key mockeadas. */
async function withMocks<T>(responses: unknown[], fn: () => Promise<T>): Promise<T> {
  const realFetch = globalThis.fetch;
  const realKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  let i = 0;
  globalThis.fetch = (async () => responses[i++]) as unknown as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = realKey;
  }
}

test('el ámbito acumula el costo de texto e imagen por separado', async () => {
  const scope = createAiUsageScope();
  await withMocks([chatResponse(0.0004), imageResponse(0.003)], () =>
    scope.run(async () => {
      await chatComplete({ model: 'text-model', messages: [{ role: 'user', content: 'hola' }] });
      await generateImage({ model: 'image-model', prompt: 'p' });
    })
  );

  assert.equal(scope.usage.calls, 2);
  assert.equal(scope.usage.text_usd, 0.0004);
  assert.equal(scope.usage.image_usd, 0.003);
  assert.equal(scope.usage.total_usd, 0.0034);
  assert.equal(scope.usage.prompt_tokens, 110);
  assert.equal(scope.usage.completion_tokens, 20);
  assert.equal(scope.usage.missing_cost, false);
  assert.deepEqual(scope.usage.by_model, {
    'text-model': { calls: 1, usd: 0.0004 },
    'image-model': { calls: 1, usd: 0.003 },
  });
});

test('una respuesta sin costo marca el total como piso (missing_cost)', async () => {
  const scope = createAiUsageScope();
  await withMocks([chatResponse(null)], () =>
    scope.run(() => chatComplete({ model: 'text-model', messages: [{ role: 'user', content: 'x' }] }))
  );

  assert.equal(scope.usage.calls, 1);
  assert.equal(scope.usage.total_usd, 0);
  assert.equal(scope.usage.missing_cost, true);
});

test('el gasto previo a un error queda registrado en el ámbito', async () => {
  const scope = createAiUsageScope();
  // 2ª llamada: 200 OK pero sin imagen → generateImage lanza (ya se cobró).
  const noImage = {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: {} }], usage: { cost: 0.002 } }),
    text: async () => '',
  };
  await withMocks([chatResponse(0.001), noImage], async () => {
    await assert.rejects(
      scope.run(async () => {
        await chatComplete({ model: 'text-model', messages: [{ role: 'user', content: 'x' }] });
        await generateImage({ model: 'image-model', prompt: 'p' });
      })
    );
  });

  assert.equal(scope.usage.calls, 2);
  assert.equal(scope.usage.total_usd, 0.003);
});

test('sin ámbito abierto las llamadas no rompen', async () => {
  await withMocks([chatResponse(0.001)], () =>
    chatComplete({ model: 'text-model', messages: [{ role: 'user', content: 'x' }] })
  );
});

test('mergeAiUsage suma totales, tokens y modelos', () => {
  const a = { ...emptyAiUsage(), total_usd: 0.001, text_usd: 0.001, calls: 1, prompt_tokens: 10, by_model: { m: { calls: 1, usd: 0.001 } } };
  const b = { ...emptyAiUsage(), total_usd: 0.002, image_usd: 0.002, calls: 1, prompt_tokens: 5, missing_cost: true, by_model: { m: { calls: 2, usd: 0.002 } } };

  const merged = mergeAiUsage(a, b);
  assert.equal(merged.total_usd, 0.003);
  assert.equal(merged.text_usd, 0.001);
  assert.equal(merged.image_usd, 0.002);
  assert.equal(merged.calls, 2);
  assert.equal(merged.prompt_tokens, 15);
  assert.equal(merged.missing_cost, true);
  assert.deepEqual(merged.by_model, { m: { calls: 3, usd: 0.003 } });
});

test('mergeAiUsage tolera null (productos sin costo registrado)', () => {
  assert.deepEqual(mergeAiUsage(null, null), emptyAiUsage());
});
