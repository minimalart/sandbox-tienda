import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGAL_PAGE_DEFAULTS,
  mergeLegalPages,
  normalizeStoredDoc,
  sanitizeLegalHtml,
} from './defaults.ts';
import { LEGAL_PAGE_SLUGS } from './pages.ts';

describe('sanitizeLegalHtml', () => {
  it('conserva el formato que el editor puede producir', () => {
    const html =
      '<h3>Subtítulo</h3><p><strong>Uno</strong> y <em>dos</em></p><ul><li>a</li></ul>';
    assert.equal(sanitizeLegalHtml(html), html);
  });

  /**
   * El `h2` es el NOMBRE de la sección, que se edita en su propio campo. Uno dentro
   * del cuerpo daría dos encabezados del mismo nivel para el mismo panel del acordeón
   * y rompería el outline — que en una página legal es con lo que un lector de
   * pantalla navega el documento.
   */
  it('degrada el h2 del cuerpo a texto: ese nivel es el nombre de la sección', () => {
    const out = sanitizeLegalHtml('<h2>Título</h2><p>x</p>');
    assert.equal(out.includes('<h2'), false);
    // El TEXTO no se pierde, sólo la etiqueta: borrar el contenido sería peor.
    assert.ok(out.includes('Título'));
  });

  it('saca el script y se queda con su texto, no con el tag', () => {
    const out = sanitizeLegalHtml('<p>ok</p><script>alert(1)</script>');
    assert.equal(out.includes('<script'), false);
    assert.equal(out.includes('alert'), false);
  });

  it('saca el onclick pero deja el párrafo', () => {
    assert.equal(sanitizeLegalHtml('<p onclick="steal()">texto</p>'), '<p>texto</p>');
  });

  it('mata el href javascript: y deja el link relativo', () => {
    // El `href` se va y queda el `rel` que agrega el transform: el link deja de
    // navegar a ningún lado, que es lo que importa.
    assert.equal(
      sanitizeLegalHtml('<p><a href="javascript:alert(1)">x</a></p>'),
      '<p><a rel="noopener noreferrer">x</a></p>',
    );
    assert.equal(
      sanitizeLegalHtml('<p><a href="/contact">contacto</a></p>'),
      '<p><a href="/contact" rel="noopener noreferrer">contacto</a></p>',
    );
  });

  /**
   * `//host` es un link EXTERNO escrito con la forma de uno relativo: es el caso que
   * `allowProtocolRelative: false` existe para cortar, y el único que la lista de
   * esquemas no ve.
   */
  it('descarta el protocol-relative', () => {
    assert.equal(sanitizeLegalHtml('<p><a href="//evil.tld/x">x</a></p>').includes('evil.tld'), false);
  });

  it('saca las imágenes y los iframes, que el editor no ofrece', () => {
    assert.equal(sanitizeLegalHtml('<p>a</p><img src="x.png"><iframe src="y"></iframe>'), '<p>a</p>');
  });
});

describe('normalizeStoredDoc', () => {
  it('omite los campos vacíos en vez de guardarlos como cadena vacía', () => {
    // La distinción es la que mantiene prendido el aviso de "texto de ejemplo":
    // una clave presente con '' y una ausente se LEEN igual, pero sólo la ausente
    // cuenta como no personalizada.
    assert.deepEqual(
      normalizeStoredDoc({
        title: '  ',
        intro: '',
        updated_label: '  ',
        sections: [],
        seo_description: '',
      }),
      {},
    );
  });

  it('conserva el ORDEN de las secciones', () => {
    const out = normalizeStoredDoc({
      sections: [
        { id: 'b', name: 'Segunda', html: '<p>2</p>' },
        { id: 'a', name: 'Primera', html: '<p>1</p>' },
      ],
    });
    assert.deepEqual(out.sections?.map((s) => s.name), ['Segunda', 'Primera']);
  });

  it('sanea el cuerpo de cada sección al guardarlo', () => {
    const out = normalizeStoredDoc({
      sections: [{ id: 'a', name: 'Uno', html: '<p onclick="x()">hola</p>' }],
    });
    assert.equal(out.sections?.[0].html, '<p>hola</p>');
  });

  it('descarta la sección sin nombre y la sección sin cuerpo', () => {
    // Sin nombre no hay ítem de índice ni encabezado de acordeón; sin cuerpo el panel
    // se abre para mostrar nada. Publicarlas a medias es peor que no publicarlas.
    const out = normalizeStoredDoc({
      sections: [
        { id: 'a', name: '', html: '<p>huérfana</p>' },
        { id: 'b', name: 'Vacía', html: '   ' },
        { id: 'c', name: 'Buena', html: '<p>ok</p>' },
      ],
    });
    assert.deepEqual(out.sections?.map((s) => s.name), ['Buena']);
  });

  it('descarta la sección cuyo cuerpo quedó vacío después del saneado', () => {
    const out = normalizeStoredDoc({
      sections: [{ id: 'a', name: 'Uno', html: '<script>alert(1)</script>' }],
    });
    assert.deepEqual(out.sections, undefined);
  });

  it('completa el id ausente con la posición', () => {
    const out = normalizeStoredDoc({
      sections: [{ name: 'Uno', html: '<p>1</p>' }, { name: 'Dos', html: '<p>2</p>' }],
    });
    assert.deepEqual(out.sections?.map((s) => s.id), ['s1', 's2']);
  });

  it('descarta lo que no es objeto', () => {
    assert.deepEqual(normalizeStoredDoc(null), {});
    assert.deepEqual(normalizeStoredDoc('<p>x</p>'), {});
  });
});

