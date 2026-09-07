import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTintingBase } from './parse-base.ts';

/**
 * Todas las descripciones de este archivo son REALES: salen del catálogo de la
 * cuenta DESDE EL SUR SAS (3438 artículos, medido 2026-07-29). Con estas reglas
 * el parser matchea 154 artículos (F 54, P 58, T 35, MF 4 y 3 bases únicas) sin
 * ningún falso positivo evidente.
 */
describe('parseTintingBase', () => {
  it('parsea la forma canónica "BASE <letra> X <tamaño>"', () => {
    assert.deepEqual(parseTintingBase('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE F X 3,6 LTS'), {
      base_letter: 'F',
      product_line: 'ALBACRYL LATEX INTERIOR ACRILICO MATE',
      size_label: '3,6 LTS',
      size_liters: 3.6,
      confidence: 'high',
    });
  });

  it('acepta las letras P y T y los cuatro tamaños del catálogo', () => {
    const sizes = [
      ['ALBALATEX DESIGN SATINADO INTERIOR BASE P X 0,9 LTS', 0.9],
      ['ALBALATEX DESIGN SATINADO INTERIOR BASE P X 3,6 LTS', 3.6],
      ['ALBALATEX DESIGN SATINADO INTERIOR BASE P X 8,7 LTS', 8.7],
      ['ALBALATEX DESIGN SATINADO INTERIOR BASE P X 17,4 LTS', 17.4],
    ] as const;
    for (const [description, liters] of sizes) {
      const parsed = parseTintingBase(description);
      assert.equal(parsed?.base_letter, 'P');
      assert.equal(parsed?.size_liters, liters);
    }
    assert.equal(parseTintingBase('ALBALATEX DESIGN SATINADO INTERIOR BASE T X 3,6 LTS')?.base_letter, 'T');
  });

  it('reconoce la unidad escrita completa y la forma canónica de la tienda', () => {
    // Zeus también escribe "LITROS" (caso real). Sin esta forma la base no se
    // detectaba y el envase no se redondeaba (R25).
    const litros = parseTintingBase('SATINOL BALANCE ESMALTE SATINADO BASE T X0.9 LITROS');
    assert.equal(litros?.base_letter, 'T');
    assert.equal(litros?.size_liters, 0.9);
    // Y el título YA normalizado por la tienda (`Base T x1 lt`): de esto depende la
    // idempotencia de `normalizeProductTitle`, que le pregunta a este detector si
    // aplica R25.
    const canon = parseTintingBase('Satinol balance esmalte satinado Base T x1 lt');
    assert.equal(canon?.base_letter, 'T');
    assert.equal(canon?.size_liters, 1);
    assert.equal(parseTintingBase('REVEX COLOR BASE F FINO X 5 kg')?.size_liters, null);
    assert.equal(parseTintingBase('EQ ARTE ACRILICO BASE F X 200 ML')?.size_liters, 0.2);
  });

  it('tolera la X ANTES de la letra ("BASE X P 17,4 LTS")', () => {
    const parsed = parseTintingBase('ALBACRYL LATEX INTERIOR ACRILICO MATE BASE X P 17,4 LTS');
    assert.equal(parsed?.base_letter, 'P');
    assert.equal(parsed?.size_liters, 17.4);
  });

  it('reconoce bases ÚNICAS (sin letra) sin confundir la X con una letra', () => {
    const parsed = parseTintingBase('ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE X 3,24 LTS');
    assert.equal(parsed?.base_letter, null);
    assert.equal(parsed?.size_liters, 3.24);
  });

  it('acepta un calificador entre la letra y el tamaño', () => {
    // Multicapa: la letra del componente va entre paréntesis.
    const aike = parseTintingBase('AIKE - MULTICAPA ELASTOMERICO BASE P (A) 0.9LTS.');
    assert.equal(aike?.base_letter, 'P');
    assert.equal(aike?.size_liters, 0.9);
    // Granulometría.
    const revear = parseTintingBase('REVEAR - REVEX COLOR BASE F FINO X 5 KGS');
    assert.equal(revear?.base_letter, 'F');
    assert.equal(revear?.size_label, '5 KGS');
    // KG es masa: sin densidad no se convierte a litros.
    assert.equal(revear?.size_liters, null);
  });

  it('reconoce las bases de AIKE, que dicen COLOR y no BASE', () => {
    // AIKE no escribe la palabra BASE: la letra va después de COLOR y el grupo
    // entre paréntesis. Son 18 artículos reales de dos líneas enteras.
    const conX = parseTintingBase('AIKE - LATEX I+E COLOR F (B) X 18 LTS');
    assert.equal(conX?.base_letter, 'F');
    assert.equal(conX?.size_liters, 18);
    assert.equal(conX?.product_line, 'AIKE - LATEX I+E');

    // Sin la X separadora y con el punto final, tal como los carga Zeus.
    const sinX = parseTintingBase('AIKE - ESMALTE 2 EN 1 COLOR P (A) 18 LTS.');
    assert.equal(sinX?.base_letter, 'P');
    assert.equal(sinX?.size_liters, 18);
    assert.equal(sinX?.product_line, 'AIKE - ESMALTE 2 EN 1');

    // Unidad abreviada a una sola letra, también real.
    assert.equal(parseTintingBase('AIKE - LATEX I+E COLOR T (C) X 18 L')?.base_letter, 'T');
  });

  it('exige el paréntesis para leer COLOR como una base', () => {
    // Sin paréntesis, "COLOR PREMIUM" daría la base "PR" y una pintura de color
    // pasaría a ser entonable — que le sacaría la venta directa. Es real.
    assert.equal(parseTintingBase('VENIER - LATEX COLOR PREMIUM X 1,25 KGS'), null);
    // Un paréntesis que no viene después de COLOR tampoco alcanza: son talles,
    // códigos de repuesto y metros de moldura, todos reales.
    assert.equal(parseTintingBase('NUBUS - MAMELUCO DESCARTABLE (XL)'), null);
    assert.equal(parseTintingBase('MOTA - REPUESTO HOJA CUTTER X 10 UN. 18 MM (C18)'), null);
    assert.equal(parseTintingBase('MAROPOR - MOLDURA M33 19X32MM. (2ML)'), null);
  });

  it('el ancla COLOR no le saca precedencia a BASE', () => {
    // Sigue ganando BASE: el ancla COLOR es un fallback que sólo se prueba si no
    // hay BASE, y acá la letra buena es la del paréntesis de BASE.
    assert.equal(parseTintingBase('AIKE - MULTICAPA ELASTOMERICO BASE P (A) 0.9LTS.')?.base_letter, 'P');
  });

  it('descarta lo que no es una base entonable', () => {
    // Pintura de color, no base: entre BASE y el tamaño hay texto libre y no hay letra.
    assert.equal(parseTintingBase('EQ ARTE - BASE ACRILICA 100 NEGRO X 200 CC'), null);
    // "P/" es "PARA", no una letra de base.
    assert.equal(parseTintingBase('REVEAR - BASE P/NATURAL STONE SIMIL PIEDRA X 25 KGS'), null);
    // La "Y" es una conjunción y el tamaño está ANTES de "BASE".
    assert.equal(parseTintingBase('REVEAR - CLASSIC STONE CLEAR X 25 KGS (SIN BASE Y A PEDIDO)'), null);
    // Sin tamaño no se puede cotizar (la API cotiza por cantidad de envases).
    assert.equal(parseTintingBase('CASAS DE PAJARITOS - BASE CURVA'), null);
    assert.equal(parseTintingBase('MATEZZ - PORTA LIJA CON BASE METALICA'), null);
    // No dice BASE.
    assert.equal(parseTintingBase('ALBA STANDARD FONDO P/MADERA BLANCO MATE X 0,5 LTS'), null);
  });

  it('"a base de …" no es una base entonable', () => {
    // Casos REALES de Mercatto, que además de pinturería tiene almacén: el
    // detector los levantaba como base letra "DE".
    assert.equal(parseTintingBase('Chorizo a base de planta NotChorixo 240 grs'), null);
    assert.equal(parseTintingBase('Bebida a base de almendras sin azúcar Silk 1lt'), null);
    assert.equal(parseTintingBase('Hamburguesa a base de arvejas 200 grs'), null);
  });

  it('rechaza el match cuando entre la letra y el tamaño hay una frase', () => {
    // Un calificador corto sí ("BASE F FINO X 5 KGS"), una frase no.
    assert.ok(parseTintingBase('LINEA BASE F FINO X 5 KGS'));
    assert.equal(parseTintingBase('LINEA BASE F para exteriores muy resistente X 5 KGS'), null);
  });

  it('no explota con entradas vacías o no-string', () => {
    assert.equal(parseTintingBase(null), null);
    assert.equal(parseTintingBase(undefined), null);
    assert.equal(parseTintingBase('   '), null);
    assert.equal(parseTintingBase(42 as unknown as string), null);
  });
});
