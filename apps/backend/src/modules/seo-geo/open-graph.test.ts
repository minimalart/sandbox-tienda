import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeOpenGraph, OPEN_GRAPH_DEFAULTS } from './open-graph';

describe('normalizeOpenGraph', () => {
  it('sin nada guardado devuelve los defaults', () => {
    assert.deepEqual(normalizeOpenGraph(undefined), OPEN_GRAPH_DEFAULTS);
    assert.deepEqual(normalizeOpenGraph(null), OPEN_GRAPH_DEFAULTS);
    assert.deepEqual(normalizeOpenGraph('no es un objeto'), OPEN_GRAPH_DEFAULTS);
  });

  it('recorta los strings: un espacio no es un valor', () => {
    const og = normalizeOpenGraph({ title: '  Mercatto  ', description: '   ' });
    assert.equal(og.title, 'Mercatto');
    // Vacío = "usá el default del storefront", que es justo lo que hace falta acá.
    assert.equal(og.description, '');
  });

  it('descarta las URLs de imagen que no son http(s)', () => {
    assert.equal(normalizeOpenGraph({ image_url: 'javascript:alert(1)' }).image_url, '');
    assert.equal(normalizeOpenGraph({ image_url: 'data:image/png;base64,AAA' }).image_url, '');
    assert.equal(normalizeOpenGraph({ image_url: '/media/card.png' }).image_url, '');
    assert.equal(
      normalizeOpenGraph({ image_url: 'https://cdn.example.com/card.png' }).image_url,
      'https://cdn.example.com/card.png'
    );
  });

  it('la cuenta de X sale siempre con arroba', () => {
    assert.equal(normalizeOpenGraph({ twitter_site: 'mercatto' }).twitter_site, '@mercatto');
    assert.equal(normalizeOpenGraph({ twitter_site: '@mercatto' }).twitter_site, '@mercatto');
    assert.equal(normalizeOpenGraph({ twitter_site: '  ' }).twitter_site, '');
  });

  it('un formato de card inventado cae al default en vez de emitirse', () => {
    assert.equal(normalizeOpenGraph({ twitter_card: 'player' }).twitter_card, 'summary_large_image');
    assert.equal(normalizeOpenGraph({ twitter_card: 'summary' }).twitter_card, 'summary');
  });

  it('el locale vacío cae al default; uno cargado se respeta', () => {
    assert.equal(normalizeOpenGraph({ locale: '' }).locale, OPEN_GRAPH_DEFAULTS.locale);
    assert.equal(normalizeOpenGraph({ locale: 'pt_BR' }).locale, 'pt_BR');
  });

  it('ignora las claves de más en vez de propagarlas al head', () => {
    const og = normalizeOpenGraph({ title: 'X', inventada: 'valor' } as Record<string, unknown>);
    assert.deepEqual(Object.keys(og).sort(), Object.keys(OPEN_GRAPH_DEFAULTS).sort());
  });
});
