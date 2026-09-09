import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyChannelProduct,
  countAdoptedChannelProducts,
  type ChannelProductRow,
} from './link-from-sales-channel.ts';

const SOURCE = 'sc_origen';
const TARGET = 'sc_demo';

const opts = { sourceSalesChannelId: SOURCE, targetSalesChannelId: TARGET, currencyCode: 'ars' };

const row = (over: Partial<ChannelProductRow> = {}): ChannelProductRow => ({
  id: 'prod_1',
  sales_channels: [{ id: SOURCE }],
  variants: [{ prices: [{ currency_code: 'ars', amount: 2526.12 }] }],
  ...over,
});

describe('classifyChannelProduct', () => {
  it('reconoce un producto del canal de origen todavía sin vincular', () => {
    const verdict = classifyChannelProduct(row(), opts);
    assert.deepEqual(verdict, { inSource: true, alreadyLinked: false, hasPriceInCurrency: true });
  });

  it('un producto de otro canal no es del origen', () => {
    const verdict = classifyChannelProduct(row({ sales_channels: [{ id: 'sc_ajeno' }] }), opts);
    assert.equal(verdict.inSource, false);
  });

  it('detecta el ya vinculado (re-import idempotente)', () => {
    const verdict = classifyChannelProduct(
      row({ sales_channels: [{ id: SOURCE }, { id: TARGET }] }),
      opts,
    );
    assert.equal(verdict.inSource, true);
    assert.equal(verdict.alreadyLinked, true);
  });

  it('tolera sales_channels nulo o con huecos', () => {
    assert.equal(classifyChannelProduct(row({ sales_channels: null }), opts).inSource, false);
    assert.equal(
      classifyChannelProduct(row({ sales_channels: [null, { id: SOURCE }] }), opts).inSource,
      true,
    );
  });

  it('la moneda se compara sin importar el caso', () => {
    const verdict = classifyChannelProduct(
      row({ variants: [{ prices: [{ currency_code: 'ARS', amount: 100 }] }] }),
      opts,
    );
    assert.equal(verdict.hasPriceInCurrency, true);
  });

  it('precio en otra moneda no cuenta como precio en la de la demo', () => {
    const verdict = classifyChannelProduct(
      row({ variants: [{ prices: [{ currency_code: 'usd', amount: 100 }] }] }),
      opts,
    );
    assert.equal(verdict.inSource, true);
    assert.equal(verdict.hasPriceInCurrency, false);
  });

  it('precio 0 o ausente no cuenta (el producto no sería comprable)', () => {
    assert.equal(
      classifyChannelProduct(row({ variants: [{ prices: [{ currency_code: 'ars', amount: 0 }] }] }), opts)
        .hasPriceInCurrency,
      false,
    );
    assert.equal(
      classifyChannelProduct(row({ variants: [{ prices: [] }] }), opts).hasPriceInCurrency,
      false,
    );
    assert.equal(
      classifyChannelProduct(row({ variants: null }), opts).hasPriceInCurrency,
      false,
    );
  });

  it('con canal adoptado (origen === destino) el producto cuenta como ya vinculado', () => {
    const verdict = classifyChannelProduct(row(), {
      sourceSalesChannelId: SOURCE,
      targetSalesChannelId: SOURCE,
      currencyCode: 'ars',
    });
    assert.equal(verdict.inSource, true);
    assert.equal(verdict.alreadyLinked, true);
  });

  it('alcanza que UNA variante tenga precio en la moneda', () => {
    const verdict = classifyChannelProduct(
      row({
        variants: [
          { prices: [{ currency_code: 'usd', amount: 50 }] },
          { prices: [{ currency_code: 'ars', amount: 999 }] },
        ],
      }),
      opts,
    );
    assert.equal(verdict.hasPriceInCurrency, true);
  });
});

/**
 * Container mínimo: solo el `query.graph` paginado que usa el contador. Devuelve las
 * filas de a `take` para ejercitar también la paginación.
 */
const containerWith = (rows: ChannelProductRow[]) => ({
  resolve: (key: string) => {
    assert.equal(key, 'query');
    return {
      graph: async ({ pagination }: { pagination: { skip: number; take: number } }) => ({
        data: rows.slice(pagination.skip, pagination.skip + pagination.take),
      }),
    };
  },
});

describe('countAdoptedChannelProducts', () => {
  const channelRow = (id: string, over: Partial<ChannelProductRow> = {}): ChannelProductRow => ({
    id,
    sales_channels: [{ id: SOURCE }],
    variants: [{ prices: [{ currency_code: 'ars', amount: 1500 }] }],
    ...over,
  });

  it('cuenta el catálogo del canal sin vincular ni crear nada', async () => {
    const result = await countAdoptedChannelProducts(containerWith([
      channelRow('prod_1'),
      channelRow('prod_2'),
      channelRow('prod_ajeno', { sales_channels: [{ id: 'sc_otro' }] }),
    ]), { salesChannelId: SOURCE, currencyCode: 'ars' });

    assert.equal(result.sourceProducts, 2);
    // Ya están donde tienen que estar: no hay nada que vincular.
    assert.equal(result.alreadyLinked, 2);
    assert.equal(result.linkedExisting, 0);
    assert.equal(result.created, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.stockLocationsLinked, 0);
  });

  it('avisa cuántos productos no tienen precio en la moneda de la demo', async () => {
    const result = await countAdoptedChannelProducts(containerWith([
      channelRow('prod_1'),
      channelRow('prod_2', { variants: [{ prices: [{ currency_code: 'usd', amount: 10 }] }] }),
    ]), { salesChannelId: SOURCE, currencyCode: 'ARS' });

    assert.equal(result.sourceProducts, 2);
    assert.equal(result.withoutPriceInCurrency, 1);
  });

  it('un canal vacío no rompe', async () => {
    const result = await countAdoptedChannelProducts(containerWith([]), {
      salesChannelId: SOURCE,
      currencyCode: 'ars',
    });
    assert.equal(result.sourceProducts, 0);
    assert.deepEqual(result.errors, []);
  });
});
