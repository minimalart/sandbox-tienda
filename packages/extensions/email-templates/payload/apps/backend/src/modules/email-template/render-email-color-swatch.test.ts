import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderPuckEmailHtml, type PuckEmailDocument } from './render-email';
import { renderEmailTemplate } from './render';
import { orderNotificationAdminTemplate } from '../email/templates/order-notification-admin';

/**
 * El cuadradito de color entonado, en los DOS mails que lo dibujan: el de las
 * plantillas de la base (bloque `LineItems`) y el aviso interno del equipo.
 *
 * El bug que reporto QA en DESDEELSUR-64: con un nombre de color largo el
 * cuadradito salia estirado como un rectangulo. El `<td>` pintado era hermano
 * del `<td>` del texto, y `height:12px` en una celda es un MINIMO — el fondo
 * pinta la celda entera y la celda mide lo que mida la fila. Con el texto
 * envuelto en dos lineas la fila pasa de 20px a 40px y se lleva el color puesto.
 *
 * Nada de esto se ve en un test que sólo busque el hex: el markup roto tambien
 * lo contiene. Lo que hay que afirmar es la ESTRUCTURA.
 */

/** Hex deliberadamente improbable: sólo puede venir del swatch, nunca del branding. */
const HEX = '#7f3ac1';
const LABEL = 'Mimos de Frutos Rojos';

/**
 * Entre el `<td>` pintado y el texto del color tiene que haber un `</table>`:
 * es la prueba de que el cuadradito vive en su propia tabla y fija su altura en
 * vez de heredar la de la fila. Si vuelve a ser celda hermana, entre uno y otro
 * sólo queda `</td><td`, y este assert es el que avisa.
 */
function assertSwatchIsolatedFromLabel(html: string) {
  const painted = html.indexOf(HEX);
  assert.notEqual(painted, -1, 'no se pinto el swatch con el hex del color');

  const label = html.indexOf('Color:', painted);
  assert.notEqual(label, -1, 'no aparece la etiqueta del color despues del swatch');

  assert.ok(
    html.slice(painted, label).includes('</table>'),
    'el td pintado volvio a ser hermano del texto: con un nombre de color de dos lineas el cuadradito se estira',
  );
}

/** El cuadrado sigue siendo un cuadrado de 12px, no se "arreglo" sacandole la altura. */
function assertSwatchKeepsItsBox(html: string) {
  const painted = html.indexOf(HEX);
  const cellStart = html.lastIndexOf('<td', painted);
  const cell = html.slice(cellStart, painted);

  assert.match(cell, /width="12"/, 'el swatch perdio su ancho fijo');
  assert.match(cell, /height="12"/, 'el swatch perdio su alto fijo');
}

test('plantillas de la base: el swatch no se estira con un nombre de color largo', async () => {
  const design: PuckEmailDocument = {
    content: [{ type: 'LineItems', props: { id: 'li1' } } as never],
  };

  const html = await renderPuckEmailHtml(design);
  const out = renderEmailTemplate({
    subject: '',
    html,
    data: {
      order_items: [
        {
          title: 'Albalatex Interior Mate',
          color_label: LABEL,
          color_hex: HEX,
          quantity: 1,
          unit_price_formatted: '16.535',
          line_total_formatted: '16.535',
        },
      ],
    },
  }).html;

  assert.match(out, new RegExp(LABEL));
  assertSwatchIsolatedFromLabel(out);
  assertSwatchKeepsItsBox(out);
});

test('aviso interno: el swatch no se estira con un nombre de color largo', () => {
  const out = orderNotificationAdminTemplate({
    order_items: [
      {
        title: 'Albalatex Interior Mate',
        color_label: LABEL,
        color_hex: HEX,
        quantity: 1,
        unit_price_formatted: '16.535',
        line_total_formatted: '16.535',
      },
    ],
  }).html;

  assert.match(out, new RegExp(LABEL));
  assertSwatchIsolatedFromLabel(out);
  assertSwatchKeepsItsBox(out);
});

test('sin color entonado no se emite ningun swatch', async () => {
  const design: PuckEmailDocument = {
    content: [{ type: 'LineItems', props: { id: 'li1' } } as never],
  };

  const html = await renderPuckEmailHtml(design);
  const out = renderEmailTemplate({
    subject: '',
    html,
    data: {
      order_items: [
        {
          title: 'Rodillo de lana 22 cm',
          quantity: 2,
          unit_price_formatted: '4.200',
          line_total_formatted: '8.400',
        },
      ],
    },
  }).html;

  assert.doesNotMatch(out, /Color:/);
});
