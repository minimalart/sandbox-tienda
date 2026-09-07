import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBaseRows,
  parseColorRows,
  parseCsv,
  parseFormulaRows,
  readRawRows,
} from './import-rows.ts';

describe('parseCsv', () => {
  it('parsea con coma y normaliza los headers', () => {
    const rows = parseCsv('Code,Name,Collection\nCOSMOS,Cosmos,ALBAHYO\n');
    assert.deepEqual(rows, [{ code: 'COSMOS', name: 'Cosmos', collection: 'ALBAHYO' }]);
  });

  it('acepta punto y coma (así exporta Excel en es-AR)', () => {
    const rows = parseCsv('code;name;collection\nCOSMOS;Cosmos;ALBAHYO');
    assert.equal(rows[0]?.name, 'Cosmos');
  });

  it('respeta comillas, separadores y saltos dentro del campo', () => {
    const rows = parseCsv('code,name\nA1,"Verde, oscuro"\nA2,"Dice ""hola"""\nA3,"Dos\nlíneas"');
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.name, 'Verde, oscuro');
    assert.equal(rows[1]?.name, 'Dice "hola"');
    assert.equal(rows[2]?.name, 'Dos\nlíneas');
  });

  it('se come el BOM y las líneas vacías', () => {
    const rows = parseCsv('﻿code,name\n\nCOSMOS,Cosmos\n\n');
    assert.deepEqual(rows, [{ code: 'COSMOS', name: 'Cosmos' }]);
  });
});

