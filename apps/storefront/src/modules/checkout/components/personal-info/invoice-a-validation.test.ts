import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceAFieldErrors } from './invoice-a-validation';

const valid = {
  document_number: '20-12345678-6',
  legal_name: 'Acme S.A.',
  billing_email: 'facturacion@acme.com',
  address_line_1: 'Av. Siempreviva 742',
  city: 'Neuquén',
  province: 'Neuquén',
  postal_code: '8300',
};

test('datos completos no tienen errores', () => {
  assert.deepEqual(invoiceAFieldErrors(valid), {});
});

test('cada campo vacío tiene su propio mensaje', () => {
  const errors = invoiceAFieldErrors({ ...valid, legal_name: '  ', city: '' });
  assert.deepEqual(Object.keys(errors).sort(), ['city', 'legal_name']);
  assert.equal(errors.legal_name, 'Ingresá la razón social');
  assert.equal(errors.city, 'Ingresá la localidad');
});

test('distingue CUIT vacío de CUIT inválido', () => {
  assert.equal(invoiceAFieldErrors({ ...valid, document_number: '' }).document_number, 'Ingresá el CUIT');
  assert.equal(invoiceAFieldErrors({ ...valid, document_number: '20-12345678-0' }).document_number, 'Ingresá un CUIT válido');
});

test('distingue email vacío de email inválido', () => {
  assert.equal(invoiceAFieldErrors({ ...valid, billing_email: '' }).billing_email, 'Ingresá el email de facturación');
  assert.equal(invoiceAFieldErrors({ ...valid, billing_email: 'acme' }).billing_email, 'Ingresá un email válido');
});

test('null y undefined cuentan como vacío', () => {
  const errors = invoiceAFieldErrors({ ...valid, province: null, postal_code: undefined });
  assert.equal(errors.province, 'Ingresá la provincia');
  assert.equal(errors.postal_code, 'Ingresá el código postal');
});
