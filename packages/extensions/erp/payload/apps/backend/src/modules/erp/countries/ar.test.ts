import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { argentinaLayer, isValidCuitCuil, isValidDni } from './ar.ts';

describe('isValidCuitCuil', () => {
  it('acepta CUITs con checksum válido', () => {
    // 20-12345678-6: dv = 11 - (148 % 11) = 6
    assert.equal(isValidCuitCuil('20123456786'), true);
    assert.equal(isValidCuitCuil('20-12345678-6'), true);
    // 20-00000000-1: dv = 11 - (10 % 11) = 1
    assert.equal(isValidCuitCuil('20000000001'), true);
  });

  it('rechaza checksum incorrecto, largo inválido y no numéricos', () => {
    assert.equal(isValidCuitCuil('20123456780'), false);
    assert.equal(isValidCuitCuil('2012345678'), false);
    assert.equal(isValidCuitCuil('201234567861'), false);
    assert.equal(isValidCuitCuil('abc'), false);
    assert.equal(isValidCuitCuil(''), false);
  });
});

describe('isValidDni', () => {
  it('acepta 7 u 8 dígitos', () => {
    assert.equal(isValidDni('1234567'), true);
    assert.equal(isValidDni('12345678'), true);
    assert.equal(isValidDni('12.345.678'), true);
  });

  it('rechaza otros largos', () => {
    assert.equal(isValidDni('123456'), false);
    assert.equal(isValidDni('123456789'), false);
    assert.equal(isValidDni(''), false);
  });
});

describe('argentinaLayer.inferDocument', () => {
  it('lee el billing_snapshot y normaliza el número', () => {
    const doc = argentinaLayer.inferDocument({
      metadata: {
        billing_snapshot: { document_type: 'cuit', document_number: '20-12345678-6' },
      },
    });
    assert.deepEqual(doc, { type: 'CUIT', number: '20123456786' });
  });

  it('documento inválido → consumidor final (null/null)', () => {
    const doc = argentinaLayer.inferDocument({
      metadata: {
        billing_snapshot: { document_type: 'CUIT', document_number: '20-12345678-0' },
      },
    });
    assert.deepEqual(doc, { type: null, number: null });
  });

  it('sin snapshot → null/null', () => {
    assert.deepEqual(argentinaLayer.inferDocument({ metadata: null }), { type: null, number: null });
    assert.deepEqual(argentinaLayer.inferDocument({ metadata: {} }), { type: null, number: null });
  });
});

