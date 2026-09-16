import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SALE_ORDER_FIELDS, lineQuantityOf, lineTotalOf, toStudentAssignments } from './build-sale-payload.ts';

/**
 * Estos tests existen por un comprobante emitido en CERO.
 *
 * El 10/09/2026, con la facturación recién prendida, la venta que salió a Zeus
 * llevaba `cantidad: 0` y `total: 0` sobre una orden de $186.262,84. No falló
 * nada: el ERP aceptó el pedido, el outbox lo dio por enviado y ninguna pantalla
 * mostró un error. El único rastro fue el `request_payload` guardado.
 *
 * La causa era una sola línea de la lista de campos —`items.quantity` en lugar
 * de `items.detail.quantity`— y **una lista de campos no se puede testear
 * ejecutándola**: `query.graph` devuelve `undefined` para un campo que no
 * existe, sin error. Por eso el test ata la LISTA, que es donde vive el bug.
 */

test('pide la cantidad por el detalle versionado, que es la única que llega', () => {
  assert.ok(
    SALE_ORDER_FIELDS.includes('items.detail.quantity'),
    'sin `items.detail.quantity` la cantidad llega undefined y el comprobante sale en 0'
  );
});

test('NO pide items.quantity: esa columna no existe y devuelve undefined', () => {
  // El mapeo interno de Medusa reescribe `items.<campo>` contra la LÍNEA, donde
  // `quantity` no existe. Pedirlo no falla — devuelve undefined, que es peor.
  assert.ok(!SALE_ORDER_FIELDS.includes('items.quantity'));
});

test('NO pide el total de la línea por ninguna de las dos vías', () => {
  // No es columna de `OrderLineItem` ni de `OrderItem`: lo calcula
  // `decorateCartTotals` después de la consulta y llega solo.
  assert.ok(!SALE_ORDER_FIELDS.includes('items.total'));
  assert.ok(!SALE_ORDER_FIELDS.includes('items.detail.total'));
});

test('sigue pidiendo los totales de la orden y la metadata del entonado', () => {
  // Los totales se CALCULAN sobre los items: con la cantidad arreglada vuelven
  // solos, pero si alguien saca estos campos vuelven a dar 0.
  for (const field of ['total', 'subtotal', 'shipping_total', 'discount_total', 'tax_total']) {
    assert.ok(SALE_ORDER_FIELDS.includes(field), `falta el total de orden \`${field}\``);
  }
  // `items.metadata` es de dónde sale el color entonado; `items.variant.metadata`,
  // la alícuota de IVA por artículo. Las dos ya se perdieron una vez.
  assert.ok(SALE_ORDER_FIELDS.includes('items.metadata'));
  assert.ok(SALE_ORDER_FIELDS.includes('items.variant.metadata'));
});

test('pide el título limpio del producto además del de la línea', () => {
  // Desde que el alta de una base entonada escribe el color DENTRO de `title`
  // (para que se vea en el resumen de orden del admin, que no renderiza ni
  // `subtitle` ni la metadata), mandarle `item.title` a Zeus le pegaría el
  // color dos veces: el adapter arma la descripción como
  // `<título> — Color <nombre>`. El título limpio vive en `product_title`.
  assert.ok(
    SALE_ORDER_FIELDS.includes('items.product_title'),
    'sin `items.product_title` el remito de una línea entonada repite el color'
  );
});

test('la lista no tiene campos repetidos', () => {
  assert.equal(new Set(SALE_ORDER_FIELDS).size, SALE_ORDER_FIELDS.length);
});

test('lineQuantityOf lee el detalle cuando la línea no trae cantidad', () => {
  assert.equal(lineQuantityOf({ detail: { quantity: 3 } }), 3);
  assert.equal(lineQuantityOf({ quantity: null, detail: { quantity: 3 } }), 3);
  assert.equal(lineQuantityOf({ quantity: 2, detail: { quantity: 3 } }), 2);
});

test('lineQuantityOf devuelve 0 cuando no hay cantidad por ningún lado', () => {
  // Es el estado que produjo el bug. Vale 0 acá, pero el ERP no debería ver
  // nunca este caso: si pasa, es que la lista de campos volvió a romperse.
  assert.equal(lineQuantityOf({}), 0);
  assert.equal(lineQuantityOf({ quantity: null, detail: null }), 0);
});

