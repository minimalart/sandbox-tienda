import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveTintingGate } from './tinting-gate';

const carta = { enabled: true, colorCount: 2848, ready: true };
const cartaVacia = { enabled: true, colorCount: 0, ready: false };
/** Carta entera importada y ni una base dada de alta como producto. */
const cartaSinBases = { enabled: true, colorCount: 2848, ready: false };
const erpApagado = { enabled: false, colorCount: 0, ready: false };

describe('resolveTintingGate', () => {
  it('prende las dos llaves cuando el sitio la habilita y hay carta', () => {
    assert.deepEqual(resolveTintingGate({ siteTinting: true, isMainSite: false, catalog: carta }), {
      routeEnabled: true,
      catalogReady: true,
      reason: null,
    });
  });

  /**
   * El bug que se fue a producción: la principal se saltaba la llave del sitio, así
   * que el toggle de /app/sites no hacía nada. Ahora manda igual que en cualquier
   * otra tienda.
   */
  it('la tienda principal respeta el toggle de su fila', () => {
    assert.deepEqual(resolveTintingGate({ siteTinting: true, isMainSite: true, catalog: carta }), {
      routeEnabled: true,
      catalogReady: true,
      reason: null,
    });
    assert.deepEqual(resolveTintingGate({ siteTinting: false, isMainSite: true, catalog: carta }), {
      routeEnabled: false,
      catalogReady: false,
      reason: 'site-toggle-off',
    });
  });

  it('el toggle apagado gana sobre una carta cargada', () => {
    const gate = resolveTintingGate({ siteTinting: false, isMainSite: false, catalog: carta });
    assert.equal(gate.routeEnabled, false);
    assert.equal(gate.reason, 'site-toggle-off');
  });

  /**
   * El caso de desdeelsur: fila prendida, ERP prendido, CERO colores importados.
   * La ruta tiene que existir igual — si no, todo link a /colores (el hero que se
   * carga desde el admin, por ejemplo) cae en un not-found sin explicación.
   */
  it('prendida y sin carta: la ruta existe pero no hay grilla ni link', () => {
    assert.deepEqual(
      resolveTintingGate({ siteTinting: true, isMainSite: true, catalog: cartaVacia }),
      { routeEnabled: true, catalogReady: false, reason: 'empty-catalog' }
    );
  });

  /**
   * El estado real de desdeelsur el 2026-08-20: 2848 colores, 117 bases
   * confirmadas y CERO artículos en Medusa. La grilla se pintaba entera y cada
   * color caía en "por ahora no tenemos productos con X en esta tienda".
   */
  it('con carta pero sin base vendible tampoco hay grilla', () => {
    assert.deepEqual(
      resolveTintingGate({ siteTinting: true, isMainSite: true, catalog: cartaSinBases }),
      { routeEnabled: true, catalogReady: false, reason: 'no-sellable-bases' }
    );
  });

  /** La carta vacía se reporta como tal aunque tampoco haya bases: se arregla antes. */
  it('sin carta gana empty-catalog sobre no-sellable-bases', () => {
    assert.equal(
      resolveTintingGate({ siteTinting: true, isMainSite: true, catalog: cartaVacia }).reason,
      'empty-catalog'
    );
  });

  it('el switch del ERP apagado apaga la ruta entera', () => {
    assert.deepEqual(
      resolveTintingGate({ siteTinting: true, isMainSite: false, catalog: erpApagado }),
      { routeEnabled: false, catalogReady: false, reason: 'erp-switch-off' }
    );
  });

  /**
   * Config del sitio ilegible: en la principal se cae al ERP (la fila puede no estar
   * sembrada todavía y no habría dónde prender el toggle); en una tienda se apaga,
   * que es el comportamiento que ya tenía.
   */
  it('sin config de sitio: la principal cae al ERP, una tienda se apaga', () => {
    assert.deepEqual(resolveTintingGate({ siteTinting: null, isMainSite: true, catalog: carta }), {
      routeEnabled: true,
      catalogReady: true,
      reason: null,
    });
    assert.deepEqual(
      resolveTintingGate({ siteTinting: null, isMainSite: true, catalog: erpApagado }),
      { routeEnabled: false, catalogReady: false, reason: 'erp-switch-off' }
    );
    assert.deepEqual(resolveTintingGate({ siteTinting: null, isMainSite: false, catalog: carta }), {
      routeEnabled: false,
      catalogReady: false,
      reason: 'site-config-unavailable',
    });
  });
});
