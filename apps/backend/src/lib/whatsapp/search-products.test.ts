import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  displayTitle,
  getWaVariantDetail,
  isInBotChannels,
  listWaPinnedProducts,
} from './search-products';
import type { WaOrderContext } from './order-context';

// ─── La regla, sola ───────────────────────────────────────────────────────────

describe('isInBotChannels', () => {
  it('deja pasar lo que está en alguno de los canales del bot', () => {
    assert.equal(isInBotChannels(['sc_web', 'sc_wa'], ['sc_wa']), true);
  });

  it('frena lo que no está en ninguno', () => {
    assert.equal(isInBotChannels(['sc_web'], ['sc_wa']), false);
  });

  it('frena un producto sin ningún canal', () => {
    assert.equal(isInBotChannels([], ['sc_wa']), false);
  });

  it('SIN canales configurados, CIERRA la puerta', () => {
    // Falla cerrado a propósito. Un contexto que no pudo resolver sus canales
    // abriendo el catálogo entero es el gate de promociones otra vez: nadie se
    // entera hasta que alguien compra lo que no tenía que poder comprar.
    assert.equal(isInBotChannels(['sc_web'], []), false);
  });

  it('ignora ids nulos que devuelva la consulta', () => {
    assert.equal(isInBotChannels([null, undefined, 'sc_wa'], ['sc_wa']), true);
    assert.equal(isInBotChannels([null, undefined], ['sc_wa']), false);
  });
});

// ─── El gate, sobre la consulta ───────────────────────────────────────────────

const ctx = (over: Partial<WaOrderContext> = {}): WaOrderContext => ({
  sales_channel_id: 'sc_wa',
  sales_channel_ids: ['sc_wa'],
  region_id: 'reg_1',
  currency_code: 'ars',
  country_code: 'ar',
  ...over,
});

/** Un contenedor que sólo sabe devolver la fila que le pusimos. */
const containerWith = (rows: unknown[]) =>
  ({
    resolve: () => ({ graph: async () => ({ data: rows })}),
  }) as never;

const fila = (channelIds: string[]) => ({
  id: 'variant_1',
  title: '20 L',
  product: {
    title: 'Látex interior',
    handle: 'latex-interior',
    thumbnail: 'https://x/y.jpg',
    sales_channels: channelIds.map((id) => ({ id })),
  },
  calculated_price: { calculated_amount: 12345 },
});

describe('getWaVariantDetail — el gate de compra', () => {
  it('devuelve el detalle cuando el producto está en el canal del bot', async () => {
    const detail = await getWaVariantDetail(containerWith([fila(['sc_wa'])]), 'variant_1', { ctx: ctx() });
    assert.equal(detail?.title, 'Látex interior — 20 L');
    assert.equal(detail?.unit_price, 12345);
  });

  it('devuelve null cuando el producto NO está en el canal del bot', async () => {
    // Es el agujero que tapa este cambio: antes filtraba sólo por id, así que
    // `wa_add_to_cart` agregaba cualquier variante del catálogo.
    const detail = await getWaVariantDetail(containerWith([fila(['sc_web'])]), 'variant_1', { ctx: ctx() });
    assert.equal(detail, null);
  });

  it('un TAP VIEJO de un producto que salió del canal ya no entra', async () => {
    // El `variant_id` llega en el tap del cliente y un carrusel viejo sigue
    // arriba en la conversación con sus botones vivos. La vidriera filtrada no
    // alcanza: el id no vuelve a pasar por la búsqueda.
    const detail = await getWaVariantDetail(containerWith([fila([])]), 'variant_1', { ctx: ctx() });
    assert.equal(detail, null);
  });

  it('con varios canales del bot, alcanza con estar en uno', async () => {
    const detail = await getWaVariantDetail(containerWith([fila(['sc_otro'])]), 'variant_1', {
      ctx: ctx({ sales_channel_ids: ['sc_wa', 'sc_otro'] }),
    });
    assert.equal(detail?.title, 'Látex interior — 20 L');
  });

  it('una variante que no existe sigue dando null', async () => {
    assert.equal(await getWaVariantDetail(containerWith([]), 'variant_1', { ctx: ctx() }), null);
  });
});

describe('displayTitle', () => {
  it('omite la variante placeholder', () => {
    assert.equal(displayTitle('Látex interior', 'Default variant'), 'Látex interior');
  });
});

// ─── Productos elegidos a mano ────────────────────────────────────────────────

/**
 * Un contenedor que responde distinto según la entidad que le pidan: la
 * hidratación pide `product` con variantes y el filtro de canal vuelve a pedir
 * `product` sólo con `sales_channels`. Se distinguen por los campos.
 */
