import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedTexts, embedText, EmbeddingAiError } from './embedding-client.ts';

function withEnv(fn: () => Promise<void>): Promise<void> {
  const origFetch = globalThis.fetch;
  const origKey = process.env.OPENROUTER_API_KEY;
  const origDims = process.env.EMBEDDINGS_DIMENSIONS;
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.EMBEDDINGS_DIMENSIONS = '3';
  return fn().finally(() => {
    globalThis.fetch = origFetch;
    if (origKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = origKey;
    if (origDims === undefined) delete process.env.EMBEDDINGS_DIMENSIONS;
    else process.env.EMBEDDINGS_DIMENSIONS = origDims;
  });
}

test('embedTexts: devuelve un vector por texto y respeta el orden por index', async () => {
  await withEnv(async () => {
    // Respuesta desordenada a propósito: el cliente debe re-ordenar por `index`.
    const payload = {
      data: [
        { index: 1, embedding: [0.4, 0.5, 0.6] },
        { index: 0, embedding: [0.1, 0.2, 0.3] },
      ],
      model: 'openai/text-embedding-3-small',
    };
    globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as any;

    const vecs = await embedTexts(['a', 'b']);
    assert.equal(vecs.length, 2);
    assert.deepEqual(vecs[0], [0.1, 0.2, 0.3]);
    assert.deepEqual(vecs[1], [0.4, 0.5, 0.6]);
  });
});

test('embedText: devuelve un solo vector', async () => {
  await withEnv(async () => {
    const payload = { data: [{ index: 0, embedding: [1, 2, 3] }] };
    globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as any;
    const vec = await embedText('hola');
    assert.deepEqual(vec, [1, 2, 3]);
  });
});

test('embedTexts: dimensionGuard tira si la dimensión no coincide', async () => {
  await withEnv(async () => {
    const payload = { data: [{ index: 0, embedding: [1, 2] }] }; // 2 dims, se esperan 3
    globalThis.fetch = (async () => new Response(JSON.stringify(payload), { status: 200 })) as any;
    await assert.rejects(() => embedTexts(['x']), EmbeddingAiError);
  });
});

test('embedTexts: array vacío no llama al proveedor', async () => {
  await withEnv(async () => {
    globalThis.fetch = (async () => {
      throw new Error('no debería llamarse');
    }) as any;
    const vecs = await embedTexts([]);
    assert.deepEqual(vecs, []);
  });
});
