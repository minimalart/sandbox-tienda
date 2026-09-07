import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORREO_DEFAULT_AFORO_DIVISOR,
  CORREO_MAX_DIMENSION_CM,
  CORREO_MAX_WEIGHT_G,
  CorreoMissingProductDimensionsError,
  CorreoParcelLimitError,
  consolidateParcel,
  type ConsolidateParcelItem,
} from './consolidate-parcel.ts';

const item = (
  overrides: Partial<ConsolidateParcelItem> = {},
): ConsolidateParcelItem => ({
  id: 'item_1',
  title: 'Producto',
  quantity: 1,
  weight: 1, // kg
  length: 20,
  width: 10,
  height: 30,
  unit_price: 1000,
  ...overrides,
});

describe('consolidateParcel — N ítems → UN bulto', () => {
  // La API descarta parcels[1..n]: si esto se rompe, el envío viaja
  // sub-declarado y el sobrecosto lo factura Correo.
  it('suma el peso de todas las unidades y lo devuelve en GRAMOS', () => {
    const parcel = consolidateParcel([
      item({ id: 'a', weight: 1.5, quantity: 2 }),
      item({ id: 'b', weight: 0.25, quantity: 4 }),
    ]);

    // (1.5 * 2) + (0.25 * 4) = 4 kg → 4000 g
    assert.equal(parcel.productWeightG, 4000);
  });

  it('cuenta unidades, no líneas de pedido', () => {
    const parcel = consolidateParcel([
      item({ id: 'a', quantity: 3 }),
      item({ id: 'b', quantity: 2 }),
    ]);
    assert.equal(parcel.itemCount, 5);
  });

  it('convierte de gramos cuando weightUnit es "g"', () => {
    const parcel = consolidateParcel([item({ weight: 1200, quantity: 2 })], {
      weightUnit: 'g',
    });
    assert.equal(parcel.productWeightG, 2400);
  });

  it('un solo ítem reconstruye sus propias dimensiones', () => {
    const parcel = consolidateParcel([
      item({ length: 20, width: 10, height: 30 }),
    ]);
    // lados ordenados: 10 (menor → apilado), 20 (medio), 30 (mayor)
    assert.deepEqual(parcel.dimensions, { depth: 10, width: 20, height: 30 });
  });

  it('declaredValue sale del subtotal de los ítems', () => {
    const parcel = consolidateParcel([
      item({ unit_price: 1500, quantity: 2 }),
      item({ id: 'b', unit_price: 500, quantity: 1 }),
    ]);
    assert.equal(parcel.declaredValue, 3500);
  });

  it('declaredValue nunca es 0 (es obligatorio y numérico)', () => {
    const parcel = consolidateParcel([item({ unit_price: 0 })]);
    assert.equal(parcel.declaredValue, 1);
  });

  it('options.declaredValue reemplaza el subtotal calculado', () => {
    const parcel = consolidateParcel([item({ unit_price: 999 })], {
      declaredValue: 12345.4,
    });
    assert.equal(parcel.declaredValue, 12345);
  });

  it('sin ítems tira', () => {
    assert.throws(() => consolidateParcel([]), /no items/);
  });
});

describe('consolidateParcel — heurística de apilado', () => {
  it('acumula el lado MENOR de cada ítem y toma el máximo de los otros dos', () => {
    const parcel = consolidateParcel([
      item({ id: 'a', length: 20, width: 10, height: 30 }), // menor 10
      item({ id: 'b', length: 40, width: 5, height: 15 }), // menor 5
    ]);

    // apilado: 10 + 5 = 15; medios: max(20, 15) = 20; mayores: max(30, 40) = 40
    assert.deepEqual(parcel.dimensions, { depth: 15, width: 20, height: 40 });
  });

  it('el lado menor se multiplica por la cantidad', () => {
    const parcel = consolidateParcel([
      item({ length: 20, width: 10, height: 30, quantity: 3 }),
    ]);
    assert.equal(parcel.dimensions.depth, 30);
  });

  it('redondea las dimensiones HACIA ARRIBA (declarar de menos = sobrecosto)', () => {
    const parcel = consolidateParcel([
      item({ length: 20.2, width: 10.4, height: 30.1 }),
    ]);
    assert.deepEqual(parcel.dimensions, { depth: 11, width: 21, height: 31 });
  });
});

describe('consolidateParcel — peso volumétrico', () => {
  it('volumétrico = (h × w × d) / aforo, en gramos', () => {
    const parcel = consolidateParcel([
      item({ length: 40, width: 40, height: 40, weight: 0.5 }),
    ]);

    const expected = Math.ceil(
      ((40 * 40 * 40) / CORREO_DEFAULT_AFORO_DIVISOR) * 1000,
    );
    assert.equal(parcel.volumetricWeightG, expected); // 16000 g
    assert.equal(parcel.productWeightG, 500);
  });

  it('billedWeightG = max(real, volumétrico) — gana el volumétrico', () => {
    const parcel = consolidateParcel([
      item({ length: 40, width: 40, height: 40, weight: 0.5 }),
    ]);
    assert.equal(parcel.billedWeightG, parcel.volumetricWeightG);
    assert.ok(parcel.billedWeightG > parcel.productWeightG);
  });

  it('billedWeightG = max(real, volumétrico) — gana el real', () => {
    const parcel = consolidateParcel([
      item({ length: 10, width: 10, height: 10, weight: 5 }),
    ]);
    assert.equal(parcel.productWeightG, 5000);
    assert.equal(parcel.billedWeightG, 5000);
    assert.ok(parcel.volumetricWeightG < parcel.productWeightG);
  });

  it('el aforo es configurable (el /4000 es un valor de comunidad, sin verificar)', () => {
    const dense = consolidateParcel(
      [item({ length: 40, width: 40, height: 40, weight: 0.5 })],
      { aforoDivisor: 6000 },
    );
    const expected = Math.ceil(((40 * 40 * 40) / 6000) * 1000);
    assert.equal(dense.volumetricWeightG, expected);
  });

  it('un aforo inválido cae al default en vez de dividir por cero', () => {
    const parcel = consolidateParcel(
      [item({ length: 40, width: 40, height: 40 })],
      { aforoDivisor: 0 },
    );
    assert.ok(Number.isFinite(parcel.volumetricWeightG));
    assert.equal(
      parcel.volumetricWeightG,
      Math.ceil(((40 * 40 * 40) / CORREO_DEFAULT_AFORO_DIVISOR) * 1000),
    );
  });
});

