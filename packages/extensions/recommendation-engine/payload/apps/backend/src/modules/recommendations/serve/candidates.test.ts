import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { __testing, loadCandidates, type CandidateTier } from './candidates';

const { buildTierClauses, placeholders } = __testing;

/** Knex de mentira que captura el SQL y los bindings, y devuelve filas fijas. */
const fakeKnex = (rows: unknown[] = []) => {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  return {
    calls,
    raw: async (sql: string, bindings: unknown[] = []) => {
      calls.push({ sql, bindings });
      return { rows };
    },
  };
};

const manual = (key = 'manual'): CandidateTier => ({
  strategy_key: key,
  version_id: null,
  is_manual: true,
});

const versioned = (key: string, versionId: string | null): CandidateTier => ({
  strategy_key: key,
  version_id: versionId,
  is_manual: false,
});

describe('placeholders', () => {
  it('genera un ? por elemento', () => {
    assert.equal(placeholders(1), '?');
    assert.equal(placeholders(3), '?, ?, ?');
  });
});

describe('buildTierClauses', () => {
  it('el tier manual filtra por version_id null', () => {
    const { sql, bindings } = buildTierClauses([manual()], null);
    assert.equal(sql, '(r.strategy_key = ? and r.version_id is null)');
    assert.deepEqual(bindings, ['manual']);
  });

  it('aplica relation_types SOLO al tier manual', () => {
    // `relation_types` del placement expresa qué relaciones CARGADAS A MANO levanta;
    // en las automáticas el tipo lo pone el algoritmo, así que filtrarlas ahí
    // vaciaría el tier (ej. `bought_together` en un placement de complementarios).
    const { sql, bindings } = buildTierClauses(
      [manual(), versioned('similar', 'recver_1')],
      ['complementary', 'accessory'],
    );
    assert.equal(
      sql,
      '(r.strategy_key = ? and r.version_id is null and r.relation_type in (?, ?)) or (r.strategy_key = ? and r.version_id = ?)',
    );
    assert.deepEqual(bindings, ['manual', 'complementary', 'accessory', 'similar', 'recver_1']);
  });

  it('ignora relation_types vacío', () => {
    const { sql } = buildTierClauses([manual()], []);
    assert.equal(sql, '(r.strategy_key = ? and r.version_id is null)');
  });

  it('saltea estrategias automáticas sin versión activa', () => {
    // Sin versión activa no hay nada calculado: pedirla sólo agrega una cláusula
    // que no puede matchear.
    const { sql, bindings } = buildTierClauses(
      [versioned('fbt', null), versioned('popular', 'recver_9')],
      null,
    );
    assert.equal(sql, '(r.strategy_key = ? and r.version_id = ?)');
    assert.deepEqual(bindings, ['popular', 'recver_9']);
  });

  it('devuelve vacío cuando ningún tier es pedible', () => {
    assert.equal(buildTierClauses([versioned('fbt', null)], null).sql, '');
    assert.equal(buildTierClauses([], null).sql, '');
  });

  it('encadena varios tiers con OR', () => {
    const { sql } = buildTierClauses(
      [manual(), versioned('similar', 'v1'), versioned('popular', 'v2')],
      null,
    );
    assert.equal(sql.split(' or ').length, 3);
  });
});

