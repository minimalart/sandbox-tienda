import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkBarcode, findDuplicateBarcodes } from './barcode.ts';

describe('checkBarcode — códigos válidos', () => {
  it('acepta los cuatro formatos GTIN con su dígito verificador', () => {
    // Prefijo 779 = Argentina. Verificadores comprobados a mano con el mod 10 GS1.
    assert.deepEqual(checkBarcode('7790040000100'), { value: '7790040000100', format: 'EAN-13' });
    assert.deepEqual(checkBarcode('4006381333931'), { value: '4006381333931', format: 'EAN-13' });
    assert.deepEqual(checkBarcode('96385074'), { value: '96385074', format: 'EAN-8' });
    assert.deepEqual(checkBarcode('036000291452'), { value: '036000291452', format: 'UPC-A' });
    assert.deepEqual(checkBarcode('10614141000415'), { value: '10614141000415', format: 'GTIN-14' });
  });

  it('tolera los separadores con los que se cargan a mano', () => {
    assert.equal(checkBarcode(' 7790040000100 ').value, '7790040000100');
    assert.equal(checkBarcode('779-0040-000100').value, '7790040000100');
    assert.equal(checkBarcode('7790040 000100').value, '7790040000100');
  });

  it('acepta un número (no solo string): el ERP puede mandarlo tipado', () => {
    assert.equal(checkBarcode(7790040000100).value, '7790040000100');
  });
});

describe('findDuplicateBarcodes', () => {
  it('detecta el caso real: un GTIN valido en 5 articulos de marcas distintas', () => {
    // 7790400021806 estaba cargado en C/40, C28, C67, CM/40 y COL1. Medusa tiene
    // constraint unico en variant.barcode, asi que 4 de los 5 writes fallaban.
    const duplicates = findDuplicateBarcodes([
      { code: 'C/40', barcode: '7790400021806' },
      { code: 'C28', barcode: '7790400021806' },
      { code: 'C67', barcode: '7790400021806' },
      { code: 'CM/40', barcode: '7790400021806' },
      { code: 'COL1', barcode: '7790400021806' },
      { code: 'ZC24', barcode: '7798123210323' },
    ]);
    assert.deepEqual([...duplicates.keys()], ['7790400021806']);
    assert.deepEqual(duplicates.get('7790400021806'), ['C/40', 'C28', 'C67', 'CM/40', 'COL1']);
  });

  it('no reporta los que aparecen una sola vez', () => {
    const duplicates = findDuplicateBarcodes([
      { code: 'A', barcode: '7790040000100' },
      { code: 'B', barcode: '4006381333931' },
    ]);
    assert.equal(duplicates.size, 0);
  });

  it('ignora los vacíos: la mitad del catálogo no trae barcode', () => {
    const duplicates = findDuplicateBarcodes([
      { code: 'A', barcode: null },
      { code: 'B', barcode: '' },
      { code: 'C', barcode: '   ' },
      { code: 'D' },
    ]);
    assert.equal(duplicates.size, 0);
  });
});

describe('checkBarcode — vacío no es error', () => {
  it('no reporta motivo cuando el campo viene vacío', () => {
    for (const empty of [null, undefined, '', '   ']) {
      const result = checkBarcode(empty);
      assert.equal(result.value, null);
      assert.equal((result as { reason: string | null }).reason, null);
    }
  });
});

describe('checkBarcode — rechazos con motivo', () => {
  const reason = (raw: unknown): string => {
    const result = checkBarcode(raw);
    assert.equal(result.value, null, `${String(raw)} deberia haberse rechazado`);
    const message = (result as { reason: string | null }).reason;
    assert.ok(message, 'el rechazo tiene que explicar por qué');
    return message!;
  };

  it('rechaza texto libre, que es lo que suele haber en un campo de notas', () => {
    assert.match(reason('sin codigo'), /no numéricos/);
    assert.match(reason('ver con deposito'), /no numéricos/);
  });

  it('rechaza la referencia de fábrica, que fue el bug original del barcode', () => {
    // `codigo_fabrica` ("1.1.1.50.010") se colaba al barcode y ensuciaba el
    // checkout por escáner. Sin los puntos quedan 8 dígitos —largo de EAN-8—, así
    // que lo que lo salva es el dígito verificador, no el largo.
    //
    // OJO: eso deja un residuo inevitable al validar solo por formato. Una
    // referencia de 8, 12, 13 o 14 dígitos que además pase el mod 10 (1 de cada
    // 10) se aceptaría. Es muchísimo mejor que copiar el campo tal cual, pero no
    // es una garantía: la garantía sería que el ERP mande el EAN en un campo
    // propio en lugar de una nota de texto libre.
    assert.match(reason('1.1.1.50.010'), /dígito verificador de un EAN-8/);
    assert.match(reason('ALBAHYO001'), /no numéricos/);
    assert.match(reason('1.1.1.50.0101'), /9 dígitos/);
  });

  it('rechaza largos que no son GTIN', () => {
    assert.match(reason('12345'), /5 dígitos/);
    assert.match(reason('123456789012345'), /15 dígitos/);
  });

  it('rechaza un dígito verificador incorrecto', () => {
    // 7790040000100 es válido; cambiarle el último dígito no.
    assert.match(reason('7790040000108'), /dígito verificador de un EAN-13/);
    assert.match(reason('96385075'), /dígito verificador de un EAN-8/);
  });

  it('no acepta un código de ceros por casualidad del check digit', () => {
    // 0000000000000 pasa el mod 10 (suma 0), así que el largo/formato es lo único
    // que lo distingue: se documenta que este caso SÍ pasa la validación de GS1.
    assert.equal(checkBarcode('0000000000000').value, '0000000000000');
  });
});
