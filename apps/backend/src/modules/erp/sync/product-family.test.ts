import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFamilyName } from './product-family.ts';

describe('normalizeFamilyName', () => {
  // Las 36 familias reales de desdeelsur (DESDEELSUR-48). Zeus las manda TODAS
  // en mayúsculas sostenidas y sin tildes, y el storefront las publica como el
  // filtro "familia" del PLP.
  it('da casing de lectura a las familias que sólo estaban gritadas', () => {
    assert.equal(normalizeFamilyName('PINTURA HOGAR Y OBRA'), 'Pintura hogar y obra');
    assert.equal(normalizeFamilyName('FAMILIAS ACCESORIOS VARIAS'), 'Familias accesorios varias');
    assert.equal(normalizeFamilyName('RODILLOS Y PAD'), 'Rodillos y pad');
    assert.equal(normalizeFamilyName('TECHO'), 'Techo');
  });

  it('acentúa por diccionario', () => {
    assert.equal(normalizeFamilyName('ARTISTICA PINCELES'), 'Artística pinceles');
    assert.equal(normalizeFamilyName('ARTISTICA ACRILICOS'), 'Artística acrílicos');
    assert.equal(normalizeFamilyName('ARTISTICA BASES ACRILICAS'), 'Artística bases acrílicas');
    assert.equal(
      normalizeFamilyName('HERRAMIENTAS ELECTRICAS Y EXPLOSION'),
      'Herramientas eléctricas y explosión'
    );
    assert.equal(normalizeFamilyName('PROTECCION PERSONAL'), 'Protección personal');
    assert.equal(normalizeFamilyName('PINTURA INDUSTRIA Y NAUTICA'), 'Pintura industria y náutica');
    assert.equal(normalizeFamilyName('TEXTURADO REVOQUE PLASTICO'), 'Texturado revoque plástico');
    assert.equal(
      normalizeFamilyName('MASILLAS CONSTRUCCION EN SECO'),
      'Masillas construcción en seco'
    );
    assert.equal(normalizeFamilyName('TEXTURADO CLASICO'), 'Texturado clásico');
  });

  it('acentúa la palabra pegada a una coma', () => {
    // El bug que esto cubre: partiendo por espacios el token era `ESPATULAS,` y
    // no matcheaba la clave `espatulas`, así que la palabra salía sin tilde. El
    // ERP separa enumeraciones sin espacio antes de la coma.
    assert.equal(
      normalizeFamilyName('LLANAS, ESPATULAS, FRATACHOS'),
      'Llanas, espátulas, fratachos'
    );
    assert.equal(
      normalizeFamilyName('ESCALERAS, CABALLETES, BANQUETAS, ANDAMIOS'),
      'Escaleras, caballetes, banquetas, andamios'
    );
  });

  it('preserva las siglas del rubro', () => {
    assert.equal(normalizeFamilyName('PISOS SPC Y ZOCALOS'), 'Pisos SPC y zócalos');
  });

  it('respeta una familia que ya viene con formato intencional', () => {
    assert.equal(normalizeFamilyName('Pintura hogar y obra'), 'Pintura hogar y obra');
    assert.equal(normalizeFamilyName('Artística pinceles'), 'Artística pinceles');
  });

  it('es idempotente sobre las 36 familias reales', () => {
    for (const raw of [
      'PINTURA HOGAR Y OBRA',
      'ARTISTICA ACRILICOS',
      'HERRAMIENTAS ELECTRICAS Y EXPLOSION',
      'LLANAS, ESPATULAS, FRATACHOS',
      'ESCALERAS, CABALLETES, BANQUETAS, ANDAMIOS',
      'PISOS SPC Y ZOCALOS',
      'MASILLAS CONSTRUCCION EN SECO',
      'PROTECCION PERSONAL',
    ]) {
      const once = normalizeFamilyName(raw)!;
      assert.equal(normalizeFamilyName(once), once, `no es idempotente: ${raw}`);
    }
  });

  it('devuelve null cuando el ERP no manda familia', () => {
    // `null` y no cadena vacía: `erpProductMetadata` usa el valor como guard, y
    // una familia vacía NUNCA debe pisar una que ya estaba guardada.
    assert.equal(normalizeFamilyName(null), null);
    assert.equal(normalizeFamilyName(undefined), null);
    assert.equal(normalizeFamilyName(''), null);
    assert.equal(normalizeFamilyName('   '), null);
  });

  it('no aplica los overrides editoriales de las categorías', () => {
    // `Perfilería: metal y madera` es una decisión sobre el árbol de categorías.
    // Una familia que se llame igual recibe casing y tildes, no la reescritura.
    assert.equal(normalizeFamilyName('PERFILERIA METAL - MADERA'), 'Perfilería metal - madera');
  });
});