describe('loadCandidates', () => {
  it('no consulta cuando no hay origen o no hay tiers', async () => {
    const knex = fakeKnex();
    assert.deepEqual(await loadCandidates(knex, { sources: [], tiers: [manual()], candidate_limit: 30 }), []);
    assert.deepEqual(await loadCandidates(knex, { sources: ['prod_1'], tiers: [], candidate_limit: 30 }), []);
    assert.equal(knex.calls.length, 0);
  });

  it('no consulta cuando ningún tier tiene versión activa', async () => {
    const knex = fakeKnex();
    const result = await loadCandidates(knex, {
      sources: ['prod_1'],
      tiers: [versioned('fbt', null)],
      candidate_limit: 30,
    });
    assert.deepEqual(result, []);
    assert.equal(knex.calls.length, 0);
  });

  it('particiona por estrategia y recorta al candidate_limit', async () => {
    // El particionado es lo que permite traer los candidatos de TODA la cadena en
    // una sola query: sin él, probar el fallback costaría otro round trip.
    const knex = fakeKnex();
    await loadCandidates(knex, {
      sources: ['prod_1', '__global__'],
      tiers: [manual(), versioned('popular', 'v2')],
      sales_channel_id: 'sc_main',
      candidate_limit: 30,
    });
    const call = knex.calls[0];
    assert.ok(call);
    assert.match(call.sql, /partition by r\.strategy_key/);
    assert.match(call.sql, /where rn <= \?/);
    assert.equal(call.bindings.at(-1), 30);
    assert.deepEqual(call.bindings.slice(0, 3), ['prod_1', '__global__', 'sc_main']);
  });

  it('filtra borrados, inactivas y vigencia', async () => {
    const knex = fakeKnex();
    await loadCandidates(knex, { sources: ['prod_1'], tiers: [manual()], candidate_limit: 10 });
    const sql = knex.calls[0]?.sql ?? '';
    assert.match(sql, /r\.deleted_at is null/);
    assert.match(sql, /r\.is_active = true/);
    assert.match(sql, /r\.valid_from is null or r\.valid_from <= now\(\)/);
    assert.match(sql, /r\.valid_until is null or r\.valid_until >= now\(\)/);
    assert.match(sql, /r\.sales_channel_id is null or r\.sales_channel_id = \?/);
  });

  it('acota el candidate_limit a un entero positivo', async () => {
    const knex = fakeKnex();
    await loadCandidates(knex, { sources: ['p'], tiers: [manual()], candidate_limit: 0 });
    assert.equal(knex.calls[0]?.bindings.at(-1), 1);
    await loadCandidates(knex, { sources: ['p'], tiers: [manual()], candidate_limit: 12.7 });
    assert.equal(knex.calls[1]?.bindings.at(-1), 12);
  });

  it('normaliza los numéricos que Postgres devuelve como string', async () => {
    // `numeric`/`real` vuelven como string por el driver: sin normalizar, el ranking
    // compararía strings y ordenaría "10" antes que "9".
    const knex = fakeKnex([
      {
        target_product_id: 'prod_a',
        strategy_key: 'manual',
        relation_type: 'complementary',
        priority: '5',
        score: '0.42',
        confidence: '0.31',
        co_occurrences: '12',
        version_id: null,
      },
    ]);
    const [candidate] = await loadCandidates(knex, {
      sources: ['prod_1'],
      tiers: [manual()],
      candidate_limit: 10,
    });
    assert.ok(candidate);
    assert.equal(candidate.priority, 5);
    assert.equal(candidate.score, 0.42);
    assert.equal(candidate.confidence, 0.31);
    assert.equal(candidate.co_occurrences, 12);
  });

  it('mapea nulls de evidencia a null y no a 0', async () => {
    // 0 co-ocurrencias y "sin dato" son cosas distintas: el ranking manda los null
    // al final, y un 0 los pondría empatados con evidencia real de cero.
    const knex = fakeKnex([
      {
        target_product_id: 'prod_a',
        strategy_key: 'manual',
        relation_type: 'similar',
        priority: 0,
        score: 0,
        confidence: null,
        co_occurrences: null,
        version_id: null,
      },
    ]);
    const [candidate] = await loadCandidates(knex, {
      sources: ['prod_1'],
      tiers: [manual()],
      candidate_limit: 10,
    });
    assert.equal(candidate?.confidence, null);
    assert.equal(candidate?.co_occurrences, null);
  });

  it('tolera una respuesta sin filas', async () => {
    const knex = { raw: async () => ({}) as { rows: unknown[] } };
    assert.deepEqual(
      await loadCandidates(knex as never, {
        sources: ['p'],
        tiers: [manual()],
        candidate_limit: 5,
      }),
      [],
    );
  });
});