test('lineTotalOf usa el total calculado cuando está', () => {
  assert.equal(lineTotalOf({ total: 500, unit_price: 100, detail: { quantity: 2 } }), 500);
  assert.equal(lineTotalOf({ detail: { total: 500, quantity: 2 }, unit_price: 100 }), 500);
});

test('lineTotalOf reconstruye precio × cantidad si el total no llegó', () => {
  // Sin este respaldo, una línea sin total calculado le manda un 0 al ERP.
  assert.equal(lineTotalOf({ unit_price: 100, detail: { quantity: 3 } }), 300);
  assert.equal(lineTotalOf({ unit_price: 186262.84, detail: { quantity: 1 } }), 186262.84);
});

test('un total 0 explícito se respeta y no se recalcula', () => {
  // Una línea bonificada al 100% es legítima: no hay que "arreglarla".
  assert.equal(lineTotalOf({ total: 0, unit_price: 100, detail: { quantity: 2 } }), 0);
});

test('valores basura no propagan NaN al comprobante', () => {
  assert.equal(lineQuantityOf({ quantity: 'dos' as unknown as number }), 0);
  assert.equal(lineTotalOf({ total: 'mucho' as unknown as number, unit_price: 10 }), 0);
});

/**
 * Los tests de `toStudentAssignments` cubren el contrato que le prometimos a
 * Odoo (schema_version 1.0): items agrupados por SKU, cada uno con la lista
 * de destinatarios y la `quantity` que a cada uno le corresponde. La
 * transformación es pura sobre `snapshot.people`, `snapshot.units` y los
 * items del pedido — sin acceso a la DB, cero side effects.
 */