describe('consolidateParcel — techos, ANTES de llamar a la API', () => {
  it('peso facturado por encima del techo → CorreoParcelLimitError', () => {
    assert.throws(
      () =>
        consolidateParcel([
          item({ length: 10, width: 10, height: 10, weight: 26 }),
        ]),
      (error: unknown) => {
        assert.ok(error instanceof CorreoParcelLimitError);
        assert.equal(error.field, 'weight');
        assert.equal(error.limit, CORREO_MAX_WEIGHT_G);
        assert.equal(error.actual, 26000);
        assert.equal(error.code, 'CORREO_PARCEL_LIMIT_EXCEEDED');
        return true;
      },
    );
  });

  it('el techo de peso es configurable', () => {
    assert.throws(
      () =>
        consolidateParcel([item({ length: 10, width: 10, height: 10, weight: 6 })], {
          maxWeightG: 5000,
        }),
      CorreoParcelLimitError,
    );
  });

  it('un lado por encima de 150 cm → CorreoParcelLimitError', () => {
    assert.throws(
      () => consolidateParcel([item({ length: 200, width: 10, height: 20 })]),
      (error: unknown) => {
        assert.ok(error instanceof CorreoParcelLimitError);
        assert.equal(error.field, 'height');
        assert.equal(error.limit, CORREO_MAX_DIMENSION_CM);
        return true;
      },
    );
  });

  it('el apilado de muchas unidades también dispara el techo de dimensión', () => {
    assert.throws(
      () =>
        consolidateParcel([
          item({ length: 20, width: 10, height: 30, quantity: 20, weight: 0.1 }),
        ]),
      (error: unknown) => {
        assert.ok(error instanceof CorreoParcelLimitError);
        assert.equal(error.field, 'depth'); // 10 * 20 = 200 cm
        return true;
      },
    );
  });

  it('el techo efectivo nunca supera los 999 cm que admite el payload (3 chars)', () => {
    assert.throws(
      () =>
        consolidateParcel([item({ length: 1200, width: 10, height: 10 })], {
          maxDimensionCm: 5000,
        }),
      (error: unknown) => {
        assert.ok(error instanceof CorreoParcelLimitError);
        assert.equal(error.limit, 999);
        return true;
      },
    );
  });
});

describe('consolidateParcel — dimensiones/peso faltantes', () => {
  it('estricto por default: tira listando TODOS los ofensores', () => {
    assert.throws(
      () =>
        consolidateParcel([
          item({ id: 'a', title: 'Sin alto', height: 0 }),
          item({ id: 'b', title: 'Sin peso', weight: 0 }),
          item({ id: 'c', title: 'Completo' }),
        ]),
      (error: unknown) => {
        assert.ok(error instanceof CorreoMissingProductDimensionsError);
        assert.equal(error.offenders.length, 2);
        assert.deepEqual(
          error.offenders.map((o) => o.id),
          ['a', 'b'],
        );
        assert.deepEqual(error.offenders[0]?.missing, ['height']);
        assert.deepEqual(error.offenders[1]?.missing, ['weight']);
        assert.match(error.message, /Sin alto/);
        assert.match(error.message, /Sin peso/);
        return true;
      },
    );
  });

  it('el peso entra en la validación (productWeight es obligatorio y /rates rechaza < 1 g)', () => {
    assert.throws(
      () => consolidateParcel([item({ weight: 0 })]),
      CorreoMissingProductDimensionsError,
    );
  });

  it('lista todos los campos faltantes de un mismo ítem', () => {
    assert.throws(
      () =>
        consolidateParcel([
          item({ weight: 0, length: 0, width: 0, height: 0 }),
        ]),
      (error: unknown) => {
        assert.ok(error instanceof CorreoMissingProductDimensionsError);
        assert.deepEqual(error.offenders[0]?.missing, [
          'weight',
          'length',
          'width',
          'height',
        ]);
        return true;
      },
    );
  });

  it('con dimensionFallback rellena, loguea y NO tira', () => {
    const warnings: string[] = [];
    const parcel = consolidateParcel(
      [item({ id: 'a', title: 'Incompleto', height: 0, weight: 0 })],
      {
        dimensionFallback: { length: 30, width: 20, height: 15, weight: 0.5 },
        logger: { warn: (message) => warnings.push(message) },
      },
    );

    // lados: 10 (width del ítem), 15 (fallback height), 20 (length)
    assert.deepEqual(parcel.dimensions, { depth: 10, width: 15, height: 20 });
    assert.equal(parcel.productWeightG, 500);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0] ?? '', /Incompleto/);
    assert.match(warnings[0] ?? '', /height, weight/);
  });

  it('con dimensionFallback no loguea nada para ítems completos', () => {
    const warnings: string[] = [];
    consolidateParcel([item()], {
      dimensionFallback: { length: 30, width: 20, height: 15, weight: 0.5 },
      logger: { warn: (message) => warnings.push(message) },
    });
    assert.equal(warnings.length, 0);
  });
});