describe('argentinaLayer.inferFiscalCondition', () => {
  // Silenciar warns esperados: los tests que cubren fallbacks (invoice_a sin
  // tax_condition / legal_name / condicion desconocida) disparan console.warn a
  // propósito. Reponemos el spy en el after de cada spec para no filtrar noise.
  const withSilencedWarn = async (fn: () => void | Promise<void>): Promise<string[]> => {
    const original = console.warn;
    const calls: string[] = [];
    console.warn = (msg: unknown) => {
      calls.push(String(msg));
    };
    try {
      await fn();
    } finally {
      console.warn = original;
    }
    return calls;
  };

  it('sin invoice_type + doc DNI válido → consumer_final, sin razón social', () => {
    const result = argentinaLayer.inferFiscalCondition!({
      metadata: {
        billing_snapshot: { document_type: 'DNI', document_number: '20304050' },
      },
    });
    assert.deepEqual(result, { condition: 'consumer_final', legal_name: null });
  });

  it('sin invoice_type + sin documento → consumer_final', () => {
    const result = argentinaLayer.inferFiscalCondition!({ metadata: null });
    assert.deepEqual(result, { condition: 'consumer_final', legal_name: null });
  });

  it('invoice_a + tax_condition=responsable_inscripto + legal_name → responsable_inscripto con razón social', () => {
    const result = argentinaLayer.inferFiscalCondition!({
      metadata: {
        invoice_type: 'invoice_a',
        billing_snapshot: {
          document_type: 'CUIT',
          document_number: '20-12345678-6',
          tax_condition: 'responsable_inscripto',
          legal_name: 'Razón Social SRL',
        },
      },
    });
    assert.deepEqual(result, { condition: 'responsable_inscripto', legal_name: 'Razón Social SRL' });
  });

  it('invoice_a + tax_condition=exento + legal_name → exento con razón social', () => {
    const result = argentinaLayer.inferFiscalCondition!({
      metadata: {
        invoice_type: 'invoice_a',
        billing_snapshot: {
          document_type: 'CUIT',
          document_number: '20-12345678-6',
          tax_condition: 'exento',
          legal_name: 'ONG Educativa',
        },
      },
    });
    assert.deepEqual(result, { condition: 'exento', legal_name: 'ONG Educativa' });
  });

  it('invoice_a + tax_condition=monotributo + legal_name → monotributo (cross-cliente)', () => {
    const result = argentinaLayer.inferFiscalCondition!({
      metadata: {
        invoice_type: 'invoice_a',
        billing_snapshot: {
          document_type: 'CUIT',
          document_number: '20-12345678-6',
          tax_condition: 'monotributo',
          legal_name: 'Estudio Freelance',
        },
      },
    });
    assert.deepEqual(result, { condition: 'monotributo', legal_name: 'Estudio Freelance' });
  });

  it('invoice_a sin tax_condition → cae a consumer_final con warn', async () => {
    let result: ReturnType<NonNullable<typeof argentinaLayer.inferFiscalCondition>> | undefined;
    const warns = await withSilencedWarn(() => {
      result = argentinaLayer.inferFiscalCondition!({
        metadata: {
          invoice_type: 'invoice_a',
          billing_snapshot: { document_type: 'CUIT', document_number: '20-12345678-6', legal_name: 'X' },
        },
      });
    });
    assert.deepEqual(result, { condition: 'consumer_final', legal_name: null });
    assert.ok(warns.some((m) => /sin billing_snapshot\.tax_condition/.test(m)));
  });

  it('invoice_a sin legal_name → cae a consumer_final con warn', async () => {
    let result: ReturnType<NonNullable<typeof argentinaLayer.inferFiscalCondition>> | undefined;
    const warns = await withSilencedWarn(() => {
      result = argentinaLayer.inferFiscalCondition!({
        metadata: {
          invoice_type: 'invoice_a',
          billing_snapshot: {
            document_type: 'CUIT',
            document_number: '20-12345678-6',
            tax_condition: 'responsable_inscripto',
          },
        },
      });
    });
    assert.deepEqual(result, { condition: 'consumer_final', legal_name: null });
    assert.ok(warns.some((m) => /sin billing_snapshot\.legal_name/.test(m)));
  });

  it('invoice_a con tax_condition desconocida → cae a consumer_final con warn', async () => {
    let result: ReturnType<NonNullable<typeof argentinaLayer.inferFiscalCondition>> | undefined;
    const warns = await withSilencedWarn(() => {
      result = argentinaLayer.inferFiscalCondition!({
        metadata: {
          invoice_type: 'invoice_a',
          billing_snapshot: {
            document_type: 'CUIT',
            document_number: '20-12345678-6',
            tax_condition: 'algo_raro',
            legal_name: 'X',
          },
        },
      });
    });
    assert.deepEqual(result, { condition: 'consumer_final', legal_name: null });
    assert.ok(warns.some((m) => /desconocida 'algo_raro'/.test(m)));
  });
});

describe('argentinaLayer — normalizaciones', () => {
  it('normalizePhone conserva el + internacional y limpia el resto', () => {
    assert.equal(argentinaLayer.normalizePhone('+54 9 (11) 5555-1234'), '+5491155551234');
    assert.equal(argentinaLayer.normalizePhone('11 5555 1234'), '1155551234');
    assert.equal(argentinaLayer.normalizePhone('   '), null);
    assert.equal(argentinaLayer.normalizePhone(null), null);
  });

  it('normalizePostalCode trimea y pasa a mayúsculas', () => {
    assert.equal(argentinaLayer.normalizePostalCode(' b1636 '), 'B1636');
    assert.equal(argentinaLayer.normalizePostalCode(''), null);
    assert.equal(argentinaLayer.normalizePostalCode(undefined), null);
  });
});