describe('parseColorRows', () => {
  it('acepta alias de columna en castellano y normaliza el hex', () => {
    const { rows, errors } = parseColorRows([
      { codigo: 'COSMOS', nombre: 'Cosmos', carta: 'ALBAHYO', hex: 'aabbcc', orden: '3' },
      { code: 'X1', name: 'Corto', collection: 'ALBAHYO', hex: '#0a0' },
    ]);
    assert.equal(errors.length, 0);
    assert.equal(rows[0]?.hex, '#AABBCC');
    assert.equal(rows[0]?.rank, 3);
    // El hex de 3 dígitos se expande.
    assert.equal(rows[1]?.hex, '#00AA00');
  });

  it('un hex inválido no invalida el color: va sin swatch', () => {
    const { rows, errors } = parseColorRows([
      { code: 'C1', name: 'Sin color', collection: 'ALBAHYO', hex: 'verde' },
    ]);
    assert.equal(errors.length, 0);
    assert.equal(rows[0]?.hex, null);
  });

  it('exige carta: la fórmula es por carta, sin ella no se puede cotizar', () => {
    const { rows, errors } = parseColorRows([{ code: 'C1', name: 'Sin carta' }]);
    assert.equal(rows.length, 0);
    assert.equal(errors[0]?.row, 1);
    assert.match(errors[0]?.reason ?? '', /carta/i);
  });

  it('reporta el número de fila y sigue con las demás', () => {
    const { rows, errors } = parseColorRows([
      { code: 'OK', name: 'Bien', collection: 'ALBAHYO' },
      { name: 'Sin código', collection: 'ALBAHYO' },
      { code: 'OK2', name: 'Bien', collection: 'ALBAHYO' },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.row, 2);
  });

  it('detecta duplicados dentro de la misma carta', () => {
    const { rows, errors } = parseColorRows([
      { code: 'COSMOS', name: 'Cosmos', collection: 'ALBAHYO' },
      { code: 'cosmos', name: 'Cosmos otra vez', collection: 'ALBAHYO' },
    ]);
    assert.equal(rows.length, 1);
    assert.match(errors[0]?.reason ?? '', /repetido/i);
  });

  it('el mismo código en OTRA carta no es duplicado', () => {
    const { rows, errors } = parseColorRows([
      { code: 'COSMOS', name: 'Cosmos', collection: 'ALBAHYO' },
      { code: 'COSMOS', name: 'Cosmos', collection: 'OTRA' },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(errors.length, 0);
  });

  it('sin columna de fotos, `images` es null (no las toca)', () => {
    const { rows } = parseColorRows([{ code: 'C1', name: 'Sin fotos', collection: 'ALBAHYO' }]);
    assert.equal(rows[0]?.images, null);
  });

  it('con la columna vacía, `images` es [] (las borra)', () => {
    // La distinción es la que evita que reimportar la planilla del fabricante
    // —que nunca trae fotos— borre el harvest.
    const { rows } = parseColorRows([
      { code: 'C1', name: 'Con columna', collection: 'ALBAHYO', imagenes: '' },
    ]);
    assert.deepEqual(rows[0]?.images, []);
  });

  it('parsea las fotos por CSV y por JSON, con alias en castellano', () => {
    const url = 'https://msp.images.akzonobel.com/glb/dh/inspirational-images/Livingroom-52181.png';
    const { rows, errors } = parseColorRows([
      { code: 'C1', name: 'CSV', collection: 'ALBAHYO', imagenes: `Livingroom=${url}` },
      { code: 'C2', name: 'JSON', collection: 'ALBAHYO', images: [{ room: 'Kitchen', url }] },
      { code: 'C3', name: 'Basura', collection: 'ALBAHYO', fotos: 'javascript:alert(1)' },
    ]);
    assert.equal(errors.length, 0);
    assert.deepEqual(rows[0]?.images, [{ room: 'Livingroom', url }]);
    assert.deepEqual(rows[1]?.images, [{ room: 'Kitchen', url }]);
    // Una URL que no sirve no invalida el color, igual que el hex: entra sin fotos.
    assert.deepEqual(rows[2]?.images, []);
  });
});

describe('parseFormulaRows', () => {
  it('parsea la fila real del cliente y NO le toca los espacios al código', () => {
    const { rows, errors } = parseFormulaRows([
      {
        color: 'COSMOS',
        carta: 'ALBAHYO',
        linea: 'ALBACRYL LATEX INTERIOR ACRILICO MATE',
        letra: 'f',
        formula: '00NN 16/000',
      },
    ]);
    assert.equal(errors.length, 0);
    // Se guarda como lo muestra Gestión; la API lo recibe sin espacios vía
    // normalizeFormulaCode, no acá.
    assert.equal(rows[0]?.zeus_formula_code, '00NN 16/000');
    assert.equal(rows[0]?.base_letter, 'F');
  });

  it('exige el código de fórmula, que es lo único que Zeus necesita', () => {
    const { rows, errors } = parseFormulaRows([
      { color_code: 'COSMOS', collection: 'ALBAHYO', product_line: 'ALBACRYL' },
    ]);
    assert.equal(rows.length, 0);
    assert.match(errors[0]?.reason ?? '', /fórmula/i);
  });

  it('permite base_letter nula (líneas con base única) y la trata como clave', () => {
    const { rows, errors } = parseFormulaRows([
      { color_code: 'C1', collection: 'A', product_line: 'L', zeus_formula_code: 'F1' },
      { color_code: 'C1', collection: 'A', product_line: 'L', zeus_formula_code: 'F2' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.base_letter, null);
    assert.match(errors[0]?.reason ?? '', /repetida/i);
  });
});

describe('parseBaseRows', () => {
  it('normaliza la letra y el tamaño', () => {
    const { rows, errors } = parseBaseRows([
      { codigo: '113', letra: 'f', linea: 'ALBACRYL LATEX', envase: '3,6 LTS', litros: '3,6' },
    ]);
    assert.equal(errors.length, 0);
    assert.deepEqual(rows[0], {
      article_code: '113',
      base_letter: 'F',
      product_line: 'ALBACRYL LATEX',
      collection: null,
      size_label: '3,6 LTS',
      size_liters: 3.6,
    });
  });

  it('exige artículo y línea', () => {
    const { errors } = parseBaseRows([{ codigo: '113' }, { linea: 'ALBACRYL' }]);
    assert.equal(errors.length, 2);
  });

  it('sin la columna no manda `sellable_untinted` (el upsert no la tiene que tocar)', () => {
    const { rows } = parseBaseRows([{ codigo: '113', linea: 'ALBACRYL LATEX' }]);
    assert.equal('sellable_untinted' in rows[0]!, false);
  });

  it('lee la doble función del blanco en las formas que escribe Excel', () => {
    const { rows } = parseBaseRows([
      { codigo: '232', linea: 'ALBALUX BALANCE ESMALTE BRILLANTE', sellable_untinted: 'SÍ' },
      { codigo: '649', linea: 'SATINOL BALANCE ESMALTE SATINADO', vendible_sin_entonar: 1 },
      { codigo: '113', linea: 'ALBACRYL LATEX', sellable_untinted: 'no' },
    ]);
    assert.equal(rows[0]!.sellable_untinted, true);
    assert.equal(rows[1]!.sellable_untinted, true);
    // `no` explícito SÍ apaga: es la forma de corregir una base mal marcada.
    assert.equal(rows[2]!.sellable_untinted, false);
  });
});

describe('readRawRows', () => {
  it('prioriza el CSV cuando llegan los dos', () => {
    const rows = readRawRows({ csv: 'code,name\nA,B', rows: [{ code: 'Z' }] });
    assert.deepEqual(rows, [{ code: 'A', name: 'B' }]);
  });

  it('descarta entradas que no son objetos', () => {
    const rows = readRawRows({ rows: [{ code: 'A' }, null, 'x', ['y']] as unknown[] });
    assert.deepEqual(rows, [{ code: 'A' }]);
  });

  it('devuelve vacío sin payload útil', () => {
    assert.deepEqual(readRawRows({}), []);
    assert.deepEqual(readRawRows({ csv: '   ' }), []);
  });
});
