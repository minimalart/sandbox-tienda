import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  below,
  CARD_HEIGHT,
  CARD_WIDTH,
  midpoint,
  nudgeFree,
  viewportCenterPosition,
} from './placement';

describe('dónde cae un paso nuevo', () => {
  const pantalla = { width: 1000, height: 600 };

  it('sin zoom ni desplazamiento, cae centrado en la pantalla', () => {
    // Centrado de verdad: la tarjeta tiene ancho, así que su esquina va media
    // tarjeta antes del centro. Sin eso el paso nuevo aparece corrido a la derecha.
    const p = viewportCenterPosition({ x: 0, y: 0, zoom: 1 }, pantalla);
    assert.deepEqual(p, { x: 500 - CARD_WIDTH / 2, y: 300 - CARD_HEIGHT / 2 });
  });

  it('con el canvas desplazado, cae donde el operador está mirando', () => {
    // Es el caso real: el operador arrastró el canvas 400px a la izquierda y
    // agrega un paso. Si no se descontara el pan, nacería fuera de la vista.
    const p = viewportCenterPosition({ x: -400, y: -200, zoom: 1 }, pantalla);
    assert.deepEqual(p, { x: 900 - CARD_WIDTH / 2, y: 500 - CARD_HEIGHT / 2 });
  });

  it('con zoom, traduce a coordenadas del grafo', () => {
    const p = viewportCenterPosition({ x: 0, y: 0, zoom: 2 }, pantalla);
    assert.deepEqual(p, { x: 250 - CARD_WIDTH / 2, y: 150 - CARD_HEIGHT / 2 });
  });

  it('un zoom en cero no rompe la cuenta', () => {
    // React Flow puede reportar 0 en el primer render, antes de medir.
    const p = viewportCenterPosition({ x: 0, y: 0, zoom: 0 }, pantalla);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });

  it('el punto medio entre dos pasos es donde va el insertado', () => {
    assert.deepEqual(midpoint({ x: 0, y: 0 }, { x: 100, y: 200 }), { x: 50, y: 100 });
  });

  it('colgar un paso lo pone abajo, no encima', () => {
    const p = below({ x: 40, y: 40 });
    assert.equal(p.x, 40);
    assert.ok(p.y > 40);
  });
});

describe('no dejar una tarjeta tapada por otra', () => {
  it('en un lugar libre no mueve nada', () => {
    assert.deepEqual(nudgeFree({ x: 100, y: 100 }, [{ x: 400, y: 400 }]), { x: 100, y: 100 });
  });

  it('si el lugar está ocupado, corre en diagonal', () => {
    // Sin esto, agregar dos pasos seguidos desde el mismo conector deja uno
    // perfectamente tapado: el operador ve una tarjeta y tiene dos.
    const p = nudgeFree({ x: 100, y: 100 }, [{ x: 100, y: 100 }]);
    assert.notDeepEqual(p, { x: 100, y: 100 });
    assert.ok(p.x > 100 && p.y > 100);
  });

  it('corre las veces que haga falta con varios ocupados', () => {
    const taken = [
      { x: 100, y: 100 },
      { x: 136, y: 136 },
      { x: 172, y: 172 },
    ];
    const p = nudgeFree({ x: 100, y: 100 }, taken);
    assert.ok(taken.every((t) => Math.abs(t.x - p.x) >= 36 || Math.abs(t.y - p.y) >= 36));
  });

  it('ignora los nodos sin posición guardada', () => {
    assert.deepEqual(nudgeFree({ x: 10, y: 10 }, [undefined, undefined]), { x: 10, y: 10 });
  });

  it('se rinde en vez de colgarse', () => {
    // Un grafo patológico no puede dejar el editor buscando lugar para siempre.
    const taken = Array.from({ length: 200 }, (_, i) => ({ x: 36 * i, y: 36 * i }));
    const p = nudgeFree({ x: 0, y: 0 }, taken, 36, 5);
    assert.ok(Number.isFinite(p.x));
  });
});
