/**
 * Guarda anti-contaminación del lado de Andreani.
 *
 * Con dos carriers en el mismo sistema el riesgo nuevo es que cada listado se
 * lleve los envíos del otro: el admin de Andreani mostrando envíos de Correo, o
 * su descarga masiva pidiéndole rótulos a Andreani por trackings ajenos. El
 * criterio secundario de `isAndreaniFulfillment()` ("cualquier fulfillment con
 * tracking_number") era inofensivo mientras Andreani era el único carrier.
 *
 * Estos tests viven ACÁ y no en el módulo de Correo a propósito: la cobertura de
 * una función tiene que viajar con la extensión que la posee. Un test de Correo
 * que importe de `andreani-fulfillment` no compila en un proyecto que seleccione
 * Correo sin Andreani, que es un combo válido del catálogo.
 *
 * Por eso los envíos ajenos se expresan con literales (`'correo-argentino'`) y
 * no importando nada del otro módulo: alcanza para pinear la separación y no
 * acopla las dos extensiones.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAndreaniFulfillment } from './list-fulfillments.ts';

describe('isAndreaniFulfillment', () => {
  it('reconoce los suyos por provider_id', () => {
    assert.equal(
      isAndreaniFulfillment({ id: 'a', provider_id: 'andreani_andreani' }),
      true,
    );
  });

  it('reconoce los suyos por tracking_number suelto (criterio secundario)', () => {
    assert.equal(
      isAndreaniFulfillment({ id: 'b', data: { tracking_number: 'AN999' } }),
      true,
    );
  });

  it('reconoce los suyos con carrier explícito', () => {
    assert.equal(
      isAndreaniFulfillment({
        id: 'c',
        data: { carrier: 'andreani', tracking_number: 'AN999' },
      }),
      true,
    );
  });

  // El test que importa: sin la guarda, este caso daría `true` por el criterio
  // secundario y Andreani se llevaría un envío de Correo.
  it('NO se lleva un envío de otro carrier que ya tiene tracking_number', () => {
    assert.equal(
      isAndreaniFulfillment({
        id: 'd',
        provider_id: 'manual_manual',
        data: { carrier: 'correo-argentino', tracking_number: 'CA123' },
      }),
      false,
    );
  });

  it('un carrier ajeno descalifica incluso sin tracking_number', () => {
    assert.equal(
      isAndreaniFulfillment({
        id: 'e',
        provider_id: 'manual_manual',
        data: { carrier: 'correo-argentino' },
      }),
      false,
    );
  });
});
