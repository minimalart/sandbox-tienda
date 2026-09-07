import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CorreoOrderPayloadError,
  buildCorreoOrderPayload,
  formatCorreoSaleDate,
  splitArgentinePhone,
  type BuildCorreoOrderInput,
} from './order-payload.ts';
import type { ConsolidatedParcel } from './consolidate-parcel.ts';
import { normalizeCorreoOptions } from '../env-options.ts';
import type { CorreoProviderOptions } from '../types.ts';

const options = (
  overrides: Record<string, unknown> = {},
): CorreoProviderOptions =>
  normalizeCorreoOptions({
    apiKey: 'test-key',
    agreement: '18018',
    sellerId: 'seller-1',
    testMode: 'true',
    sender: {
      name: 'Mercatto SA',
      email: 'envios@mercatto.test',
      phone: '011 4123-4567',
    },
    origin: {
      postalCode: '1757',
      street: 'Av. Siempre Viva',
      number: '742',
      city: 'Gregorio de Laferrere',
      state: 'B',
    },
    ...overrides,
  });

const parcel: ConsolidatedParcel = {
  dimensions: { height: 30, width: 20, depth: 15 },
  productWeightG: 2500,
  volumetricWeightG: 2250,
  billedWeightG: 2500,
  declaredValue: 45000,
  itemCount: 3,
};

const input = (
  overrides: Partial<BuildCorreoOrderInput> = {},
): BuildCorreoOrderInput => ({
  trackingNumber: 'MRC-000123-AB',
  deliveryType: 'homeDelivery',
  parcel,
  saleDate: new Date('2026-03-15T18:30:45.000Z'),
  recipient: {
    name: 'Juana Pérez',
    email: 'juana@test.com',
    phone: '+54 9 11 5555-6666',
    address: {
      street: 'Corrientes',
      number: '1234',
      city: 'Buenos Aires',
      state: 'CABA',
      postalCode: 'C1121AAF',
      floor: '3',
      department: 'B',
    },
  },
  ...overrides,
});

describe('buildCorreoOrderPayload — homeDelivery', () => {
  it('arma el payload completo', () => {
    const payload = buildCorreoOrderPayload(input(), options());

    assert.equal(payload.sellerId, 'seller-1');
    assert.equal(payload.trackingNumber, 'MRC-000123-AB');
    assert.equal(payload.order.deliveryType, 'homeDelivery');
    assert.equal(payload.order.serviceType, 'CP');
    assert.equal(payload.order.parcels.length, 1);

    assert.deepEqual(payload.order.senderData.address, {
      streetName: 'Av. Siempre Viva',
      streetNumber: '742',
      cityName: 'Gregorio de Laferrere',
      floor: '',
      department: '',
      state: 'B',
      zipCode: '1757',
    });

    assert.deepEqual(payload.order.shippingData.address, {
      streetName: 'Corrientes',
      streetNumber: '1234',
      cityName: 'Buenos Aires',
      floor: '3',
      department: 'B',
      state: 'C',
      zipCode: '1121',
    });
  });

  it('NO incluye agencyId (tiene que ir ausente, no vacío)', () => {
    const payload = buildCorreoOrderPayload(input(), options());
    assert.equal('agencyId' in payload.order, false);
    assert.equal(payload.order.agencyId, undefined);
  });

  it('ignora un agencyId pasado por error en homeDelivery', () => {
    const payload = buildCorreoOrderPayload(
      input({ agencyId: 'SCQ' }),
      options(),
    );
    assert.equal('agencyId' in payload.order, false);
  });

  it('normaliza el CPA del destinatario a 4 dígitos y CABA al código C', () => {
    const payload = buildCorreoOrderPayload(input(), options());
    assert.equal(payload.order.shippingData.address.zipCode, '1121');
    assert.equal(payload.order.shippingData.address.state, 'C');
  });

  it('streetNumber cae a "S/N" cuando la dirección no lo trae', () => {
    const payload = buildCorreoOrderPayload(
      input({
        recipient: {
          ...input().recipient,
          address: { ...input().recipient.address, number: undefined },
        },
      }),
      options(),
    );
    assert.equal(payload.order.shippingData.address.streetNumber, 'S/N');
  });
});

describe('buildCorreoOrderPayload — agency', () => {
  it('incluye agencyId', () => {
    const payload = buildCorreoOrderPayload(
      input({ deliveryType: 'agency', agencyId: 'SCQ' }),
      options(),
    );
    assert.equal(payload.order.deliveryType, 'agency');
    assert.equal(payload.order.agencyId, 'SCQ');
  });

  it('agencyId es OBLIGATORIO: sin él tira', () => {
    assert.throws(
      () =>
        buildCorreoOrderPayload(input({ deliveryType: 'agency' }), options()),
      (error: unknown) => {
        assert.ok(error instanceof CorreoOrderPayloadError);
        assert.equal(error.field, 'agencyId');
        assert.equal(error.code, 'CORREO_ORDER_PAYLOAD_INVALID');
        return true;
      },
    );
  });

  it('agencyId vacío o de solo espacios cuenta como ausente', () => {
    assert.throws(
      () =>
        buildCorreoOrderPayload(
          input({ deliveryType: 'agency', agencyId: '   ' }),
          options(),
        ),
      CorreoOrderPayloadError,
    );
  });
});

