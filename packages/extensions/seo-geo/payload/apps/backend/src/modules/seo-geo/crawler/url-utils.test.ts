import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyPageType, isInSiteScope, pathSegments } from './url-utils';

const HOST = 'https://mercatto.minimalart.studio';
const MAIN = HOST;
const SUB = `${HOST}/tienda/desde-el-sur`;

describe('isInSiteScope', () => {
  it('la tienda secundaria sólo abarca su propio prefijo', () => {
    assert.equal(isInSiteScope(`${SUB}`, SUB), true);
    assert.equal(isInSiteScope(`${SUB}/store`, SUB), true);
    assert.equal(isInSiteScope(`${SUB}/products/mate-imperial`, SUB), true);
    // Lo que rompía la auditoría de la captura: same-origin pero de la principal.
    assert.equal(isInSiteScope(`${HOST}/`, SUB), false);
    assert.equal(isInSiteScope(`${HOST}/store`, SUB), false);
    assert.equal(isInSiteScope(`${HOST}/tienda/otra-tienda`, SUB), false);
  });

  it('un prefijo que sólo comparte texto no cuenta como el mismo sitio', () => {
    assert.equal(isInSiteScope(`${HOST}/tienda/desde-el-sur-bis`, SUB), false);
  });

  it('la tienda principal es todo el host menos /tienda/*', () => {
    assert.equal(isInSiteScope(`${HOST}/`, MAIN), true);
    assert.equal(isInSiteScope(`${HOST}/store`, MAIN), true);
    assert.equal(isInSiteScope(`${HOST}/tienda/desde-el-sur`, MAIN), false);
  });

  it('el segmento de país no cambia el sitio', () => {
    assert.equal(isInSiteScope(`${HOST}/ar/tienda/desde-el-sur/store`, SUB), true);
    assert.equal(isInSiteScope(`${HOST}/ar/store`, MAIN), true);
  });

  it('otro host nunca entra', () => {
    assert.equal(isInSiteScope('https://otra.com/tienda/desde-el-sur', SUB), false);
  });
});

describe('classifyPageType', () => {
  it('clasifica relativo al sitio auditado', () => {
    assert.equal(classifyPageType(`${SUB}`, SUB), 'home');
    assert.equal(classifyPageType(`${SUB}/products/x`, SUB), 'product');
    assert.equal(classifyPageType(`${SUB}/store`, SUB), 'store');
    assert.equal(classifyPageType(`${SUB}/blog/una-nota`, SUB), 'blog');
  });

  it('sin baseUrl la tienda secundaria caía entera en other', () => {
    assert.equal(classifyPageType(`${SUB}/products/x`), 'other');
  });

  it('la principal se clasifica igual que antes', () => {
    assert.equal(classifyPageType(`${HOST}/`), 'home');
    assert.equal(classifyPageType(`${HOST}/products/x`), 'product');
    assert.equal(classifyPageType(`${HOST}/ar/products/x`), 'product');
    assert.equal(classifyPageType('no-es-una-url'), 'other');
  });
});

describe('pathSegments', () => {
  it('descarta el país y decodifica', () => {
    assert.deepEqual(pathSegments(`${HOST}/ar/categories/bebidas%20frias`), ['categories', 'bebidas frias']);
    assert.deepEqual(pathSegments(HOST), []);
  });
});
