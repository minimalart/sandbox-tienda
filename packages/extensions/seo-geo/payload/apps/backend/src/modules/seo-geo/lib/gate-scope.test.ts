import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gateScopeForUrl } from './gate-scope';

const HOST = 'https://mercatto.minimalart.studio';

describe('gateScopeForUrl', () => {
  /**
   * El scope es ENTRADA DEL HMAC, así que estos casos no son cosmética: firmar con
   * un scope distinto al que calcula el storefront no da error, da un token que no
   * valida — y el crawl se queda afuera del gate sin ninguna señal de por qué.
   */
  it('una tienda secundaria firma con su slug', () => {
    assert.equal(gateScopeForUrl(`${HOST}/tienda/desde-el-sur`), 'site:desde-el-sur');
    assert.equal(gateScopeForUrl(`${HOST}/tienda/desde-el-sur/store`), 'site:desde-el-sur');
  });

  it('la tienda principal firma con `store`', () => {
    assert.equal(gateScopeForUrl(HOST), 'store');
    assert.equal(gateScopeForUrl(`${HOST}/`), 'store');
    assert.equal(gateScopeForUrl(`${HOST}/store`), 'store');
  });

  it('el segmento de país no cambia el scope', () => {
    // `pathSegments` lo descarta; si no lo hiciera, el scope saldría `store` para
    // una tienda que sí tiene gate y el crawl quedaría contra la pantalla de acceso.
    assert.equal(gateScopeForUrl(`${HOST}/ar/tienda/desde-el-sur`), 'site:desde-el-sur');
    assert.equal(gateScopeForUrl(`${HOST}/ar/store`), 'store');
  });

  it('`/tienda` sin slug no inventa una tienda', () => {
    assert.equal(gateScopeForUrl(`${HOST}/tienda`), 'store');
  });
});
