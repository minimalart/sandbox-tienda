import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryNameNeedsUpdate,
  normalizeCategoryName,
  sameCategoryName,
} from './category-name.ts';

describe('normalizeCategoryName', () => {
  it('pasa las mayúsculas sostenidas del ERP a mayúscula inicial', () => {
    assert.equal(normalizeCategoryName('PAREDES INTERIOR'), 'Paredes interior');
    assert.equal(normalizeCategoryName('CIELORRASO'), 'Cielorraso');
  });

  it('no capitaliza cada palabra: en español "Lacas y barnices" es lo correcto', () => {
    assert.equal(normalizeCategoryName('LACAS Y BARNICES'), 'Lacas y barnices');
    assert.equal(normalizeCategoryName('ADHESIVOS Y SELLADORES'), 'Adhesivos y selladores');
  });

  it('preserva las siglas del rubro', () => {
    assert.equal(normalizeCategoryName('PISOS PVC Y CEMENTICIO'), 'Pisos PVC y cementicio');
    assert.equal(normalizeCategoryName('PLACAS MDF'), 'Placas MDF');
  });

  it('conserva los separadores del nombre del ERP que nadie pidió reescribir', () => {
    assert.equal(normalizeCategoryName('MASILLA - ENDUIDO Y YESO'), 'Masilla - enduido y yeso');
    assert.equal(normalizeCategoryName('PRIMERS - FONDOS'), 'Primers - fondos');
  });

  it('respeta un nombre que ya viene con formato intencional', () => {
    assert.equal(normalizeCategoryName('Paredes interior'), 'Paredes interior');
    assert.equal(normalizeCategoryName('Herramientas eléctricas'), 'Herramientas eléctricas');
    // Mixto: si hay una minúscula, el ERP decidió — no se reformatea.
    assert.equal(normalizeCategoryName('iPhone y accesorios'), 'iPhone y accesorios');
  });

  it('colapsa espacios y tolera nombres degenerados', () => {
    assert.equal(normalizeCategoryName(''), '');
    assert.equal(normalizeCategoryName('   '), '');
    assert.equal(normalizeCategoryName('- - -'), '- - -');
  });

  it('arranca en la primera letra aunque el nombre empiece con un símbolo', () => {
    assert.equal(normalizeCategoryName('- VARIOS'), '- Varios');
  });
});

describe('normalizeCategoryName · tildes por diccionario', () => {
  // Los seis nombres que el catálogo de desdeelsur tenía mal escritos
  // (DESDEELSUR-48). Salen del árbol real de Zeus, no de un inventario.
  it('acentúa los términos del rubro que el ERP manda pelados', () => {
    assert.equal(
      normalizeCategoryName('HERRAMIENTAS ELECTRICAS Y MANUALES'),
      'Herramientas eléctricas y manuales'
    );
    assert.equal(normalizeCategoryName('  PINTURA   ARTISTICA '), 'Pintura artística');
    assert.equal(normalizeCategoryName('ARTISTICA'), 'Artística');
    assert.equal(normalizeCategoryName('BARBIJOS Y MASCARAS'), 'Barbijos y máscaras');
    assert.equal(normalizeCategoryName('INDUSTRIA Y NAUTICA'), 'Industria y náutica');
  });

  it('hereda el diccionario de los títulos de producto', () => {
    // `espatula`, `latex` y `metalico` viven en DEFAULT_TITLE_DICTIONARY: se
    // reusan a propósito para que una palabra agregada allá corrija las dos
    // superficies a la vez.
    assert.equal(normalizeCategoryName('ESPATULAS'), 'Espátulas');
    assert.equal(normalizeCategoryName('PINTURA LATEX'), 'Pintura látex');
    assert.equal(normalizeCategoryName('ESMALTE METALICO'), 'Esmalte metálico');
  });

  it('es idempotente: su propia salida vuelve a matchear el diccionario', () => {
    for (const raw of [
      'HERRAMIENTAS ELECTRICAS Y MANUALES',
      'INDUSTRIA Y NAUTICA',
      'ARTISTICA',
      'PISOS PVC Y CEMENTICIO',
      'LLANAS - ESPATULAS - FRATACHOS',
      'PERFILERIA METAL - MADERA',
    ]) {
      const once = normalizeCategoryName(raw);
      assert.equal(normalizeCategoryName(once), once, `no es idempotente: ${raw}`);
    }
  });

  it('no toca las palabras que el diccionario no conoce', () => {
    assert.equal(normalizeCategoryName('FRATACHOS Y LLANAS'), 'Fratachos y llanas');
    assert.equal(normalizeCategoryName('TEXTURADOS'), 'Texturados');
  });
});

