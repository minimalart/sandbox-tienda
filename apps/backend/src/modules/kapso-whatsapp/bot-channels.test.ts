import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeBotChannelsConfig,
  normalizeChannelIds,
  WHATSAPP_BOT_CHANNELS_DEFAULTS,
} from './bot-channels';

/**
 * El ORDEN es semántico: el primer canal es el de los pedidos. Por eso la
 * normalización no puede ordenar ni deduplicar de forma que lo altere.
 */
describe('normalizeChannelIds', () => {
  test('preserva el orden (el primero es el canal del pedido)', () => {
    assert.deepEqual(normalizeChannelIds(['sc_b', 'sc_a']), ['sc_b', 'sc_a']);
  });

  test('saca duplicados conservando la PRIMERA aparición', () => {
    assert.deepEqual(normalizeChannelIds(['sc_a', 'sc_b', 'sc_a']), ['sc_a', 'sc_b']);
  });

  test('descarta vacíos y recorta espacios', () => {
    assert.deepEqual(normalizeChannelIds(['  sc_a  ', '', '   ', 'sc_b']), ['sc_a', 'sc_b']);
  });

  test('tolera texto separado por coma', () => {
    assert.deepEqual(normalizeChannelIds('sc_a,sc_b'), ['sc_a', 'sc_b']);
  });

  test('tolera basura sin explotar', () => {
    assert.deepEqual(normalizeChannelIds(null), []);
    assert.deepEqual(normalizeChannelIds(undefined), []);
    assert.deepEqual(normalizeChannelIds({}), []);
    assert.deepEqual(normalizeChannelIds(42), []);
  });

  test('corta en el tope de 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => `sc_${i}`);
    assert.equal(normalizeChannelIds(many).length, 10);
  });
});

describe('mergeBotChannelsConfig', () => {
  test('sin nada guardado devuelve la lista vacía (= sin configurar)', () => {
    assert.deepEqual(mergeBotChannelsConfig(null), WHATSAPP_BOT_CHANNELS_DEFAULTS);
    assert.deepEqual(mergeBotChannelsConfig({}), { sales_channel_ids: [] });
  });

  test('la lista vacía es un valor VÁLIDO, no un dato faltante', () => {
    // Deseleccionar el último canal tiene que poder dejarla vacía: eso significa
    // "volver al canal por defecto", y un merge que la ignorara la dejaría
    // pegada para siempre.
    assert.deepEqual(mergeBotChannelsConfig({ sales_channel_ids: [] }), {
      sales_channel_ids: [],
    });
  });

  test('normaliza lo que venga guardado', () => {
    assert.deepEqual(
      mergeBotChannelsConfig({ sales_channel_ids: ['sc_a', 'sc_a', ' sc_b '] }),
      { sales_channel_ids: ['sc_a', 'sc_b'] },
    );
  });
});
