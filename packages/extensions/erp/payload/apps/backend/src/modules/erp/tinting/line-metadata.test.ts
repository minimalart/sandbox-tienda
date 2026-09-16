import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TintingSelection } from '../service.ts';
import { tintColorLabel, tintLineSubtitle, tintLineTitle } from './line-metadata.ts';

/**
 * Estos tests existen por una tarjeta que nadie veía.
 *
 * El color entonado se guardaba en `metadata.tint` y en `subtitle` de la línea,
 * y el detalle de orden del admin no renderiza NINGUNO de los dos: el resumen
 * pinta `title`, `variant_sku` y las opciones de la variante, y nada más. El
 * color sólo aparecía en un widget al fondo de la página, detrás de otras ocho
 * tarjetas, así que para saber qué preparar había que scrollear hasta abajo.
 *
 * Mover el widget no era opción: los sufijos `.before`/`.after` de las zonas de
 * inyección son legacy y el layout composer de Medusa 2.18 los descarta. La
 * única palanca que pone el color dentro de la tarjeta del pedido es `title`.
 */

/** Sólo lo que leen estas funciones; el resto de la selección no les importa. */
function selection(color: { name: string; code: string }): TintingSelection {
  return { color } as unknown as TintingSelection;
}

const VINO = selection({ name: 'Vino Clásico', code: '09YR 05/305' });

test('el título lleva el producto y el color, en ese orden', () => {
  assert.equal(
    tintLineTitle('Marble color fino x25 kg', VINO),
    'Marble color fino x25 kg — Vino Clásico (09YR 05/305)'
  );
});

test('sin título de producto NO se inventa uno', () => {
  // Devolver un string acá escribiría "undefined — Vino Clásico" en la orden.
  // `undefined` deja que el workflow caiga al título del producto, como siempre.
  assert.equal(tintLineTitle(undefined, VINO), undefined);
  assert.equal(tintLineTitle(null, VINO), undefined);
  assert.equal(tintLineTitle('   ', VINO), undefined);
});

test('sin nombre de color queda el código, no un paréntesis vacío', () => {
  const soloCodigo = selection({ name: '', code: '09YR 05/305' });
  assert.equal(tintColorLabel(soloCodigo), '09YR 05/305');
  assert.equal(tintLineTitle('Marble', soloCodigo), 'Marble — 09YR 05/305');
});

test('sin código de color queda el nombre pelado', () => {
  const soloNombre = selection({ name: 'Vino Clásico', code: '' });
  assert.equal(tintColorLabel(soloNombre), 'Vino Clásico');
});

test('nombre igual al código no se repite entre paréntesis', () => {
  const igual = selection({ name: '09YR 05/305', code: '09YR 05/305' });
  assert.equal(tintColorLabel(igual), '09YR 05/305');
});

test('sin color de ningún tipo el título queda sólo con el producto', () => {
  const vacio = selection({ name: '', code: '' });
  assert.equal(tintColorLabel(vacio), '');
  assert.equal(tintLineTitle('Marble', vacio), 'Marble');
});

test('el subtítulo sigue diciendo el color con el mismo formato', () => {
  // `subtitle` se sigue seteando: lo renderizan los formularios de order-edit,
  // claim y exchange del admin. Tiene que decir el color igual que el título,
  // no de otra forma.
  assert.equal(tintLineSubtitle(VINO), 'Color: Vino Clásico (09YR 05/305)');
  assert.ok(tintLineSubtitle(VINO).endsWith(tintColorLabel(VINO)));
});
