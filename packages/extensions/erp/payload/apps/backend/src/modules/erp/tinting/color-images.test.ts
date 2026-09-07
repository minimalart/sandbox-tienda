import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_COLOR_IMAGES,
  summarizeImportedColorImages,
  mergeColorImagesIntoMetadata,
  normalizeColorImages,
  parseColorImagesCell,
  readColorImages,
} from './color-images.ts';

const URL_A = 'https://msp.images.akzonobel.com/glb/dh/inspirational-images/Livingroom-52181.png';
const URL_B = 'https://msp.images.akzonobel.com/glb/dh/inspirational-images/Kitchen-52181.png';

describe('normalizeColorImages', () => {
  it('acepta array de objetos, de strings y mapa ambiente → url', () => {
    assert.deepEqual(normalizeColorImages([{ room: 'Livingroom', url: URL_A }]), [
      { room: 'Livingroom', url: URL_A },
    ]);
    assert.deepEqual(normalizeColorImages([URL_A]), [{ room: null, url: URL_A }]);
    assert.deepEqual(normalizeColorImages({ Kitchen: URL_B }), [{ room: 'Kitchen', url: URL_B }]);
  });

  it('descarta esquemas que no sean http(s)', () => {
    // La data entra por scraping y sale a un <img src>: es el único punto donde
    // se puede filtrar.
    const images = normalizeColorImages([
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '/relativa.png',
      'ftp://host/f.png',
      URL_A,
    ]);
    assert.deepEqual(images, [{ room: null, url: URL_A }]);
  });

  it('deduplica por url y respeta el tope', () => {
    assert.equal(normalizeColorImages([URL_A, URL_A, URL_B]).length, 2);
    const many = Array.from({ length: MAX_COLOR_IMAGES + 5 }, (_, i) => `${URL_A}?v=${i}`);
    assert.equal(normalizeColorImages(many).length, MAX_COLOR_IMAGES);
  });

  it('devuelve lista vacía ante basura', () => {
    for (const input of [null, undefined, 42, 'texto', [{}], [{ url: 5 }]]) {
      assert.deepEqual(normalizeColorImages(input), []);
    }
  });
});

describe('parseColorImagesCell', () => {
  it('parsea el formato ambiente=url separado por barras', () => {
    assert.deepEqual(parseColorImagesCell(`Livingroom=${URL_A}|Kitchen=${URL_B}`), [
      { room: 'Livingroom', url: URL_A },
      { room: 'Kitchen', url: URL_B },
    ]);
  });

  it('acepta urls peladas y no se rompe con el = del query string', () => {
    assert.deepEqual(parseColorImagesCell(`${URL_A}?im=Resize,width=1200`), [
      { room: null, url: `${URL_A}?im=Resize,width=1200` },
    ]);
    assert.deepEqual(parseColorImagesCell(`Kitchen=${URL_B}?im=Resize,width=1200`), [
      { room: 'Kitchen', url: `${URL_B}?im=Resize,width=1200` },
    ]);
  });

  it('acepta un JSON pegado en la celda', () => {
    assert.deepEqual(parseColorImagesCell(`[{"room":"Bedroom","url":"${URL_A}"}]`), [
      { room: 'Bedroom', url: URL_A },
    ]);
    // JSON roto no invalida el color: entra sin fotos.
    assert.deepEqual(parseColorImagesCell('[{"room":'), []);
  });

  it('celda vacía es lista vacía', () => {
    assert.deepEqual(parseColorImagesCell('   '), []);
  });
});

describe('mergeColorImagesIntoMetadata', () => {
  it('conserva las otras claves del metadata', () => {
    const merged = mergeColorImagesIntoMetadata(
      { ccid: '1671375', images: [{ room: 'Kitchen', url: URL_B }] },
      [{ room: 'Livingroom', url: URL_A }]
    );
    assert.equal(merged.ccid, '1671375');
    assert.deepEqual(merged.images, [{ room: 'Livingroom', url: URL_A }]);
  });

  it('una lista vacía borra la clave sin tocar el resto', () => {
    const merged = mergeColorImagesIntoMetadata({ ccid: '1', images: [{ room: null, url: URL_A }] }, []);
    assert.deepEqual(merged, { ccid: '1' });
  });

  it('arranca de cero si el metadata guardado no es un objeto', () => {
    assert.deepEqual(mergeColorImagesIntoMetadata(null, [{ room: null, url: URL_A }]), {
      images: [{ room: null, url: URL_A }],
    });
  });
});

describe('readColorImages', () => {
  it('revalida lo guardado en vez de confiar en la forma', () => {
    assert.deepEqual(readColorImages({ images: [URL_A, 'javascript:alert(1)'] }), [
      { room: null, url: URL_A },
    ]);
    assert.deepEqual(readColorImages(null), []);
    assert.deepEqual(readColorImages({ otra: 1 }), []);
  });
});

/**
 * El agujero que esto cierra: la planilla del fabricante nunca trae fotos, así
 * que una carta entera podía importarse en verde con el carrusel condenado a
 * quedar vacío. Pasó con los 2848 colores de desdeelsur.
 */
describe('summarizeImportedColorImages', () => {
  const withImages = { images: [{ room: 'Livingroom', url: 'https://cdn/x.png' }] };
  const emptyCell = { images: [] };
  const noColumn = { images: null };

  it('sin filas no inventa nada', () => {
    assert.deepEqual(summarizeImportedColorImages([]), {
      column_present: false,
      with_images: 0,
      without_images: 0,
    });
  });

  it('la planilla del fabricante: columna ausente, cero fotos', () => {
    assert.deepEqual(summarizeImportedColorImages([noColumn, noColumn, noColumn]), {
      column_present: false,
      with_images: 0,
      without_images: 3,
    });
  });

  /** Se distingue de la anterior porque se arregla distinto: el harvest SÍ corrió. */
  it('columna presente pero vacía en todas', () => {
    assert.deepEqual(summarizeImportedColorImages([emptyCell, emptyCell]), {
      column_present: true,
      with_images: 0,
      without_images: 2,
    });
  });

  it('cuenta sólo las filas que traen al menos una foto', () => {
    assert.deepEqual(summarizeImportedColorImages([withImages, emptyCell, noColumn, withImages]), {
      column_present: true,
      with_images: 2,
      without_images: 2,
    });
  });
});
