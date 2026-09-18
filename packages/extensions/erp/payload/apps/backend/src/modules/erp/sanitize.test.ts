import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePayload, truncateError, REDACTED } from './sanitize.ts';

describe('sanitizePayload — redacción por clave', () => {
  it('redacta claves sensibles en cualquier nivel', () => {
    const result = sanitizePayload({
      api_key: 'secreta',
      nested: { authorization: 'Bearer x', password: '123', ok: 'visible' },
      card_number: '4111',
      cvv: '123',
      client_secret: 'shhh',
    }) as Record<string, unknown>;
    assert.equal(result.api_key, REDACTED);
    assert.equal((result.nested as Record<string, unknown>).authorization, REDACTED);
    assert.equal((result.nested as Record<string, unknown>).password, REDACTED);
    assert.equal((result.nested as Record<string, unknown>).ok, 'visible');
    assert.equal(result.card_number, REDACTED);
    assert.equal(result.cvv, REDACTED);
    assert.equal(result.client_secret, REDACTED);
  });

  it('preserva valores no sensibles y tipos primitivos', () => {
    const result = sanitizePayload({ sku: 'ABC-123', qty: 5, active: true, note: null }) as Record<
      string,
      unknown
    >;
    assert.deepEqual(result, { sku: 'ABC-123', qty: 5, active: true, note: null });
  });

  it('recorre arrays', () => {
    const result = sanitizePayload([{ token: 'x' }, { sku: 'A' }]) as Array<Record<string, unknown>>;
    assert.equal(result[0]!.token, REDACTED);
    assert.equal(result[1]!.sku, 'A');
  });

  it('serializa fechas y bigint', () => {
    const date = new Date('2026-07-04T12:00:00Z');
    const result = sanitizePayload({ at: date, big: 10n }) as Record<string, unknown>;
    assert.equal(result.at, '2026-07-04T12:00:00.000Z');
    assert.equal(result.big, '10');
  });

  // Contrato del envío al ERP: los datos personales viajan tal cual en el
  // payload de venta (Odoo/Bsale/Zeus los necesitan para crear la orden).
  // La regla de "no en logs" del proyecto se cumple por otro lado: NINGÚN
  // logger del módulo erp vuelca el `payload` completo. Este test blindá el
  // sanitizer para que un agregado bien intencionado de `student` o `person`
  // al regex de claves sensibles no rompa silenciosamente el envío al ERP.
  it('NO redacta datos personales (customer, alumnos y asignaciones)', () => {
    const result = sanitizePayload({
      customer: { first_name: 'Ana', last_name: 'García', document: '40123456' },
      school: { external_ref: 'san_agustin', name: 'Colegio San Agustín', source_site_id: 'ds_01H...' },
      student_assignments: {
        schema_version: '1.0',
        items: [
          {
            sku: 'EDU-KIT-4',
            quantity: 1,
            recipients: [
              { external_id: 'p-1', first_name: 'Juan', last_name: 'Pérez', document: '45123456', grade: '4A', quantity: 1 },
            ],
          },
        ],
      },
    }) as Record<string, any>;
    assert.equal(result.customer.first_name, 'Ana');
    assert.equal(result.customer.document, '40123456');
    assert.equal(result.school.external_ref, 'san_agustin');
    assert.equal(result.student_assignments.items[0].recipients[0].document, '45123456');
    assert.equal(result.student_assignments.items[0].recipients[0].first_name, 'Juan');
  });
});

describe('sanitizePayload — truncado y ciclos', () => {
  it('trunca strings largos', () => {
    const long = 'x'.repeat(5000);
    const result = sanitizePayload({ note: long }) as Record<string, string>;
    assert.ok(result.note!.length < 2100);
    assert.ok(result.note!.endsWith('…[truncated]'));
  });

  it('acota el tamaño total del blob', () => {
    const huge = Array.from({ length: 200 }, (_, i) => ({ sku: `SKU-${i}`, note: 'y'.repeat(200) }));
    const result = sanitizePayload(huge) as Record<string, unknown>;
    assert.equal(result.truncated, true);
    assert.ok(typeof result.preview === 'string');
  });

  it('corta referencias circulares', () => {
    const obj: Record<string, unknown> = { sku: 'A' };
    obj.self = obj;
    const result = sanitizePayload(obj) as Record<string, unknown>;
    assert.equal(result.self, '[circular]');
  });
});

describe('truncateError', () => {
  it('extrae el mensaje de un Error y trunca', () => {
    assert.equal(truncateError(new Error('boom')), 'boom');
    assert.ok(truncateError(new Error('z'.repeat(3000))).length <= 2001);
    assert.equal(truncateError('texto plano'), 'texto plano');
  });

  it('nunca devuelve [object Object]: los workflows rechazan con objeto', () => {
    // Regresión: un alta de producto fallida dejaba "[object Object]" en el log
    // del sync y la causa real era imposible de diagnosticar.
    assert.equal(truncateError({ errors: [new Error('handle ya existe')] }), 'handle ya existe');
    assert.equal(
      truncateError({ errors: [new Error('primera'), new Error('segunda')] }),
      'primera | segunda'
    );
    assert.equal(truncateError({ error: { message: 'anidado' } }), 'anidado');
    assert.equal(truncateError({ message: 'directo' }), 'directo');
  });

  it('serializa un objeto sin mensaje en lugar de perderlo', () => {
    assert.equal(truncateError({ code: 'INVALID', field: 'sku' }), '{"code":"INVALID","field":"sku"}');
  });

  it('sobrevive a referencias circulares y a anidamiento profundo', () => {
    const circular: Record<string, unknown> = { code: 'X' };
    circular.self = circular;
    assert.doesNotMatch(truncateError(circular), /\[object Object\]/);

    let deep: Record<string, unknown> = { message: 'fondo' };
    for (let i = 0; i < 10; i += 1) deep = { error: deep };
    assert.ok(truncateError(deep).length > 0);
  });
});
