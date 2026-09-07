import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CORREO_PROVINCE_CODES,
  CORREO_PROVINCE_NAMES,
  isCorreoProvinceCode,
  normalizePostalCode,
  normalizeProvinceToCode,
  provinceCodeFromIso,
  provinceCodeFromName,
  provinceCodeToIso,
  provinceNameFromCode,
} from './province-codes.ts';

describe('CORREO_PROVINCE_NAMES — tabla completa', () => {
  it('tiene exactamente las 24 jurisdicciones', () => {
    assert.equal(CORREO_PROVINCE_CODES.length, 24);
  });

  it('no incluye I ni O (no existen en la tabla de Correo)', () => {
    assert.equal(isCorreoProvinceCode('I'), false);
    assert.equal(isCorreoProvinceCode('O'), false);
  });

  it('las 24 letras hacen ida y vuelta letra → nombre → letra', () => {
    for (const code of CORREO_PROVINCE_CODES) {
      const name = provinceNameFromCode(code);
      assert.ok(name, `${code} debe tener nombre`);
      assert.equal(
        provinceCodeFromName(name),
        code,
        `${code} (${name}) debe volver a ${code}`,
      );
    }
  });

  it('las 24 letras hacen ida y vuelta letra → ISO 3166-2 → letra', () => {
    for (const code of CORREO_PROVINCE_CODES) {
      const iso = provinceCodeToIso(code);
      assert.equal(iso, `AR-${code}`);
      assert.equal(provinceCodeFromIso(iso as string), code);
    }
  });

  it('cada letra mapea a un nombre único (ningún nombre duplicado)', () => {
    const names = Object.values(CORREO_PROVINCE_NAMES);
    assert.equal(new Set(names).size, names.length);
  });
});

describe('provinceCodeFromName — variantes y acentos', () => {
  it('tolera acentos, mayúsculas y puntuación', () => {
    assert.equal(provinceCodeFromName('Río Negro'), 'R');
    assert.equal(provinceCodeFromName('RIO NEGRO'), 'R');
    assert.equal(provinceCodeFromName('  río-negro  '), 'R');
    assert.equal(provinceCodeFromName('Córdoba'), 'X');
    assert.equal(provinceCodeFromName('cordoba'), 'X');
    assert.equal(provinceCodeFromName('Neuquén'), 'Q');
    assert.equal(provinceCodeFromName('Tucumán'), 'T');
    assert.equal(provinceCodeFromName('Entre Ríos'), 'E');
  });

  it('acepta las variantes que llegan del checkout', () => {
    assert.equal(provinceCodeFromName('CABA'), 'C');
    assert.equal(provinceCodeFromName('caba'), 'C');
    assert.equal(provinceCodeFromName('Capital Federal'), 'C');
    assert.equal(provinceCodeFromName('Ciudad de Buenos Aires'), 'C');
    assert.equal(provinceCodeFromName('Bs As'), 'B');
    assert.equal(provinceCodeFromName('PBA'), 'B');
    assert.equal(provinceCodeFromName('GBA'), 'B');
    assert.equal(provinceCodeFromName('Sgo. del Estero'), 'G');
  });

  it('inputs inválidos → undefined', () => {
    assert.equal(provinceCodeFromName(''), undefined);
    assert.equal(provinceCodeFromName('   '), undefined);
    assert.equal(provinceCodeFromName('Montevideo'), undefined);
    assert.equal(provinceCodeFromName('Santiago de Chile'), undefined);
    assert.equal(provinceCodeFromName(undefined as unknown as string), undefined);
    assert.equal(provinceCodeFromName(42 as unknown as string), undefined);
  });
});

describe('B vs C — Provincia de Buenos Aires NO es CABA', () => {
  // Confundirlas es un 400 garantizado: zipCode se valida contra state.
  it('"Buenos Aires" es B y "Ciudad Autónoma de Buenos Aires" es C', () => {
    assert.equal(provinceCodeFromName('Buenos Aires'), 'B');
    assert.equal(provinceCodeFromName('Provincia de Buenos Aires'), 'B');
    assert.equal(provinceCodeFromName('Ciudad Autónoma de Buenos Aires'), 'C');
    assert.equal(provinceCodeFromName('CIUDAD AUTONOMA DE BUENOS AIRES'), 'C');
  });

  it('el match es exacto: "buenosaires" es substring de la clave de CABA y NO debe colisionar', () => {
    assert.notEqual(
      provinceCodeFromName('Ciudad Autonoma de Buenos Aires'),
      provinceCodeFromName('Buenos Aires'),
    );
  });

  it('sus ISO también son distintos', () => {
    assert.equal(provinceCodeToIso(provinceCodeFromName('Buenos Aires')!), 'AR-B');
    assert.equal(provinceCodeToIso(provinceCodeFromName('CABA')!), 'AR-C');
  });
});

describe('provinceCodeFromIso', () => {
  it('acepta minúsculas y espacios', () => {
    assert.equal(provinceCodeFromIso('ar-b'), 'B');
    assert.equal(provinceCodeFromIso(' AR-C '), 'C');
  });

  it('rechaza códigos de otros países y letras inexistentes', () => {
    assert.equal(provinceCodeFromIso('BR-SP'), undefined);
    assert.equal(provinceCodeFromIso('AR-I'), undefined);
    assert.equal(provinceCodeFromIso('AR-BB'), undefined);
    assert.equal(provinceCodeFromIso('B'), undefined);
  });
});

describe('normalizeProvinceToCode — resuelve cualquier representación', () => {
  it('acepta el código de una letra directo', () => {
    assert.equal(normalizeProvinceToCode('B'), 'B');
    assert.equal(normalizeProvinceToCode('c'), 'C');
    assert.equal(normalizeProvinceToCode(' X '), 'X');
  });

  it('acepta ISO 3166-2 y nombres', () => {
    assert.equal(normalizeProvinceToCode('AR-S'), 'S');
    assert.equal(normalizeProvinceToCode('Santa Fe'), 'S');
  });

  it('inputs inválidos → undefined', () => {
    assert.equal(normalizeProvinceToCode(''), undefined);
    assert.equal(normalizeProvinceToCode('   '), undefined);
    assert.equal(normalizeProvinceToCode('I'), undefined);
    assert.equal(normalizeProvinceToCode(null), undefined);
    assert.equal(normalizeProvinceToCode(undefined), undefined);
    assert.equal(normalizeProvinceToCode('Provincia Inexistente'), undefined);
  });
});

describe('normalizePostalCode', () => {
  it('extrae los 4 dígitos de un CPA completo', () => {
    assert.equal(normalizePostalCode('C1121AAF'), '1121');
    assert.equal(normalizePostalCode('c1121aaf'), '1121');
    assert.equal(normalizePostalCode('B1636'), '1636');
  });

  it('deja pasar un CP de 4 dígitos', () => {
    assert.equal(normalizePostalCode('1704'), '1704');
    assert.equal(normalizePostalCode(' 1757 '), '1757');
  });

  it('devuelve el valor crudo cuando no matchea el patrón', () => {
    assert.equal(normalizePostalCode('12345'), '12345');
  });

  it('vacío / null → undefined', () => {
    assert.equal(normalizePostalCode(''), undefined);
    assert.equal(normalizePostalCode('   '), undefined);
    assert.equal(normalizePostalCode(null), undefined);
    assert.equal(normalizePostalCode(undefined), undefined);
  });
});
