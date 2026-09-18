import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown } from './html-to-markdown.ts';

describe('htmlToMarkdown', () => {
  it('devuelve null para input vacío o whitespace', () => {
    assert.equal(htmlToMarkdown(null), null);
    assert.equal(htmlToMarkdown(undefined), null);
    assert.equal(htmlToMarkdown(''), null);
    assert.equal(htmlToMarkdown('   \n\t  '), null);
    assert.equal(htmlToMarkdown('<div>   </div>'), null);
    assert.equal(htmlToMarkdown('<p></p><p></p>'), null);
  });

  it('pasa texto plano sin cambios (colapsa whitespace)', () => {
    assert.equal(htmlToMarkdown('Hola mundo'), 'Hola mundo');
    assert.equal(htmlToMarkdown('Hola    mundo'), 'Hola mundo');
    assert.equal(htmlToMarkdown('  Hola mundo  '), 'Hola mundo');
  });

  it('descarta atributos ruido del builder de Odoo (data-oe-*, class, style)', () => {
    const input = '<div data-oe-version="1.2" class="s_text" style="color:red">Contenido</div>';
    assert.equal(htmlToMarkdown(input), 'Contenido');
  });

  it('convierte encabezados <h1>..<h6> a #..###### ', () => {
    assert.equal(htmlToMarkdown('<h1>Uno</h1>'), '# Uno');
    assert.equal(htmlToMarkdown('<h3>Características</h3>'), '### Características');
    assert.equal(htmlToMarkdown('<h6>Fine print</h6>'), '###### Fine print');
  });

  it('separa bloques con doble newline (no acumula corridas)', () => {
    const input = '<p>Primero</p><p>Segundo</p><p>Tercero</p>';
    assert.equal(htmlToMarkdown(input), 'Primero\n\nSegundo\n\nTercero');
  });

  it('convierte <strong>/<b> a **bold** y <em>/<i> a *italic*', () => {
    assert.equal(htmlToMarkdown('<p>Hola <b>mundo</b></p>'), 'Hola **mundo**');
    assert.equal(htmlToMarkdown('<p>Hola <strong>mundo</strong></p>'), 'Hola **mundo**');
    assert.equal(htmlToMarkdown('<p>Hola <i>mundo</i></p>'), 'Hola *mundo*');
    assert.equal(htmlToMarkdown('<p>Hola <em>mundo</em></p>'), 'Hola *mundo*');
  });

  it('omite marcadores de énfasis cuando el contenido interno es vacío', () => {
    assert.equal(htmlToMarkdown('<b></b>hola'), 'hola');
    assert.equal(htmlToMarkdown('<em>  </em>hola'), 'hola');
  });

  it('preserva <u> como texto plano (Markdown no tiene subrayado)', () => {
    assert.equal(htmlToMarkdown('<p><u>Subrayado</u></p>'), 'Subrayado');
  });

  it('convierte <br> a salto de línea inline', () => {
    assert.equal(htmlToMarkdown('<p>Linea 1<br>Linea 2</p>'), 'Linea 1\nLinea 2');
  });

  it('convierte listas <ul>/<ol> con bullets y numeración', () => {
    const ul = '<ul><li>Alpha</li><li>Beta</li><li>Gamma</li></ul>';
    assert.equal(htmlToMarkdown(ul), '- Alpha\n- Beta\n- Gamma');

    const ol = '<ol><li>Primero</li><li>Segundo</li></ol>';
    assert.equal(htmlToMarkdown(ol), '1. Primero\n2. Segundo');
  });

  it('descarta <li> vacíos sin corromper la numeración', () => {
    const ol = '<ol><li>Uno</li><li>  </li><li>Tres</li></ol>';
    assert.equal(htmlToMarkdown(ol), '1. Uno\n2. Tres');
  });

  it('convierte <a href> a link Markdown', () => {
    const input = '<p>Ver <a href="https://example.com">docs</a></p>';
    assert.equal(htmlToMarkdown(input), 'Ver [docs](https://example.com)');
  });

  it('mantiene solo el label cuando <a> no tiene href', () => {
    assert.equal(htmlToMarkdown('<a>docs</a>'), 'docs');
    assert.equal(htmlToMarkdown('<a href="">docs</a>'), 'docs');
  });

  it('aplana tags fuera de la allowlist (span/figure/section desconocidos)', () => {
    assert.equal(htmlToMarkdown('<p>Hola <span>mundo</span></p>'), 'Hola mundo');
    assert.equal(htmlToMarkdown('<figure>caption</figure>'), 'caption');
  });

  it('convierte <hr> a --- como bloque propio', () => {
    const input = '<p>arriba</p><hr><p>abajo</p>';
    assert.equal(htmlToMarkdown(input), 'arriba\n\n---\n\nabajo');
  });

  it('caso real: description_ecommerce con div/b anidados (Combo Pupitre y Silla)', () => {
    // Muestra exacta del CSV dumpeado — SKU MOB-S10935-EB.
    const input =
      '<div data-oe-version="1.2">Moderniza el aula con este ' +
      '<b>set de pupitre y silla diseñado para la escuela actual</b>. ' +
      'Pensado específicamente para el nivel primario.</div>';
    assert.equal(
      htmlToMarkdown(input),
      'Moderniza el aula con este **set de pupitre y silla diseñado para la escuela actual**. Pensado específicamente para el nivel primario.'
    );
  });

  it('caso real: website_description con h3 + lista de features', () => {
    // Muestra representativa del CSV dumpeado — patrón "Características + ul/li".
    const input =
      '<h3 data-oe-version="1.2">Características Principales</h3>' +
      '<div><br></div>' +
      '<ul>' +
      '<li><p><b>Ergonomía Activa (Silla):</b></p>' +
      '<ul><li><p><b>Diseño Cantilever:</b> La estructura sin patas traseras.</p></li></ul>' +
      '</li>' +
      '</ul>';
    const out = htmlToMarkdown(input);
    // No asertamos byte-por-byte por la anidación (sensible a whitespace); sí
    // asertamos las señales estructurales que hacen útil el output.
    assert.ok(out, 'debería producir markdown');
    assert.match(out!, /### Características Principales/);
    assert.match(out!, /- \*\*Ergonomía Activa \(Silla\):\*\*/);
    assert.match(out!, /Diseño Cantilever/);
    assert.match(out!, /estructura sin patas traseras/);
  });

  it('nunca deja trailing whitespace ni corridas de 3+ newlines', () => {
    const input = '<p>Uno</p>\n\n\n<p>Dos</p>\n\n\n';
    const out = htmlToMarkdown(input);
    assert.ok(out);
    assert.doesNotMatch(out!, /\n{3,}/);
    assert.equal(out!.endsWith('\n'), false);
    assert.equal(out!.startsWith('\n'), false);
  });

  it('respeta &amp; y otras entidades HTML', () => {
    assert.equal(htmlToMarkdown('<p>Fresh &amp; Clean</p>'), 'Fresh & Clean');
    assert.equal(htmlToMarkdown('<p>menor &lt; 5</p>'), 'menor < 5');
  });
});