describe('buildCorreoOrderPayload — todo sale como string', () => {
  it('los campos numéricos del parcel son strings', () => {
    const payload = buildCorreoOrderPayload(input(), options());
    const first = payload.order.parcels[0];

    assert.ok(first);
    assert.equal(typeof first.dimensions.height, 'string');
    assert.equal(typeof first.dimensions.width, 'string');
    assert.equal(typeof first.dimensions.depth, 'string');
    assert.equal(typeof first.productWeight, 'string');
    assert.equal(typeof first.declaredValue, 'string');
    assert.deepEqual(first.dimensions, {
      height: '30',
      width: '20',
      depth: '15',
    });
    assert.equal(first.declaredValue, '45000');
  });

  it('productWeight es el peso FACTURADO (max real/volumétrico)', () => {
    const payload = buildCorreoOrderPayload(
      input({
        parcel: { ...parcel, productWeightG: 1000, billedWeightG: 4000 },
      }),
      options(),
    );
    assert.equal(payload.order.parcels[0]?.productWeight, '4000');
  });

  it('ningún valor del payload es number', () => {
    const payload = buildCorreoOrderPayload(input(), options());
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        assert.fail(`${path} salió como number y la API espera string`);
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
        return;
      }
      if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
          walk(entry, `${path}.${key}`);
        }
      }
    };
    walk(payload, 'payload');
  });
});

describe('buildCorreoOrderPayload — campos obligatorios', () => {
  it('sin trackingNumber tira', () => {
    assert.throws(
      () => buildCorreoOrderPayload(input({ trackingNumber: '' }), options()),
      (error: unknown) => {
        assert.ok(error instanceof CorreoOrderPayloadError);
        assert.equal(error.field, 'trackingNumber');
        return true;
      },
    );
  });

  it('trackingNumber de más de 30 chars tira', () => {
    assert.throws(
      () =>
        buildCorreoOrderPayload(
          input({ trackingNumber: 'X'.repeat(31) }),
          options(),
        ),
      /exceeds 30 characters/,
    );
  });

  it('sin nombre de destinatario tira', () => {
    assert.throws(
      () =>
        buildCorreoOrderPayload(
          input({ recipient: { ...input().recipient, name: '  ' } }),
          options(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof CorreoOrderPayloadError);
        assert.equal(error.field, 'recipient.name');
        return true;
      },
    );
  });

  it('una provincia que no se puede resolver tira (mandar state vacío es 400)', () => {
    assert.throws(
      () =>
        buildCorreoOrderPayload(
          input({
            recipient: {
              ...input().recipient,
              address: { ...input().recipient.address, state: 'Montevideo' },
            },
          }),
          options(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof CorreoOrderPayloadError);
        assert.equal(error.field, 'recipient.address.state');
        return true;
      },
    );
  });

  it('un CP inválido tira (Correo lo valida contra la provincia)', () => {
    assert.throws(
      () =>
        buildCorreoOrderPayload(
          input({
            recipient: {
              ...input().recipient,
              address: { ...input().recipient.address, postalCode: 'nope' },
            },
          }),
          options(),
        ),
      (error: unknown) => {
        assert.ok(error instanceof CorreoOrderPayloadError);
        assert.equal(error.field, 'recipient.address.postalCode');
        return true;
      },
    );
  });

  it('shipmentClientId solo se incluye si el caller lo pasa (está documentado como no funcional)', () => {
    const without = buildCorreoOrderPayload(input(), options());
    assert.equal('shipmentClientId' in without.order, false);

    const withId = buildCorreoOrderPayload(
      input({ shipmentClientId: 'ORD-1' }),
      options(),
    );
    assert.equal(withId.order.shipmentClientId, 'ORD-1');
  });

  it('serviceType sale de las options y se puede overridear', () => {
    assert.equal(
      buildCorreoOrderPayload(input(), options({ serviceType: 'EP' })).order
        .serviceType,
      'EP',
    );
    assert.equal(
      buildCorreoOrderPayload(input({ serviceType: 'EP' }), options()).order
        .serviceType,
      'EP',
    );
  });

  it('sellerId cae al agreement cuando no está configurado', () => {
    const payload = buildCorreoOrderPayload(
      input(),
      options({ sellerId: undefined }),
    );
    assert.equal(payload.sellerId, '18018');
    assert.equal(payload.order.senderData.id, '18018');
  });

  it('productCategory sale de las options y se puede overridear', () => {
    assert.equal(
      buildCorreoOrderPayload(input(), options()).order.parcels[0]
        ?.productCategory,
      'Mercaderia general',
    );
    assert.equal(
      buildCorreoOrderPayload(input({ productCategory: 'Indumentaria' }), options())
        .order.parcels[0]?.productCategory,
      'Indumentaria',
    );
  });
});