describe('normalizeCategoryName · reescrituras editoriales', () => {
  it('aplica el override del nombre completo, que un diccionario no puede hacer', () => {
    // Mueve separadores y agrega una conjunción: el nombre no es la suma de sus
    // palabras corregidas.
    assert.equal(
      normalizeCategoryName('LLANAS - ESPATULAS - FRATACHOS'),
      'Llanas, espátulas y fratachos'
    );
    assert.equal(normalizeCategoryName('PERFILERIA METAL - MADERA'), 'Perfilería: metal y madera');
  });

  it('el override matchea por forma plegada, así que da igual cómo lo escriba el ERP', () => {
    assert.equal(
      normalizeCategoryName('Llanas - Espátulas - Fratachos'),
      'Llanas, espátulas y fratachos'
    );
  });
});

describe('sameCategoryName', () => {
  it('ignora caso, tildes y espacios de más', () => {
    assert.ok(sameCategoryName('PAREDES INTERIOR', 'Paredes interior'));
    assert.ok(sameCategoryName('HERRAMIENTAS ELECTRICAS', 'Herramientas eléctricas'));
    assert.ok(sameCategoryName('Pintura  artistica', 'PINTURA ARTÍSTICA'));
  });

  it('detecta un rename de verdad', () => {
    assert.ok(!sameCategoryName('PAREDES INTERIOR', 'Paredes interiores'));
    assert.ok(!sameCategoryName('PISOS', 'Pisos PVC'));
  });
});

describe('categoryNameNeedsUpdate', () => {
  it('no reescribe lo que ya coincide con la salida del normalizador', () => {
    assert.ok(
      !categoryNameNeedsUpdate('Herramientas eléctricas y manuales', 'HERRAMIENTAS ELECTRICAS Y MANUALES')
    );
    assert.ok(!categoryNameNeedsUpdate('Paredes interior', 'PAREDES INTERIOR'));
  });

  it('NO revierte una reescritura editorial, que contra el nombre crudo parecería un rename', () => {
    // El bug que esto previene: `fold` no pliega puntuación y sobra una `y`, así
    // que comparar contra 'LLANAS - ESPATULAS - FRATACHOS' marcaba rename y
    // pisaba el nombre bueno en cada corrida del sync — cada quince minutos.
    assert.ok(
      !categoryNameNeedsUpdate('Llanas, espátulas y fratachos', 'LLANAS - ESPATULAS - FRATACHOS')
    );
    assert.ok(!categoryNameNeedsUpdate('Perfilería: metal y madera', 'PERFILERIA METAL - MADERA'));
  });

  it('sí propone el override cuando lo guardado es el nombre viejo con separadores', () => {
    assert.ok(
      categoryNameNeedsUpdate('Llanas - espatulas - fratachos', 'LLANAS - ESPATULAS - FRATACHOS')
    );
  });

  it('respeta una corrección a mano que el diccionario todavía no conoce', () => {
    // La escotilla de siempre: si alguien acentúa en el admin una palabra que no
    // está en el diccionario, gana la base.
    assert.ok(!categoryNameNeedsUpdate('Cementício', 'CEMENTICIO'));
    assert.ok(!categoryNameNeedsUpdate('Fratáchos y llanas', 'FRATACHOS Y LLANAS'));
  });

  it('propaga un rename de verdad del ERP', () => {
    assert.ok(categoryNameNeedsUpdate('Paredes interior', 'PAREDES INTERIORES'));
    assert.ok(categoryNameNeedsUpdate('Pisos', 'PISOS PVC'));
  });
});
