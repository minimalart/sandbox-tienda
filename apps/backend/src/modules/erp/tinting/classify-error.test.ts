import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTintingError } from './classify-error.ts';
import { resolveTintingListIndex } from './resolve-list-index.ts';
import {
  ErpAuthError,
  ErpConnectionError,
  ErpNonRetryableError,
  ErpTintingFormulaNotFoundError,
} from '../adapters/types.ts';
import type { ErpConfigSettings } from '../types.ts';

const query = { base_code: '113', formula_code: '00NN 16/000' };

describe('classifyTintingError', () => {
  it('mapea el 409 de fórmula inexistente a su propio error', () => {
    // Mensaje real del ERP (medido).
    const raw = new ErpNonRetryableError(
      'Zeus 409: {"status":"CONFLICT","errors":[{"message":"La fórmula 00NN 16/000 no existe en Zeus Gestión."}]}'
    );
    const mapped = classifyTintingError(raw, query);
    assert.ok(mapped instanceof ErpTintingFormulaNotFoundError);
    assert.equal((mapped as ErpTintingFormulaNotFoundError).formulaCode, '00NN 16/000');
    assert.equal((mapped as ErpTintingFormulaNotFoundError).baseCode, '113');
  });

  it('la fórmula inexistente SIGUE siendo no reintentable (contrato del outbox)', () => {
    const mapped = classifyTintingError(new ErpNonRetryableError('la fórmula X no existe'), query);
    assert.ok(mapped instanceof ErpNonRetryableError);
  });

  it('deja pasar auth y conexión sin tocarlos', () => {
    const auth = new ErpAuthError('401');
    assert.equal(classifyTintingError(auth, query), auth);
    const conn = new ErpConnectionError('timeout');
    assert.equal(classifyTintingError(conn, query), conn);
  });

  it('un 400 de parámetro faltante queda como no reintentable, no como fórmula inexistente', () => {
    const mapped = classifyTintingError(
      new ErpNonRetryableError('Zeus 400: {"message":"Falta el parámetro: codBase"}'),
      query
    );
    assert.ok(mapped instanceof ErpNonRetryableError);
    assert.ok(!(mapped instanceof ErpTintingFormulaNotFoundError));
  });

  it('envuelve cualquier cosa que no sea Error', () => {
    const mapped = classifyTintingError('se rompió', query);
    assert.ok(mapped instanceof ErpNonRetryableError);
    assert.match(mapped.message, /se rompió/);
  });
});

describe('resolveTintingListIndex', () => {
  const settings: ErpConfigSettings = {
    catalog_sync: {
      base_list_index: 1,
      price_lists: [
        { zeus_index: 4, title: 'Mayorista', customer_group_id: 'cusgroup_wholesale' },
        { zeus_index: 2, title: 'Deshabilitada', customer_group_id: 'cusgroup_x', enabled: false },
      ],
    },
  };

  it('usa la lista del grupo del cliente cuando aplica', () => {
    // Medido: lista 4 devuelve 46446.975 = 0.70 × lista 1, igual que precio4/precio1.
    assert.deepEqual(resolveTintingListIndex(settings, ['cusgroup_wholesale']), {
      list_index: 4,
      source: 'price_list',
      price_list_title: 'Mayorista',
    });
  });

  it('cae a la lista base sin grupo, o con un grupo sin mapeo', () => {
    assert.equal(resolveTintingListIndex(settings, []).list_index, 1);
    assert.equal(resolveTintingListIndex(settings, ['cusgroup_otro']).source, 'base_list');
  });

  it('ignora los mapeos deshabilitados', () => {
    assert.equal(resolveTintingListIndex(settings, ['cusgroup_x']).list_index, 1);
  });

  it('sin settings usa el default del catalog sync (1, no 0: precio0 está vacío)', () => {
    assert.equal(resolveTintingListIndex({}, []).list_index, 1);
    assert.equal(resolveTintingListIndex({ catalog_sync: {} }, ['cusgroup_wholesale']).list_index, 1);
  });
});