const containerPinned = (opts: {
  productos: unknown[];
  canalesPorProducto: Record<string, string[]>;
}) =>
  ({
    resolve: () => ({
      graph: async (q: { entity: string; fields: string[] }) => {
        if (q.fields.some((f) => f.startsWith('sales_channels'))) {
          return {
            data: Object.entries(opts.canalesPorProducto).map(([id, canales]) => ({
              id,
              sales_channels: canales.map((c) => ({ id: c })),
            })),
          };
        }
        return { data: opts.productos };
      },
    }),
  }) as never;

const producto = (id: string, titulo: string) => ({
  id,
  title: titulo,
  thumbnail: null,
  variants: [
    { id: `var_${id}`, title: '20 L', manage_inventory: false, calculated_price: { calculated_amount: 1000 } },
  ],
});

describe('listWaPinnedProducts', () => {
  it('respeta el ORDEN en que el operador los acomodó', async () => {
    // El orden es lo que ve el cliente. Ordenar por stock o por relevancia acá
    // sería pisar una decisión comercial con un criterio técnico.
    const out = await listWaPinnedProducts(
      containerPinned({
        productos: [producto('prod_b', 'Segundo'), producto('prod_a', 'Primero')],
        canalesPorProducto: { prod_a: ['sc_wa'], prod_b: ['sc_wa'] },
      }),
      ['prod_a', 'prod_b'],
      { ctx: ctx() },
    );
    // La etiqueta es el PRODUCTO, no "Producto — presentación": la fila representa a
    // todas las presentaciones y el cliente todavía no eligió ninguna.
    assert.deepEqual(out.map((o) => o.label.split(' · ')[0]), ['Primero', 'Segundo']);
  });

  it('descarta los que NO están en el canal del bot', async () => {
    // Fijar a mano es curación, no un permiso de venta: si se mostrara, el cliente
    // lo tocaría y `wa_add_to_cart` lo rebotaría.
    const out = await listWaPinnedProducts(
      containerPinned({
        productos: [producto('prod_a', 'Vendible'), producto('prod_b', 'De otro canal')],
        canalesPorProducto: { prod_a: ['sc_wa'], prod_b: ['sc_web'] },
      }),
      ['prod_a', 'prod_b'],
      { ctx: ctx() },
    );
    assert.deepEqual(out.map((o) => o.label.split(' · ')[0]), ['Vendible']);
  });

  it('sin ids devuelve vacío sin consultar nada', async () => {
    const out = await listWaPinnedProducts(null as never, [], { ctx: ctx() });
    assert.deepEqual(out, []);
  });

  it('ignora ids vacíos o con espacios', async () => {
    const out = await listWaPinnedProducts(
      containerPinned({ productos: [producto('prod_a', 'Uno')], canalesPorProducto: { prod_a: ['sc_wa'] } }),
      ['  ', 'prod_a', ''],
      { ctx: ctx() },
    );
    assert.equal(out.length, 1);
  });

  it('un producto con varias presentaciones ocupa UNA sola fila', async () => {
    /**
     * Es el motivo del agrupado: WhatsApp acepta 10 filas, así que una pinturería que
     * vende cada pintura en cuatro presentaciones le ofrecía al cliente dos productos y
     * seis repetidos con el mismo nombre.
     */
    const conPresentaciones = {
      id: 'prod_a',
      title: 'Látex interior',
      thumbnail: null,
      variants: ['1 L', '4 L', '10 L', '20 L'].map((t, i) => ({
        id: `var_${i}`,
        title: t,
        manage_inventory: false,
        calculated_price: { calculated_amount: 1000 },
      })),
    };
    const out = await listWaPinnedProducts(
      containerPinned({ productos: [conPresentaciones], canalesPorProducto: { prod_a: ['sc_wa'] } }),
      ['prod_a'],
      { ctx: ctx() },
    );
    assert.equal(out.length, 1);
    assert.equal(out[0]?.label.split(' · ')[0], 'Látex interior');
    // Y detrás queda una variante de verdad, o se rompe agregar al carrito.
    assert.equal(out[0]?.value, 'var_0');
  });

  it('el value es el variant_id, listo para el carrito', async () => {
    const out = await listWaPinnedProducts(
      containerPinned({ productos: [producto('prod_a', 'Uno')], canalesPorProducto: { prod_a: ['sc_wa'] } }),
      ['prod_a'],
      { ctx: ctx() },
    );
    assert.equal(out[0]?.value, 'var_prod_a');
  });
});
