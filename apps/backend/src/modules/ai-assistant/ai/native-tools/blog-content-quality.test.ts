import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  plainTextFromHtml,
  stripEmptySourcesSection,
  validateGeneratedBlogContentHtml,
} from './blog-content-quality.ts';

test('validateGeneratedBlogContentHtml rejects recipe stubs', () => {
  const result = validateGeneratedBlogContentHtml(
    '<h1>Lomo a la parrilla</h1><p>Receta tradicional...</p>',
  );

  assert.equal(result.ok, false);
  assert.ok(result.plainTextLength < 250);
  assert.match(result.message ?? '', /contenido es demasiado corto/);
});

test('validateGeneratedBlogContentHtml accepts complete article bodies', () => {
  const result = validateGeneratedBlogContentHtml(`
    <p>El lomo a la parrilla es una preparacion clasica para una comida completa, con una coccion lenta y pareja que permite conservar jugosidad y sabor.</p>
    <h2>Ingredientes</h2>
    <ul>
      <li>1 kilo de lomo</li>
      <li>Sal gruesa</li>
      <li>Pimienta negra</li>
      <li>Aceite</li>
      <li>Papas</li>
    </ul>
    <h2>Preparacion</h2>
    <ol>
      <li>Secar la carne, condimentarla y dejarla reposar unos minutos antes de llevarla a la parrilla.</li>
      <li>Cocinarla sobre brasas parejas, girandola para dorar todos sus lados sin apurar el centro.</li>
      <li>Preparar el acompanamiento mientras la carne descansa para que los jugos se redistribuyan.</li>
    </ol>
    <p>Servir el lomo cortado en medallones con el acompanamiento caliente y un ultimo ajuste de sal.</p>
  `);

  assert.equal(result.ok, true);
  assert.ok(result.plainTextLength >= 250);
});

test('plainTextFromHtml normalizes basic entities', () => {
  assert.equal(plainTextFromHtml('<p>Lomo&nbsp;&amp;&nbsp;papas</p>'), 'Lomo & papas');
});

test('stripEmptySourcesSection removes a Fuentes heading with an empty list', () => {
  const html = '<p>Cuerpo real de la receta.</p><h2>Fuentes</h2><ul><li></li></ul>';
  assert.equal(stripEmptySourcesSection(html), '<p>Cuerpo real de la receta.</p>');
});

test('stripEmptySourcesSection removes a Fuentes heading with no list at all', () => {
  const html = '<p>Cuerpo real.</p><h2>Fuentes</h2>';
  assert.equal(stripEmptySourcesSection(html), '<p>Cuerpo real.</p>');
});

test('stripEmptySourcesSection keeps a Fuentes section that has real links', () => {
  const html =
    '<p>Cuerpo.</p><h2>Fuentes</h2><ul><li><a href="https://ejemplo.com">ejemplo.com</a></li></ul>';
  assert.equal(stripEmptySourcesSection(html), html);
});

test('stripEmptySourcesSection leaves content without a Fuentes section untouched', () => {
  const html = '<h2>Ingredientes</h2><ul><li>Papa</li></ul>';
  assert.equal(stripEmptySourcesSection(html), html);
});