describe('toStudentAssignments — transformación snapshot → items agrupados', () => {
  const site = { id: 'ds_01', slug: 'san_agustin', name: 'Colegio San Agustín' };
  const ana = { id: 'p-ana', first_name: 'Ana', last_name: 'García', document: '40123456', grade: '4A' };
  const juan = { id: 'p-juan', first_name: 'Juan', last_name: 'Pérez', document: '45123456', grade: '4A' };
  const sinDoc = { id: 'p-sin', first_name: 'Martina', last_name: 'López', grade: undefined };

  test('1 línea × 1 destinatario', () => {
    const result = toStudentAssignments(
      { site, people: [ana], units: [{ id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id }] },
      [{ id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } }]
    );
    assert.equal(result?.schema_version, '1.0');
    assert.equal(result?.items.length, 1);
    assert.equal(result?.items[0]!.sku, 'EDU-KIT-4');
    assert.equal(result?.items[0]!.quantity, 1);
    assert.equal(result?.items[0]!.recipients.length, 1);
    assert.equal(result?.items[0]!.recipients[0]!.external_id, ana.id);
    assert.equal(result?.items[0]!.recipients[0]!.quantity, 1);
    assert.equal(result?.items[0]!.recipients[0]!.document, '40123456');
    assert.equal(result?.items[0]!.recipients[0]!.grade, '4A');
  });

  test('1 línea con quantity=2 se splitea entre 2 destinatarios', () => {
    const result = toStudentAssignments(
      {
        site,
        people: [ana, juan],
        units: [
          { id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id },
          { id: 'u2', line_id: 'l1', line_key: 'k1', person_id: juan.id },
        ],
      },
      [{ id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } }]
    );
    assert.equal(result?.items[0]!.quantity, 2);
    assert.equal(result?.items[0]!.recipients.length, 2);
    // La quantity de cada recipient tiene que sumar la total.
    const total = result?.items[0]!.recipients.reduce((s, r) => s + r.quantity, 0);
    assert.equal(total, 2);
  });

  test('mismo destinatario en varias líneas: aparece en cada item que le toca', () => {
    const result = toStudentAssignments(
      {
        site,
        people: [ana],
        units: [
          { id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id },
          { id: 'u2', line_id: 'l2', line_key: 'k2', person_id: ana.id },
        ],
      },
      [
        { id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } },
        { id: 'oi_2', variant_sku: 'EDU-MICROSCOPIO', metadata: { checkout_line_key: 'k2' } },
      ]
    );
    assert.equal(result?.items.length, 2);
    assert.ok(result?.items.every((i) => i.recipients[0]!.external_id === ana.id));
    assert.ok(result?.items.every((i) => i.quantity === 1));
  });

  test('unidades sin person_id se ignoran (no aparecen en items)', () => {
    const result = toStudentAssignments(
      {
        site,
        people: [ana],
        units: [
          { id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id },
          { id: 'u2', line_id: 'l1', line_key: 'k1', person_id: null },
        ],
      },
      [{ id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } }]
    );
    // Sólo 1 recipient con qty 1 — la unidad sin persona no se cuenta.
    assert.equal(result?.items[0]!.quantity, 1);
    assert.equal(result?.items[0]!.recipients[0]!.quantity, 1);
  });

  test('sin unidades con person_id → devuelve null (nada que mandar al ERP)', () => {
    const result = toStudentAssignments(
      {
        site,
        people: [ana],
        units: [{ id: 'u1', line_id: 'l1', line_key: 'k1', person_id: null }],
      },
      [{ id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } }]
    );
    assert.equal(result, null);
  });

  test('document/grade opcionales llegan como null explícito', () => {
    const result = toStudentAssignments(
      { site, people: [sinDoc], units: [{ id: 'u1', line_id: 'l1', line_key: 'k1', person_id: sinDoc.id }] },
      [{ id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } }]
    );
    assert.equal(result?.items[0]!.recipients[0]!.document, null);
    assert.equal(result?.items[0]!.recipients[0]!.grade, null);
    assert.equal(result?.items[0]!.recipients[0]!.first_name, 'Martina');
  });

  test('unit con checkout_line_key ambiguo (2 líneas con el mismo key) se descarta', () => {
    // `mapOrderUnits` de demo-store tira error acá; en el enrichment del ERP
    // preferimos NO mandar la unidad ambigua antes que romper el envío al ERP.
    const result = toStudentAssignments(
      { site, people: [ana], units: [{ id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id }] },
      [
        { id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } },
        { id: 'oi_2', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } },
      ]
    );
    // Ambigüedad → unidad descartada → no hay items con destinatarios → null.
    assert.equal(result, null);
  });

  test('unit cuyo line_key no matchea ningún order item se descarta silenciosamente', () => {
    // Puede pasar si la orden se editó administrativamente eliminando líneas
    // después del snapshot. NO tirar acá evita bloquear el envío al ERP.
    const result = toStudentAssignments(
      { site, people: [ana], units: [{ id: 'u1', line_id: 'l1', line_key: 'k_removed', person_id: ana.id }] },
      [{ id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } }]
    );
    assert.equal(result, null);
  });

  test('items con el mismo SKU en dos líneas distintas se colapsan', () => {
    // Caso raro (típicamente por tint splits o promos): dos líneas de la orden
    // con el mismo variant_sku. Se agregan bajo el mismo `sku` en el output.
    const result = toStudentAssignments(
      {
        site,
        people: [ana, juan],
        units: [
          { id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id },
          { id: 'u2', line_id: 'l2', line_key: 'k2', person_id: juan.id },
        ],
      },
      [
        { id: 'oi_1', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k1' } },
        { id: 'oi_2', variant_sku: 'EDU-KIT-4', metadata: { checkout_line_key: 'k2' } },
      ]
    );
    assert.equal(result?.items.length, 1);
    assert.equal(result?.items[0]!.sku, 'EDU-KIT-4');
    assert.equal(result?.items[0]!.quantity, 2);
    assert.equal(result?.items[0]!.recipients.length, 2);
  });

  test('items sin variant_sku o sin checkout_line_key se ignoran', () => {
    const result = toStudentAssignments(
      { site, people: [ana], units: [
        { id: 'u1', line_id: 'l1', line_key: 'k1', person_id: ana.id },
        { id: 'u2', line_id: 'l2', line_key: 'k2', person_id: ana.id },
      ] },
      [
        { id: 'oi_1', variant_sku: null, metadata: { checkout_line_key: 'k1' } },
        { id: 'oi_2', variant_sku: 'EDU-KIT-4', metadata: {} },
      ]
    );
    assert.equal(result, null);
  });
});
