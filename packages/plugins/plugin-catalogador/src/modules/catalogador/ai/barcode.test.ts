import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBarcode, isValidBarcode, pickProductBarcode } from './barcode.ts';

test('normalizeBarcode quita espacios y guiones', () => {
  assert.equal(normalizeBarcode('779 1234567890'), '7791234567890');
  assert.equal(normalizeBarcode('  400-638-1333931 '), '4006381333931');
  assert.equal(normalizeBarcode(4006381333931), '4006381333931');
  assert.equal(normalizeBarcode(''), null);
  assert.equal(normalizeBarcode(null), null);
  assert.equal(normalizeBarcode({}), null);
});

test('isValidBarcode acepta EAN/UPC/GTIN con dígito de control válido', () => {
  assert.equal(isValidBarcode('4006381333931'), true); // EAN-13 real
  assert.equal(isValidBarcode('7791234567898'), true); // EAN-13 (check 8)
  assert.equal(isValidBarcode('400 638-133 3931'), true); // se normaliza primero
});

test('isValidBarcode rechaza SKUs y códigos internos', () => {
  assert.equal(isValidBarcode('7791234567890'), false); // dígito de control incorrecto (SKU)
  assert.equal(isValidBarcode('ABC-123'), false); // no numérico
  assert.equal(isValidBarcode('12345'), false); // longitud inválida
  assert.equal(isValidBarcode('SKU-INTERNO-99'), false);
  assert.equal(isValidBarcode(null), false);
});

test('pickProductBarcode toma el código de ean/metadata, no sólo de barcode', () => {
  // Código real en `ean` (barcode null) — como el caso del barcode-scanner.
  assert.equal(
    pickProductBarcode([{ barcode: null, ean: '4006381333931', sku: 'INT-1' }]),
    '4006381333931'
  );
  // Código real en metadata, normalizado.
  assert.equal(
    pickProductBarcode([{ metadata: { ean: ' 4006381-333931 ' } }]),
    '4006381333931'
  );
  // Sólo un SKU inválido → no se elige nada.
  assert.equal(pickProductBarcode([{ sku: '7791234567890' }]), null);
  assert.equal(pickProductBarcode([]), null);
  assert.equal(pickProductBarcode(null), null);
});
