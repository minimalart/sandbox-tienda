import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { groupHitsByProduct } from '../group-hits';
import type { WaProductHit } from '../search-products';
import { buildCatalogFilterBy, catalogSortBy, isEmptyCatalogFilter } from './catalog-filter';

const CANALES = ['sc_bot'];

describe('el filtro de catálogo', () => {
  it('siempre trae los filtros base, aunque no se pida nada', () => {
    // Sin el canal, el paso ofrecería productos que después rebotan en el carrito.
    const out = buildCatalogFilterBy({}, CANALES);
    assert.match(out, /sales_channels\.id:=\[sc_bot\]/);
    assert.match(out, /metadata\.hidden_from_store:!=true/);
  });

  it('la categoría filtra por el CAMINO, no por la hoja', () => {
    // Elegir "Pinturas" tiene que traer lo que cuelga de Pinturas. Con `category_id`
    // traería sólo lo colgado exactamente ahí, que casi nunca es lo que se quiere.
    assert.match(buildCatalogFilterBy({ categoryIds: ['cat_1'] }, CANALES), /category_path_ids:=\[cat_1\]/);
  });

  it('varias categorías son un o lógico', () => {
    assert.match(
      buildCatalogFilterBy({ categoryIds: ['cat_1', 'cat_2'] }, CANALES),
      /category_path_ids:=\[cat_1,cat_2\]/,
    );
  });

  it('cada extremo del precio es opcional por su cuenta', () => {
    // "hasta 20.000" sin mínimo es el caso más pedido.
    assert.match(buildCatalogFilterBy({ priceMax: 20000 }, CANALES), /price:<=20000/);
    assert.doesNotMatch(buildCatalogFilterBy({ priceMax: 20000 }, CANALES), /price:>=/);
    assert.match(buildCatalogFilterBy({ priceMin: 500 }, CANALES), /price:>=500/);
  });

  it('un precio negativo o basura se ignora en vez de romper la consulta', () => {
    assert.doesNotMatch(
      buildCatalogFilterBy({ priceMin: -5, priceMax: Number.NaN }, CANALES),
      /price:/,
    );
  });

  it('las promociones son una cláusula propia', () => {
    assert.match(buildCatalogFilterBy({ onlyPromotions: true }, CANALES), /has_promotion:=true/);
  });

  it('colección y marca se combinan con lo demás', () => {
    const out = buildCatalogFilterBy(
      { collectionIds: ['col_1'], brandIds: ['br_1'], categoryIds: ['cat_1'] },
      CANALES,
    );
    assert.match(out, /collection\.id:=\[col_1\]/);
    assert.match(out, /brand\.id:=\[br_1\]/);
    assert.equal(out.split(' && ').length, 5);
  });

  it('los ids vacíos no ensucian la consulta', () => {
    assert.doesNotMatch(buildCatalogFilterBy({ categoryIds: ['', '  '] }, CANALES), /category_path_ids/);
  });
});

describe('un filtro que no filtra', () => {
  it('se reconoce como vacío', () => {
    // Traería el catálogo entero, que nunca es lo que alguien quiso configurar.
    assert.equal(isEmptyCatalogFilter({}), true);
    assert.equal(isEmptyCatalogFilter(null), true);
    assert.equal(isEmptyCatalogFilter({ sort: 'precio_asc' }), true);
  });

  it('con cualquier condición deja de estarlo', () => {
    assert.equal(isEmptyCatalogFilter({ priceMax: 100 }), false);
    assert.equal(isEmptyCatalogFilter({ categoryIds: ['cat_1'] }), false);
    assert.equal(isEmptyCatalogFilter({ onlyPromotions: true }), false);
  });
});

describe('el orden', () => {
  it('por precio cuando se pide', () => {
    assert.equal(catalogSortBy({ sort: 'precio_asc' }), 'price:asc');
    assert.equal(catalogSortBy({ sort: 'precio_desc' }), 'price:desc');
  });

  it('sin pedir nada manda la relevancia', () => {
    assert.equal(catalogSortBy({}), undefined);
    assert.equal(catalogSortBy({ sort: 'relevancia' }), undefined);
  });
});

// ─── Una tarjeta por producto ─────────────────────────────────────────────────

const hit = (p: string, v: string, stock = true, titulo = `Producto ${p}`): WaProductHit => ({
  product_id: p,
  variant_id: v,
  product_title: titulo,
  variant_title: v,
  title: `${titulo} — ${v}`,
  unit_price: 100,
  in_stock: stock,
  image_url: null,
});

describe('agrupar el carrusel por producto', () => {
  it('cuatro presentaciones del mismo producto son UNA tarjeta', () => {
    // Es el problema concreto: buscar "látex" y recibir cuatro veces el mismo balde.
    const out = groupHitsByProduct([
      hit('p1', '1L'),
      hit('p1', '4L'),
      hit('p1', '10L'),
      hit('p1', '20L'),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.variant_count, 4);
  });

  it('la tarjeta se llama como el PRODUCTO', () => {
    // "Látex interior — 20 L" en una tarjeta que representa a las cuatro
    // presentaciones diría una mentira chica.
    const out = groupHitsByProduct([hit('p1', '20L', true, 'Látex interior')]);
    assert.equal(out[0]?.title, 'Látex interior');
  });

  it('detrás queda una variante de VERDAD, o se rompe agregar al carrito', () => {
    const out = groupHitsByProduct([hit('p1', '1L'), hit('p1', '4L')]);
    assert.equal(out[0]?.variant_id, '1L');
  });

  it('la representante es la que tiene stock', () => {
    const out = groupHitsByProduct([hit('p1', '1L', false), hit('p1', '4L', true)]);
    assert.equal(out[0]?.variant_id, '4L');
    assert.equal(out[0]?.in_stock, true);
  });

  it('si ninguna tiene stock, igual se muestra', () => {
    // Mejor ofrecer el producto marcado "sin stock" que esconderlo.
    const out = groupHitsByProduct([hit('p1', '1L', false), hit('p1', '4L', false)]);
    assert.equal(out.length, 1);
    assert.equal(out[0]?.in_stock, false);
  });

  it('se conserva el orden de relevancia y no el de stock', () => {
    // Reordenar por stock movería el producto más buscado al fondo del carrusel.
    const out = groupHitsByProduct([
      hit('p1', 'a', false),
      hit('p2', 'b', true),
      hit('p1', 'c', true),
    ]);
    assert.deepEqual(
      out.map((h) => h.product_id),
      ['p1', 'p2'],
    );
  });

  it('productos distintos siguen siendo tarjetas distintas', () => {
    const out = groupHitsByProduct([hit('p1', 'a'), hit('p2', 'b'), hit('p3', 'c')]);
    assert.equal(out.length, 3);
    assert.deepEqual(
      out.map((h) => h.variant_count),
      [1, 1, 1],
    );
  });

  it('una lista vacía no rompe', () => {
    assert.deepEqual(groupHitsByProduct([]), []);
  });
});
