import { test } from 'node:test';
import assert from 'node:assert/strict';

import { whatsappTemplates } from './index';
import type { KapsoSettings } from '../settings';

/**
 * El contrato de los builders de template: son funciones PURAS de
 * `(data, settings)` y devuelven `null` cuando el nombre de la plantilla no está
 * configurado.
 *
 * Ese `null` es el interruptor de apagado y no un detalle de implementación:
 * `resolveTemplate` lo trata como "no hay plantilla" y loguea el skip. Sin él, el
 * builder armaría un payload con `name: ''` y Meta rechazaría el mensaje — un
 * error de la API en vez de una decisión de configuración.
 */

const settings = (templates: Partial<KapsoSettings['templates']>): KapsoSettings =>
  ({ templateLang: 'es', templates } as unknown as KapsoSettings);

test('listo para retirar: sin nombre configurado no se arma nada', () => {
  // Una tienda que no hace retiro en local no tiene esta plantilla aprobada por
  // Meta. El aviso tiene que salir sólo por mail, en silencio.
  const builder = whatsappTemplates['order-ready-for-pickup']!;
  assert.equal(builder({}, settings({ orderReadyForPickup: null })), null);
  assert.equal(builder({}, settings({ orderReadyForPickup: '' })), null);
});

test('listo para retirar: el orden del body es nombre, nº, sucursal, dirección', () => {
  // El ORDEN es el contrato con la plantilla aprobada: {{1}}..{{4}}. Si se
  // permuta, el mensaje sale con la dirección donde va el nombre.
  const builder = whatsappTemplates['order-ready-for-pickup']!;
  const payload = builder(
    {
      customer_name: 'Micaela Gómez',
      display_id: 10428,
      store_name: 'Elordi',
      store_address: 'Eduardo Elordi 1143',
    },
    settings({ orderReadyForPickup: 'order_ready_for_pickup' }),
  );

  assert.equal(payload?.name, 'order_ready_for_pickup');
  assert.equal(payload?.language.code, 'es');
  assert.deepEqual(payload?.components, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Micaela Gómez' },
        { type: 'text', text: '10428' },
        { type: 'text', text: 'Elordi' },
        { type: 'text', text: 'Eduardo Elordi 1143' },
      ],
    },
  ]);
});

test('listo para retirar: una variable que falta viaja vacía, no como "undefined"', () => {
  // `String(undefined)` da la cadena "undefined", que es lo que vería el cliente
  // en el mensaje. El `?? ''` de cada parámetro es lo que lo evita.
  const builder = whatsappTemplates['order-ready-for-pickup']!;
  const payload = builder(
    { customer_name: 'Micaela Gómez', display_id: 10428 },
    settings({ orderReadyForPickup: 'order_ready_for_pickup' }),
  );

  const parameters = (payload?.components?.[0] as { parameters: Array<{ text: string }> }).parameters;
  assert.equal(parameters[2]!.text, '');
  assert.equal(parameters[3]!.text, '');
});
