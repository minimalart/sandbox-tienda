import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { botSilenciado, mergeBotSwitch, readBotSwitch, writeBotSwitch } from './bot-switch';

/**
 * El parser es la única decisión de este archivo, y decide si el bot contesta. Se
 * testea porque el modo de falla es MUDO: un dato torcido que se leyera como
 * apagado deja el número sin respuestas y nada en la pantalla lo delata.
 */
describe('el interruptor del bot', () => {
  it('sin fila, el bot contesta', () => {
    // Una instalación que nunca abrió la pantalla se comporta como antes.
    assert.deepEqual(mergeBotSwitch(undefined), { enabled: true, note: null });
  });

  it('sólo un false explícito lo apaga', () => {
    assert.equal(mergeBotSwitch({ enabled: false }).enabled, false);
    assert.equal(mergeBotSwitch({ enabled: 'false' }).enabled, false);
  });

  it('un dato torcido NO apaga el bot', () => {
    // Fail-open: un jsonb a medio migrar, un null o un string suelto dejan el bot
    // andando. Al revés el síntoma sería silencio, indistinguible de una caída.
    for (const raw of [null, 'nada', 42, { enabled: null }, { enabled: 'si' }, {}]) {
      assert.equal(mergeBotSwitch(raw).enabled, true, `no debería apagar con ${JSON.stringify(raw)}`);
    }
  });

  it('la nota se recorta y el vacío es null', () => {
    assert.equal(mergeBotSwitch({ note: '   ' }).note, null);
    assert.equal(mergeBotSwitch({ note: '  a medio hacer  ' }).note, 'a medio hacer');
    assert.equal(mergeBotSwitch({ note: 'x'.repeat(400) }).note?.length, 280);
  });

  it('lee la fila de la tienda por readSetting', async () => {
    const reader = {
      readSetting: async (key: string, siteId?: string | null) => {
        assert.equal(key, 'whatsapp_bot_switch');
        assert.equal(siteId, 'site_a');
        return { value: { enabled: false, note: 'en armado' } };
      },
    };
    assert.deepEqual(await readBotSwitch(reader, 'site_a'), { enabled: false, note: 'en armado' });
  });

  it('acepta el valor guardado como string JSON', async () => {
    const reader = { readSetting: async () => ({ value: '{"enabled":false}' }) };
    assert.equal((await readBotSwitch(reader)).enabled, false);
  });

  it('guarda el objeto completo, no un patch', async () => {
    let guardado: unknown = null;
    const writer = {
      readSetting: async () => undefined,
      upsertSetting: async (_key: string, value: unknown) => {
        guardado = value;
        return value;
      },
    };
    await writeBotSwitch(writer, { enabled: false }, 'site_a');
    // `note` viaja aunque no se haya mandado: una fila a medio escribir sería un
    // objeto sin la clave, y el parser tendría que adivinar.
    assert.deepEqual(guardado, { enabled: false, note: null });
  });
});

/**
 * La lectura del RUNTIME. Es otra pregunta que la de la pantalla, y mezclarlas fue el
 * bug: la pantalla mostraba Apagado y el bot contestaba, porque el apagado vivía en la
 * fila de una tienda y el webhook —sin `?site=`— sólo miraba la global.
 */
describe('¿el bot está silenciado? (runtime, falla cerrado)', () => {
  const lister = (rows: Array<{ site_id: string | null; value: unknown }>) => ({
    listStoreSettings: async ({ key }: { key: string }) => {
      assert.equal(key, 'whatsapp_bot_switch');
      return rows;
    },
  });

  it('sin filas, el bot habla', async () => {
    assert.equal(await botSilenciado(lister([]), null), false);
  });

  it('la fila global apaga a todas las tiendas', async () => {
    const rows = [{ site_id: null, value: { enabled: false } }];
    assert.equal(await botSilenciado(lister(rows), 'site_a'), true);
    assert.equal(await botSilenciado(lister(rows), null), true);
  });

  it('EL BUG: la fila de una tienda apaga aunque el webhook no sepa de qué tienda es', async () => {
    // Es el caso exacto que se escapó. La pantalla guardó con `x-site-id`, el webhook
    // llegó sin `?site=`, y `readSetting(key, null)` sólo miraba la global.
    const rows = [{ site_id: 'site_a', value: { enabled: false } }];
    assert.equal(await botSilenciado(lister(rows), null), true);
  });

  it('la fila de una tienda apaga a esa tienda', async () => {
    const rows = [{ site_id: 'site_a', value: { enabled: false } }];
    assert.equal(await botSilenciado(lister(rows), 'site_a'), true);
  });

  it('pero NO apaga a otra tienda conocida', async () => {
    // Con la tienda resuelta no hay ambigüedad, así que no hay por qué exagerar.
    const rows = [{ site_id: 'site_a', value: { enabled: false } }];
    assert.equal(await botSilenciado(lister(rows), 'site_b'), false);
  });

  it('una fila encendida no reenciende lo que otra apagó', async () => {
    const rows = [
      { site_id: null, value: { enabled: true } },
      { site_id: 'site_a', value: { enabled: false } },
    ];
    assert.equal(await botSilenciado(lister(rows), 'site_a'), true);
  });

  it('un dato torcido NO apaga: eso sigue fallando abierto', async () => {
    // La simetría importa: un jsonb roto no puede dejar el número mudo, porque el
    // síntoma es indistinguible de un apagado a propósito y nadie lo diagnostica.
    const rows = [{ site_id: null, value: 'basura' }, { site_id: 'site_a', value: null }];
    assert.equal(await botSilenciado(lister(rows), null), false);
  });
});
