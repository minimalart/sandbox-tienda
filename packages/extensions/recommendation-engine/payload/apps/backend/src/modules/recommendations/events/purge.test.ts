import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { __testing } from './purge';

const { deleteInBatches } = __testing;

/**
 * Tamaño de lote FIJO del test, y ya no el de la configuración.
 *
 * Desde que el lote se resuelve por corrida contra `app-settings`, atarlo acá al
 * valor efectivo haría que estos casos midan la config del entorno en vez de la
 * lógica de corte. Lo que se verifica es la relación entre `affected` y el lote
 * pedido, y esa relación no depende del número.
 */
const BATCH_SIZE = 5000;

/** Knex de mentira que devuelve una cantidad de filas por llamada. */
const fakeKnex = (affectedPerCall: number[]) => {
  let call = 0;
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  return {
    calls,
    raw: async (sql: string, bindings: unknown[] = []) => {
      calls.push({ sql, bindings });
      const affected = affectedPerCall[call] ?? 0;
      call++;
      return { rows: Array.from({ length: affected }, (_, i) => ({ id: `row_${i}` })) };
    },
  };
};

describe('deleteInBatches', () => {
  it('para cuando un lote vuelve incompleto', () => {
    // Un lote incompleto significa que no queda nada más que borrar: seguir sería
    // gastar queries al vacío.
    const knex = fakeKnex([BATCH_SIZE, 12]);
    return deleteInBatches(knex, 'delete ...', [], { remaining: 10 }, BATCH_SIZE).then((result) => {
      assert.equal(result.deleted, BATCH_SIZE + 12);
      assert.equal(result.batches, 2);
      assert.equal(result.truncated, false);
      assert.equal(knex.calls.length, 2);
    });
  });

  it('no consulta si no hay presupuesto', async () => {
    const knex = fakeKnex([BATCH_SIZE]);
    const result = await deleteInBatches(knex, 'delete ...', [], { remaining: 0 }, BATCH_SIZE);
    assert.equal(result.deleted, 0);
    assert.equal(result.truncated, true);
    assert.equal(knex.calls.length, 0);
  });

  it('corta al agotar el presupuesto y avisa que quedó pendiente', async () => {
    // El tope por corrida es lo que evita que una purga larga tome locks durante
    // minutos en un contenedor de 1 vCPU.
    const knex = fakeKnex([BATCH_SIZE, BATCH_SIZE, BATCH_SIZE]);
    const result = await deleteInBatches(knex, 'delete ...', [], { remaining: 2 }, BATCH_SIZE);
    assert.equal(result.batches, 2);
    assert.equal(result.deleted, BATCH_SIZE * 2);
    assert.equal(result.truncated, true);
  });

  it('un primer lote vacío termina en una sola query', async () => {
    const knex = fakeKnex([0]);
    const result = await deleteInBatches(knex, 'delete ...', [], { remaining: 20 }, BATCH_SIZE);
    assert.equal(result.deleted, 0);
    assert.equal(result.batches, 1);
    assert.equal(result.truncated, false);
  });

  it('el presupuesto se comparte entre llamadas', async () => {
    // Los tres borrados de una corrida comparten el mismo tope: el objetivo es acotar
    // el trabajo TOTAL del tick, no el de cada tabla por separado.
    const budget = { remaining: 3 };
    // El segundo lote vuelve incompleto, así que el primer borrado consume 2 y corta.
    const first = fakeKnex([BATCH_SIZE, 5]);
    await deleteInBatches(first, 'delete a', [], budget, BATCH_SIZE);
    assert.equal(budget.remaining, 1);
    const second = fakeKnex([BATCH_SIZE, BATCH_SIZE]);
    const result = await deleteInBatches(second, 'delete b', [], budget, BATCH_SIZE);
    assert.equal(result.batches, 1);
    assert.equal(result.truncated, true);
    assert.equal(budget.remaining, 0);
  });

  it('cuenta por rowCount cuando el driver no devuelve rows', async () => {
    const knex = { raw: async () => ({ rowCount: 7 }) };
    const result = await deleteInBatches(knex, 'delete ...', [], { remaining: 5 }, BATCH_SIZE);
    assert.equal(result.deleted, 7);
    assert.equal(result.truncated, false);
  });
});