describe('mergeLegalPages', () => {
  it('devuelve las tres páginas completas cuando no hay nada guardado', () => {
    const { pages, customized } = mergeLegalPages(undefined);
    for (const slug of LEGAL_PAGE_SLUGS) {
      assert.deepEqual(pages[slug], LEGAL_PAGE_DEFAULTS[slug]);
      assert.equal(customized[slug], false);
    }
  });

  it('marca personalizada SÓLO la página con secciones propias', () => {
    const { pages, customized } = mergeLegalPages({
      conditions: { sections: [{ id: 'a', name: 'Las mías', html: '<p>x</p>' }] },
    });
    assert.equal(customized.conditions, true);
    assert.equal(customized.legals, false);
    assert.equal(customized.exchangesAndReturns, false);
    assert.equal(pages.conditions.sections.length, 1);
    // Las otras dos siguen siendo el default, no quedan vacías.
    assert.deepEqual(pages.legals.sections, LEGAL_PAGE_DEFAULTS.legals.sections);
  });

  it('cambiar sólo el título o la bajada no cuenta como personalizada', () => {
    // Lo que el aviso denuncia es el CUERPO de ejemplo: renombrar la página no lo
    // reemplaza, y apagar el aviso ahí sería tapar el problema con un título.
    const { pages, customized } = mergeLegalPages({
      legals: { title: 'Privacidad', intro: 'Otra bajada' },
    });
    assert.equal(customized.legals, false);
    assert.equal(pages.legals.title, 'Privacidad');
    assert.equal(pages.legals.intro, 'Otra bajada');
    assert.deepEqual(pages.legals.sections, LEGAL_PAGE_DEFAULTS.legals.sections);
  });

  it('un array de secciones vacío vuelve al default, no publica una legal en blanco', () => {
    const { pages, customized } = mergeLegalPages({ legals: { sections: [] } });
    assert.deepEqual(pages.legals.sections, LEGAL_PAGE_DEFAULTS.legals.sections);
    assert.equal(customized.legals, false);
  });

  it('la fecha de actualización se guarda tal cual (es texto, no una fecha)', () => {
    const { pages } = mergeLegalPages({ legals: { updated_label: 'Agosto de 2026' } });
    assert.equal(pages.legals.updated_label, 'Agosto de 2026');
  });

  it('sanea también lo que ya estaba guardado', () => {
    // Defensa en profundidad: el saneado vive en la escritura, pero una fila escrita
    // por una versión anterior de la ruta —o a mano— no pasó por ahí.
    const { pages } = mergeLegalPages({
      legals: { sections: [{ id: 'a', name: 'Uno', html: '<p>ok</p><script>alert(1)</script>' }] },
    });
    assert.equal(pages.legals.sections[0].html, '<p>ok</p>');
  });
});

describe('LEGAL_PAGE_DEFAULTS', () => {
  it('sigue nombrando al placeholder, y eso es a propósito', () => {
    // Este test es un CANDADO, no una comprobación: si alguien "mejora" el copy por
    // defecto, la mitad de las tiendas del boilerplate pasa a publicar un texto que
    // nadie escribió y sin el aviso de ejemplo. El cambio se hace con la decisión
    // tomada, borrando este test a mano.
    const privacy = LEGAL_PAGE_DEFAULTS.legals.sections.map((s) => s.html).join('');
    const terms = LEGAL_PAGE_DEFAULTS.conditions.sections.map((s) => s.html).join('');
    assert.ok(privacy.includes('La Empresa S.A.'));
    assert.ok(terms.includes('www.ejemplo.com.ar'));
  });

  it('no trae fecha de última actualización', () => {
    // Una fecha acá haría que cada tienda publique un "última actualización" que
    // nadie eligió, encima de un texto que nadie escribió.
    for (const slug of LEGAL_PAGE_SLUGS) {
      assert.equal(LEGAL_PAGE_DEFAULTS[slug].updated_label, null, slug);
    }
  });

  it('cada página tiene título, bajada y al menos una sección', () => {
    for (const slug of LEGAL_PAGE_SLUGS) {
      const doc = LEGAL_PAGE_DEFAULTS[slug];
      assert.ok(doc.title.trim().length > 0, slug);
      assert.ok((doc.intro ?? '').trim().length > 0, slug);
      assert.ok(doc.sections.length > 0, slug);
    }
  });

  it('cada sección tiene nombre, cuerpo e id único, y sobrevive su propio saneado', () => {
    for (const slug of LEGAL_PAGE_SLUGS) {
      const ids = new Set<string>();
      for (const s of LEGAL_PAGE_DEFAULTS[slug].sections) {
        assert.ok(s.name.trim().length > 0, `${slug}: sección sin nombre`);
        assert.ok(s.html.trim().length > 0, `${slug}/${s.name}: sección sin cuerpo`);
        assert.equal(ids.has(s.id), false, `${slug}: id repetido ${s.id}`);
        ids.add(s.id);
        // Si una etiqueta del copy no está en la lista permitida, la página publicaría
        // MENOS de lo que dice este archivo — y en silencio.
        assert.equal(sanitizeLegalHtml(s.html), s.html, `${slug}/${s.name}`);
      }
    }
  });

  it('el default entero sobrevive un ida y vuelta por el merge', () => {
    // El caso real: el operador abre la página, no toca nada y guarda. Si el default
    // no fuera estable, ese guardado le cambiaría el texto sin que nadie escribiera.
    for (const slug of LEGAL_PAGE_SLUGS) {
      const doc = LEGAL_PAGE_DEFAULTS[slug];
      const { pages } = mergeLegalPages({ [slug]: doc });
      assert.deepEqual(pages[slug], doc, slug);
    }
  });
});
