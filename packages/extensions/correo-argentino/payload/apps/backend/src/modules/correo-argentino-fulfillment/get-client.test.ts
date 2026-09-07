import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { invalidateNamespace } from '../../lib/settings-cache.ts';
import type { SiteResolution } from '../../lib/multistore/types.ts';
import { __resetSnapshot } from '../app-settings/snapshot.ts';
import { CORREO_SETTINGS_NAMESPACE } from './settings.ts';
import { __resetCorreoClientCache, correoClientsFor } from './get-client.ts';
import { normalizeCorreoOptions } from './env-options.ts';

/**
 * La cache de clientes es POR HUELLA, no por tiempo, y las dos mitades de esa
 * frase son un requisito con nombre:
 *
 *  - Sin cache, `MiCorreoClient` pide un JWT nuevo (`POST /token`) en CADA
 *    cotización, o sea cada vez que el comprador toca el selector de envío.
 *    `AndreaniRateLimitError` existe en este repo porque ese patrón ya mordió.
 *  - Con cache POR TIEMPO, una credencial rotada desde el admin se seguiría usando
 *    hasta que venza el TTL, que es justo lo que la rotación viene a evitar.
 */

const logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

const options = (over: Record<string, unknown> = {}) =>
  normalizeCorreoOptions({
    apiKey: 'k',
    agreement: '18018',
    micorreo: { username: 'u', password: 'p', customerId: 'c' },
    ...over,
  });

const onSite = (id: string): SiteResolution => ({
  status: 'site',
  site: {
    id,
    slug: id,
    name: id,
    is_main: false,
    channel_ids: [],
    region_id: null,
    stock_location_id: null,
  },
});

beforeEach(() => {
  __resetCorreoClientCache();
  invalidateNamespace(CORREO_SETTINGS_NAMESPACE);
  __resetSnapshot();
});

afterEach(() => {
  __resetCorreoClientCache();
  __resetSnapshot();
});

describe('correoClientsFor — cache por huella', () => {
  it('reusa las MISMAS instancias con la misma configuración', () => {
    const a = correoClientsFor(options(), onSite('demo_norte'), logger);
    const b = correoClientsFor(options(), onSite('demo_norte'), logger);

    assert.equal(a.paqar, b.paqar, 'se reconstruyó paqar sin motivo');
    assert.equal(
      a.micorreo,
      b.micorreo,
      'se reconstruyó MiCorreo: eso es un POST /token por cotización',
    );
  });

  it('reconstruye MiCorreo cuando cambia una credencial suya', () => {
    const a = correoClientsFor(options(), onSite('demo_norte'), logger);
    const b = correoClientsFor(
      options({ micorreo: { username: 'u', password: 'ROTADA', customerId: 'c' } }),
      onSite('demo_norte'),
      logger,
    );

    assert.notEqual(a.micorreo, b.micorreo, 'siguió usando la contraseña vieja');
    assert.equal(a.paqar, b.paqar, 'rotar MiCorreo no tiene por qué tirar el de paqar');
  });

  it('reconstruye paqar cuando cambia el ACUERDO', () => {
    // El agreement viaja como header en cada request: un cliente cacheado con el
    // acuerdo viejo despacha contra la cuenta equivocada.
    const a = correoClientsFor(options(), onSite('demo_norte'), logger);
    const b = correoClientsFor(options({ agreement: '99999' }), onSite('demo_norte'), logger);

    assert.notEqual(a.paqar, b.paqar);
  });

  it('DOS TIENDAS NO COMPARTEN CLIENTE aunque su configuración sea idéntica', () => {
    // La clave es el scope; la huella sólo lo invalida. Compartir por huella haría
    // que dos tiendas con la misma config compartan el JWT — que hoy sería inocuo,
    // y dejaría de serlo el día que una de las dos rote su contraseña.
    const norte = correoClientsFor(options(), onSite('demo_norte'), logger);
    const sur = correoClientsFor(options(), onSite('demo_sur'), logger);

    assert.notEqual(norte.micorreo, sur.micorreo);
    assert.notEqual(norte.paqar, sur.paqar);
  });

  it('la instancia (sin tienda) tiene su propio scope', () => {
    const global = correoClientsFor(options(), undefined, logger);
    const norte = correoClientsFor(options(), onSite('demo_norte'), logger);

    assert.notEqual(global.paqar, norte.paqar);
    assert.equal(global.paqar, correoClientsFor(options(), undefined, logger).paqar);
  });
});
