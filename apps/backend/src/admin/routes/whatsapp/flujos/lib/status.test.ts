import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MINIMAP_AUTO_FROM, shouldShowMinimap, statusPills, type StatusInput } from './status';

const base: StatusInput = {
  hasDraft: false,
  activeVersion: null,
  dirty: false,
  saveState: 'idle',
  issueCount: 0,
};

const textos = (input: Partial<StatusInput>): string[] =>
  statusPills({ ...base, ...input }).map((p) => p.text);

describe('lo que dice el header', () => {
  it('un recorrido que nunca se publicó lo dice', () => {
    assert.deepEqual(textos({}), ['Sin publicar']);
  });

  it('publicado y sin borrador: lo que ves es lo que atiende a los clientes', () => {
    // Publicar no COPIA el borrador, lo convierte en la versión activa: después de
    // publicar no hay borrador hasta el próximo guardado, y ese estado merece una
    // sola etiqueta y no dos.
    assert.deepEqual(textos({ activeVersion: 7 }), ['Publicado · v7']);
  });

  it('con borrador guardado, las dos cosas son ciertas a la vez', () => {
    assert.deepEqual(textos({ activeVersion: 7, hasDraft: true }), [
      'Publicado · v7',
      'Borrador · Guardado',
    ]);
  });

  it('con cambios en el canvas avisa que hay algo sin guardar', () => {
    assert.deepEqual(textos({ activeVersion: 7, hasDraft: true, dirty: true }), [
      'Publicado · v7',
      'Borrador · Cambios sin guardar',
    ]);
  });

  it('mientras guarda lo dice', () => {
    assert.ok(textos({ dirty: true, saveState: 'saving' }).includes('Guardando…'));
  });

  it('si el guardado falló, eso gana sobre "cambios sin guardar"', () => {
    // "Cambios sin guardar" suena a que podés irte tranquilo y volver; un guardado
    // que falló significa exactamente lo contrario.
    assert.ok(textos({ dirty: true, saveState: 'error' }).includes('No se pudo guardar'));
    assert.ok(!textos({ dirty: true, saveState: 'error' }).includes('Borrador · Cambios sin guardar'));
  });

  it('los problemas se cuentan en singular y en plural', () => {
    assert.ok(textos({ issueCount: 1 }).includes('1 problema'));
    assert.ok(textos({ issueCount: 3 }).includes('3 problemas'));
  });

  it('sin problemas no aparece la etiqueta', () => {
    assert.ok(!textos({ issueCount: 0 }).some((t) => t.includes('problema')));
  });

  it('sólo el de problemas se puede tocar', () => {
    const pills = statusPills({ ...base, activeVersion: 2, hasDraft: true, issueCount: 2 });
    assert.deepEqual(
      pills.filter((p) => p.clickable).map((p) => p.key),
      ['issues'],
    );
  });

  it('el color distingue lo que urge de lo que no', () => {
    const pills = statusPills({ ...base, activeVersion: 1, dirty: true, issueCount: 1 });
    assert.equal(pills.find((p) => p.key === 'published')?.color, 'green');
    assert.equal(pills.find((p) => p.key === 'draft')?.color, 'orange');
    assert.equal(pills.find((p) => p.key === 'issues')?.color, 'red');
  });
});

describe('cuándo aparece el minimapa', () => {
  it('con un recorrido chico no ocupa lugar para nada', () => {
    assert.equal(shouldShowMinimap(null, 3), false);
  });

  it('cuando el recorrido ya no entra de un vistazo, aparece solo', () => {
    assert.equal(shouldShowMinimap(null, MINIMAP_AUTO_FROM), true);
  });

  it('si el operador lo cerró, se queda cerrado aunque el recorrido crezca', () => {
    assert.equal(shouldShowMinimap(false, 50), false);
  });

  it('y si lo abrió, se queda abierto aunque sea chico', () => {
    assert.equal(shouldShowMinimap(true, 1), true);
  });
});
