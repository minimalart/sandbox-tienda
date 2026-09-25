import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

import { getActiveFlow } from './cache';
import { unpublishFlowVersion } from './swap';
import { WHATSAPP_FLOW_MODULE } from './types';

/**
 * DESPUBLICAR: la única salida de `active`.
 *
 * Es SQL crudo dentro de una transacción, o sea la clase de código donde un error no
 * lo atrapa el compilador ni se nota hasta que alguien aprieta el botón y el bot sigue
 * atendiendo. Y lo que está en juego es lo mismo que en `publish`: qué grafo le
 * contesta al cliente que escribe en el próximo minuto.
 *
 * Se testea contra un knex de mentira porque lo que hay que afirmar no es que Postgres
 * funcione —eso ya lo sabemos— sino las cuatro decisiones que toma esta función: a qué
 * fila apunta, que la deje en `superseded`, que no escriba cuando no hay nada, y que
 * tire la caché. Esa última es la que hace que el botón se sienta instantáneo, y es
 * invisible en el SQL.
 */

type Call = { sql: string; bindings: unknown[] };

/** Un knex que anota lo que le piden y devuelve las filas que se le digan. */
function fakeKnex(rowsPorLlamada: Array<Array<Record<string, unknown>>>) {
  const calls: Call[] = [];
  let i = 0;
  const trx = {
    raw: async (sql: string, bindings: unknown[] = []) => {
      calls.push({ sql, bindings });
      return { rows: rowsPorLlamada[i++] ?? [] };
    },
  };
  const knex = {
    transaction: async <T>(handler: (t: typeof trx) => Promise<T>): Promise<T> => handler(trx),
  };
  return { knex, calls };
}

const containerCon = (knex: unknown): MedusaContainer =>
  ({
    resolve: (key: string) => {
      if (key === ContainerRegistrationKeys.PG_CONNECTION) return knex;
      throw new Error(`unexpected resolve(${key})`);
    },
  }) as unknown as MedusaContainer;

describe('despublicar una versión del grafo', () => {
  it('marca la activa como superseded y devuelve su id', async () => {
    const { knex, calls } = fakeKnex([[{ id: 'waflw_activa' }]]);
    const out = await unpublishFlowVersion(containerCon(knex), {
      flow_key: 'conversation',
      site_id: null,
    });

    assert.equal(out.unpublished_version_id, 'waflw_activa');
    assert.equal(calls.length, 2, 'tiene que haber un select y un update');
    assert.match(calls[1]!.sql, /status = 'superseded'/);
    assert.deepEqual(calls[1]!.bindings, ['waflw_activa']);
  });

  it('bloquea la fila antes de tocarla', async () => {
    // Sin el `for update`, dos operadores que aprietan a la vez —o uno que despublica
    // mientras otro publica— se pisan, y el índice único los rechaza con un error que
    // no dice nada. El lock es lo que los serializa.
    const { knex, calls } = fakeKnex([[{ id: 'waflw_activa' }]]);
    await unpublishFlowVersion(containerCon(knex), { flow_key: 'conversation', site_id: null });

    assert.match(calls[0]!.sql, /for update/);
    assert.match(calls[0]!.sql, /status = 'active'/);
    assert.match(calls[0]!.sql, /deleted_at is null/);
  });

  it('el recorrido GENERAL se encuentra con coalesce y no con `= null`', async () => {
    // `site_id = null` no matchea NULL en SQL: sin el coalesce, despublicar el general
    // no encontraría nada y devolvería "no había nada publicado" mientras el bot sigue
    // atendiendo. Es el mismo error que ya nos costó el mínimo de compra.
    const { knex, calls } = fakeKnex([[{ id: 'waflw_general' }]]);
    const out = await unpublishFlowVersion(containerCon(knex), {
      flow_key: 'conversation',
      site_id: null,
    });

    assert.match(calls[0]!.sql, /coalesce\(site_id, ''\) = coalesce\(\?, ''\)/);
    assert.deepEqual(calls[0]!.bindings, ['conversation', null]);
    assert.equal(out.unpublished_version_id, 'waflw_general');
  });

  it('apunta a la tienda que se le pide, no a la global', async () => {
    const { knex, calls } = fakeKnex([[{ id: 'waflw_de_la_tienda' }]]);
    await unpublishFlowVersion(containerCon(knex), {
      flow_key: 'conversation',
      site_id: 'site_a',
    });

    assert.deepEqual(calls[0]!.bindings, ['conversation', 'site_a']);
  });

  it('sin nada publicado devuelve null y NO escribe', async () => {
    // Apretar dos veces no puede ser un error, pero tampoco puede escribir: un UPDATE
    // sin fila que lo acote es cómo se despublica el recorrido de otra tienda.
    const { knex, calls } = fakeKnex([[]]);
    const out = await unpublishFlowVersion(containerCon(knex), {
      flow_key: 'conversation',
      site_id: null,
    });

    assert.equal(out.unpublished_version_id, null);
    assert.equal(calls.length, 1, 'no tiene que haber ningún update');
  });

  it('tira la caché: el bot NO sigue atendiendo con el grafo apagado', async () => {
    /**
     * La afirmación que justifica el test entero.
     *
     * `getActiveFlow` cachea 30 s. Si despublicar no invalidara, el operador vería la
     * pantalla apagada y el bot seguiría contestando medio minuto — o sea, justo el
     * síntoma que el botón viene a resolver. Se verifica por el COMPORTAMIENTO (que la
     * segunda lectura vuelva a ir al módulo) y no espiando la función.
     */
    let lecturas = 0;
    const servicio = {
      getActiveVersion: async () => {
        lecturas += 1;
        return {
          id: 'waflw_activa',
          graph: { nodes: [{ id: 'n1', type: 'start' }], edges: [] },
          metadata: null,
        };
      },
    };
    const { knex } = fakeKnex([[{ id: 'waflw_activa' }]]);
    const container = {
      resolve: (key: string) => {
        if (key === WHATSAPP_FLOW_MODULE) return servicio;
        if (key === ContainerRegistrationKeys.PG_CONNECTION) return knex;
        throw new Error(`unexpected resolve(${key})`);
      },
    } as unknown as MedusaContainer;

    await getActiveFlow(container, 'conversation', null);
    await getActiveFlow(container, 'conversation', null);
    assert.equal(lecturas, 1, 'la segunda lectura tendría que salir de la caché');

    await unpublishFlowVersion(container, { flow_key: 'conversation', site_id: null });

    await getActiveFlow(container, 'conversation', null);
    assert.equal(lecturas, 2, 'después de despublicar la caché tiene que estar vacía');
  });
});
