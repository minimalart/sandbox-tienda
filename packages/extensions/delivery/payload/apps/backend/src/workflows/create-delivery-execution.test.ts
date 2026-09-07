/**
 * `classify()` decide qué carrier ejecuta cada envío. Cuando se equivoca no
 * tira ningún error: la DeliveryExecution queda con el provider_type errado, el
 * poller consulta la API del carrier equivocado y el estado de la orden nunca
 * avanza. Por eso estos tests son casi todos guardas de regresión.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify,
  resolveChosenStoreLocationId,
} from './create-delivery-execution.ts';

type Method = Record<string, unknown>;

const method = (name: string, data: Record<string, unknown> = {}): Method => ({
  name,
  data,
});

describe('classify — Correo Argentino', () => {
  it('domicilio → correo_argentino / home_delivery', () => {
    assert.deepEqual(
      classify(
        [
          method('Envío por Correo Argentino', {
            carrier: 'correo-argentino',
            delivery_type: 'homeDelivery',
            service_type: 'CP',
          }),
        ],
        'correo_argentino_correo_argentino',
      ),
      { provider_type: 'correo_argentino', service_mode: 'home_delivery' },
    );
  });

  // ⚠️ EL caso que motivó la rama explícita de `carrier`. El nombre de la
  // opción sembrada contiene "sucursal", y `hasAndreaniHint()` matchea esa
  // palabra: sin la guarda, este envío se clasificaba como ANDREANI.
  it('sucursal → correo_argentino, NO andreani (el nombre dice "sucursal")', () => {
    const result = classify(
      [
        method('Retiro en sucursal de Correo Argentino', {
          carrier: 'correo-argentino',
          delivery_type: 'agency',
          service_type: 'CP',
          agency_id: 'DFB',
        }),
      ],
      'correo_argentino_correo_argentino',
    );

    assert.equal(result.provider_type, 'correo_argentino');
    assert.equal(result.service_mode, 'branch_pickup');
  });

  it('`carrier` gana aunque el nombre tenga hints de Andreani', () => {
    const result = classify(
      [
        method('Envío a domicilio punto HOP andreani', {
          carrier: 'correo-argentino',
          delivery_type: 'homeDelivery',
        }),
      ],
      undefined,
    );
    assert.equal(result.provider_type, 'correo_argentino');
  });

  it('sin delivery_type cae a home_delivery, no a sucursal', () => {
    const result = classify(
      [method('Correo Argentino', { carrier: 'correo-argentino' })],
      undefined,
    );
    assert.equal(result.provider_type, 'correo_argentino');
    assert.equal(result.service_mode, 'home_delivery');
  });

  it('tolera el separador del `carrier` (guión, guión bajo, token pelado)', () => {
    for (const carrier of [
      'correo-argentino',
      'correo_argentino',
      'Correo Argentino',
      'correo',
    ]) {
      assert.equal(
        classify([method('Envío estándar', { carrier })], undefined).provider_type,
        'correo_argentino',
        carrier,
      );
    }
  });

  it('`provider_id` del fulfillment alcanza, aunque el método no diga nada', () => {
    assert.deepEqual(
      classify([method('Envío estándar')], 'correo_argentino_correo_argentino'),
      { provider_type: 'correo_argentino', service_mode: 'home_delivery' },
    );
  });

  it('la fulfillment option `correo-*` alcanza sin `carrier`', () => {
    assert.deepEqual(
      classify([method('Envío estándar', { id: 'correo-sucursal' })], undefined),
      { provider_type: 'correo_argentino', service_mode: 'branch_pickup' },
    );
    assert.deepEqual(
      classify([method('Envío estándar', { id: 'correo-domicilio' })], undefined),
      { provider_type: 'correo_argentino', service_mode: 'home_delivery' },
    );
  });

  // Fallback por NOMBRE: es la señal más débil, pero tiene que funcionar para las
  // opciones sembradas antes de que el storefront empezara a estampar `carrier`.
  describe('sin `data.carrier` — fallback por nombre', () => {
    it('"Retiro en sucursal Correo" → correo_argentino / branch_pickup, NO andreani', () => {
      // ⚠️ REGRESIÓN DEL ORDEN DE LAS RAMAS. `hasAndreaniHint()` matchea
      // "sucursal": si la rama de Correo fuera DESPUÉS, esta opción quedaría
      // como Andreani y el sync consultaría la API equivocada para siempre.
      assert.deepEqual(classify([method('Retiro en sucursal Correo')], undefined), {
        provider_type: 'correo_argentino',
        service_mode: 'branch_pickup',
      });
    });

    it('"Envío a domicilio con Correo Argentino" → correo_argentino / home_delivery', () => {
      assert.deepEqual(
        classify([method('Envío a domicilio con Correo Argentino')], undefined),
        { provider_type: 'correo_argentino', service_mode: 'home_delivery' },
      );
    });

    it('exige el token `\\bcorreo\\b`: no se lleva puesta cualquier mención', () => {
      // El bug de §4.1 del PRD en espejo: "correo" es palabra corriente en
      // castellano y un `includes('correo')` laxo clasificaría todo esto como
      // Correo Argentino.
      //
      // LÍMITE CONOCIDO Y ACEPTADO: el token sí matchea "correo electrónico".
      // Endurecerlo más significaría divergir de `isCorreoShippingMethod()` —
      // que es la función que decide si el envío se da de alta en Correo — y
      // preferimos una opción mal nombrada a dos capas que se contradigan. La
      // salida correcta para ese caso es estampar `data.carrier`, que gana antes
      // de llegar al nombre.
      for (const name of ['Correspondencia certificada', 'Correos de Chile']) {
        assert.notEqual(
          classify([method(name)], undefined).provider_type,
          'correo_argentino',
          name,
        );
      }
    });
  });
});

describe('classify — Andreani sigue igual (regresión)', () => {
  it('service_type Domicilio / Sucursal / PuntoDeTercero', () => {
    const cases: Array<[string, string]> = [
      ['Domicilio', 'home_delivery'],
      ['Sucursal', 'branch_pickup'],
      ['PuntoDeTercero', 'hop'],
    ];
    for (const [serviceType, mode] of cases) {
      const result = classify([method('Andreani', { service_type: serviceType })], undefined);
      assert.equal(result.provider_type, 'andreani', serviceType);
      assert.equal(result.service_mode, mode, serviceType);
    }
  });

  it('hints por nombre sin service_type', () => {
    assert.deepEqual(
      classify([method('Retiro en sucursales')], 'andreani_andreani'),
      { provider_type: 'andreani', service_mode: 'branch_pickup' },
    );
    assert.deepEqual(classify([method('Punto HOP')], undefined), {
      provider_type: 'andreani',
      service_mode: 'hop',
    });
  });

  // La rama de Correo va PRIMERA, así que estos casos prueban que no se come
  // opciones ajenas: el veto por señal explícita de Andreani es lo que lo impide.
  it('una opción de Andreani que menciona "correo" sigue siendo Andreani', () => {
    assert.equal(
      classify(
        [method('Andreani a domicilio (ex correo)', { service_type: 'Domicilio' })],
        undefined,
      ).provider_type,
      'andreani',
    );
    assert.equal(
      classify([method('Retiro en sucursal Andreani del correo')], undefined)
        .provider_type,
      'andreani',
    );
    assert.equal(
      classify([method('Sucursal Correo', { carrier: 'andreani' })], undefined)
        .provider_type,
      'andreani',
    );
  });

  it('el `service_type` CP/EP de Correo no se confunde con el de Andreani', () => {
    // Correo escribe `service_type: 'CP' | 'EP'`; Andreani, 'Domicilio' |
    // 'Sucursal' | 'PuntoDeTercero'. Los vocabularios no se pisan, y por eso el
    // veto puede usar el campo sin arruinar a Correo.
    assert.equal(
      classify(
        [method('Retiro en sucursal Correo', { service_type: 'CP' })],
        undefined,
      ).provider_type,
      'correo_argentino',
    );
  });
});

describe('classify — service_mode derivado del deliveryType de Correo', () => {
  const cases: Array<[string, string, string]> = [
    ['homeDelivery', 'homeDelivery', 'home_delivery'],
    ['agency', 'agency', 'branch_pickup'],
    ['MiCorreo D', 'D', 'home_delivery'],
    ['MiCorreo S', 'S', 'branch_pickup'],
    ['castellano domicilio', 'domicilio', 'home_delivery'],
    ['castellano sucursal', 'sucursal', 'branch_pickup'],
  ];

  for (const [label, deliveryType, expected] of cases) {
    it(`${label} → ${expected}`, () => {
      const result = classify(
        [
          method('Correo Argentino', {
            carrier: 'correo-argentino',
            delivery_type: deliveryType,
          }),
        ],
        undefined,
      );
      assert.equal(result.provider_type, 'correo_argentino');
      assert.equal(result.service_mode, expected);
    });
  }

  it('un delivery_type basura no inventa una sucursal', () => {
    // `agency` sin `agency_id` sería un envío imposible de dar de alta: ante la
    // duda, domicilio.
    const result = classify(
      [
        method('Correo Argentino', {
          carrier: 'correo-argentino',
          delivery_type: 'locker',
        }),
      ],
      undefined,
    );
    assert.equal(result.service_mode, 'home_delivery');
  });
});

describe('classify — otras modalidades', () => {
  it('pickup_kind store gana sobre el hint "sucursal"', () => {
    assert.deepEqual(
      classify([method('Retiro en sucursal', { pickup_kind: 'store' })], undefined),
      { provider_type: 'store_pickup', service_mode: 'store_pickup' },
    );
  });

  it('flota propia explícita', () => {
    assert.deepEqual(classify([method('Envío con flota propia')], undefined), {
      provider_type: 'own_fleet',
      service_mode: 'home_delivery',
    });
  });

  // El fallback es silencioso por diseño, pero conviene tenerlo pineado: es lo
  // que se lleva cualquier carrier nuevo que se olviden de agregar arriba.
  it('sin ninguna señal cae a own_fleet / home_delivery', () => {
    assert.deepEqual(classify([method('Envío estándar')], undefined), {
      provider_type: 'own_fleet',
      service_mode: 'home_delivery',
    });
    assert.deepEqual(classify([], undefined), {
      provider_type: 'own_fleet',
      service_mode: 'home_delivery',
    });
  });
});

/**
 * La sucursal de retiro la ELIGE el comprador, pero antes se deducía del stock
 * location del fulfillment. Con dos sucursales apuntando al mismo
 * `stock_location_id` —depósito compartido, o un mapeo mal cargado en el Admin—
 * esa deducción devuelve una CUALQUIERA, y la orden termina asignada a una
 * sucursal que el comprador nunca eligió. Sin error, sin log: sólo un pedido
 * esperando en el mostrador equivocado.
 */
