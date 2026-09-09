import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { logWaEvent } from './events';

type Row = Record<string, unknown>;

/** Contenedor mínimo: sólo tiene que resolver el módulo del event log. */
function fakeContainer(rows: Row[], opts: { throwOnWrite?: boolean } = {}) {
  return {
    resolve: (key: string) => {
      if (key === 'whatsappEventLog') {
        return {
          createWhatsappEvents: async (data: Row) => {
            if (opts.throwOnWrite) throw new Error('DB caída');
            rows.push(data);
          },
        };
      }
      // El logger del catch.
      return { debug: () => {}, info: () => {}, error: () => {} };
    },
  } as never;
}

describe('logWaEvent', () => {
  it('escribe la sesión y la tienda: sin eso el evento queda huérfano del embudo', async () => {
    const rows: Row[] = [];
    await logWaEvent(fakeContainer(rows), {
      phone: '5492944000000',
      type: 'inbound',
      sessionId: '5492944000000-1757000000000',
      siteId: 'site_01',
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].session_id, '5492944000000-1757000000000');
    assert.equal(rows[0].site_id, 'site_01');
  });

  it('numera los eventos en orden de EMISIÓN, no de escritura', async () => {
    // El caso real: varios eventos de un mismo turno se emiten sin await y caen en
    // el mismo milisegundo. Ordenar por `created_at` devolvía las decisiones del
    // bot invertidas; `seq` es lo que las desempata.
    const rows: Row[] = [];
    const container = fakeContainer(rows);
    const base = { phone: '5492944000000', sessionId: 's1' } as const;

    await Promise.all([
      logWaEvent(container, { ...base, type: 'inbound' }),
      logWaEvent(container, { ...base, type: 'menu_shown' }),
      logWaEvent(container, { ...base, type: 'search' }),
    ]);

    const seqs = rows.map((r) => r.seq as number);
    assert.equal(seqs.length, 3);
    assert.deepEqual([...seqs].sort((a, b) => a - b), seqs, 'los seq no son crecientes');
    assert.equal(new Set(seqs).size, 3, 'hay seq repetidos');
  });

  it('nunca voltea el turno: una falla al escribir se traga', async () => {
    // La analítica no puede tumbar una venta. Si esto lanza, el webhook muere.
    const rows: Row[] = [];
    await assert.doesNotReject(
      logWaEvent(fakeContainer(rows, { throwOnWrite: true }), {
        phone: '5492944000000',
        type: 'error',
      }),
    );
    assert.equal(rows.length, 0);
  });
});