describe('formatCorreoSaleDate', () => {
  it('formato exacto YYYY-MM-DDTHH:mm:ss-03:00', () => {
    assert.equal(
      formatCorreoSaleDate(new Date('2026-03-15T18:30:45.000Z')),
      '2026-03-15T15:30:45-03:00',
    );
  });

  it('convierte a hora argentina, incluso cruzando el día', () => {
    // 01:30 UTC del 16 es 22:30 del 15 en ART: usar el huso del servidor
    // cambiaría el DÍA de la venta.
    assert.equal(
      formatCorreoSaleDate(new Date('2026-03-16T01:30:00.000Z')),
      '2026-03-15T22:30:00-03:00',
    );
  });

  it('padea mes, día y hora a dos dígitos', () => {
    assert.equal(
      formatCorreoSaleDate(new Date('2026-01-05T04:05:06.000Z')),
      '2026-01-05T01:05:06-03:00',
    );
  });

  it('acepta un string ISO', () => {
    assert.equal(
      formatCorreoSaleDate('2026-03-15T18:30:45.000Z'),
      '2026-03-15T15:30:45-03:00',
    );
  });

  it('el payload usa este formato', () => {
    const payload = buildCorreoOrderPayload(input(), options());
    assert.match(
      payload.order.saleDate,
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/,
    );
  });

  it('una fecha inválida tira', () => {
    assert.throws(() => formatCorreoSaleDate('no-es-fecha'), CorreoOrderPayloadError);
  });
});

describe('splitArgentinePhone', () => {
  it('CABA/GBA: área de 2 dígitos', () => {
    assert.deepEqual(splitArgentinePhone('011 4123-4567'), {
      areaCode: '11',
      number: '41234567',
    });
    assert.deepEqual(splitArgentinePhone('+54 9 11 5555-6666'), {
      areaCode: '11',
      number: '55556666',
    });
  });

  it('interior: área de 3 dígitos', () => {
    assert.deepEqual(splitArgentinePhone('0351 456-7890'), {
      areaCode: '351',
      number: '4567890',
    });
    assert.deepEqual(splitArgentinePhone('+5493514567890'), {
      areaCode: '351',
      number: '4567890',
    });
  });

  it('descarta el prefijo 15 de celular local', () => {
    assert.deepEqual(splitArgentinePhone('011 15 5555-6666'), {
      areaCode: '11',
      number: '55556666',
    });
  });

  it('vacío / basura → par vacío', () => {
    assert.deepEqual(splitArgentinePhone(''), { areaCode: '', number: '' });
    assert.deepEqual(splitArgentinePhone(undefined), {
      areaCode: '',
      number: '',
    });
    assert.deepEqual(splitArgentinePhone('---'), { areaCode: '', number: '' });
  });

  it('un número muy corto va entero a number, sin área inventada', () => {
    assert.deepEqual(splitArgentinePhone('1234'), {
      areaCode: '',
      number: '1234',
    });
  });

  it('phoneParts explícitas saltean la heurística', () => {
    const payload = buildCorreoOrderPayload(
      input({
        recipient: {
          ...input().recipient,
          phone: '011 4123-4567',
          phoneParts: { areaCode: '2954', number: '123456' },
        },
      }),
      options(),
    );
    assert.equal(payload.order.shippingData.areaCodePhone, '2954');
    assert.equal(payload.order.shippingData.phoneNumber, '123456');
  });

  it('sin celular propio se reusa el fijo (el repartidor avisa por celular)', () => {
    const payload = buildCorreoOrderPayload(input(), options());
    assert.equal(payload.order.shippingData.areaCodeCellphone, '11');
    assert.equal(payload.order.shippingData.cellphoneNumber, '55556666');
  });

  it('sin teléfono, los cuatro campos salen vacíos (nunca undefined)', () => {
    const payload = buildCorreoOrderPayload(
      input({
        recipient: { ...input().recipient, phone: undefined },
      }),
      options(),
    );
    assert.equal(payload.order.shippingData.areaCodePhone, '');
    assert.equal(payload.order.shippingData.phoneNumber, '');
    assert.equal(payload.order.shippingData.areaCodeCellphone, '');
    assert.equal(payload.order.shippingData.cellphoneNumber, '');
  });
});