describe('resolveChosenStoreLocationId', () => {
  it('lee la sucursal elegida de la metadata de la orden', () => {
    assert.equal(
      resolveChosenStoreLocationId({ store_id: 'sloc_melipal' }, []),
      'sloc_melipal',
    );
  });

  it('la metadata GANA sobre el `data` del shipping method', () => {
    assert.equal(
      resolveChosenStoreLocationId({ store_id: 'sloc_melipal' }, [
        method('Retiro en tienda', {
          pickup_kind: 'store',
          store_id: 'sloc_elflein',
        }),
      ]),
      'sloc_melipal',
    );
  });

  it('cae al `data` del shipping method cuando la metadata no la trae', () => {
    assert.equal(
      resolveChosenStoreLocationId({ shipping_method: 'retiro_store' }, [
        method('Retiro en tienda', {
          pickup_kind: 'store',
          store_id: 'sloc_km13',
        }),
      ]),
      'sloc_km13',
    );
  });

  // ⚠️ REGRESIÓN. Al cambiar de modo de entrega el storefront no BORRA el
  // campo: escribe `store_id: ''`. Si el string vacío se leyera como id, la
  // validación contra store_location fallaría y —peor— tapa el fallback por
  // stock location, dejando la ejecución sin sucursal.
  it('el string vacío es "no eligió", no un id', () => {
    assert.equal(resolveChosenStoreLocationId({ store_id: '' }, []), null);
    assert.equal(resolveChosenStoreLocationId({ store_id: '   ' }, []), null);
    assert.equal(
      resolveChosenStoreLocationId({ store_id: '' }, [
        method('Retiro en tienda', { store_id: 'sloc_elordi' }),
      ]),
      'sloc_elordi',
    );
  });

  it('sin elección devuelve null (y el fallback por stock location sigue vivo)', () => {
    assert.equal(resolveChosenStoreLocationId({}, []), null);
    assert.equal(resolveChosenStoreLocationId(undefined, []), null);
    assert.equal(resolveChosenStoreLocationId(null, []), null);
    assert.equal(
      resolveChosenStoreLocationId({}, [method('Retiro en tienda')]),
      null,
    );
  });

  it('no se cae con metadata que no es un objeto', () => {
    assert.equal(resolveChosenStoreLocationId('sloc_elflein', []), null);
    assert.equal(resolveChosenStoreLocationId(42, []), null);
    assert.equal(resolveChosenStoreLocationId([{ store_id: 'x' }], []), null);
  });

  it('toma la primera sucursal presente cuando hay varios shipping methods', () => {
    assert.equal(
      resolveChosenStoreLocationId({}, [
        method('Envío estándar'),
        method('Retiro en tienda', { store_id: 'sloc_melipal' }),
      ]),
      'sloc_melipal',
    );
  });
});
