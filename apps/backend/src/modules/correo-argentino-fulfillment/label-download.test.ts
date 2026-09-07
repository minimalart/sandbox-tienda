import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLabelFormat,
  parseCorreoLabelResponse,
  sanitizeLabelFileName,
  toLabelBuffer,
} from './label-download.ts';

const base64 = Buffer.from('%PDF-1.4 fake').toString('base64');

describe('parseCorreoLabelResponse — respuesta bulk', () => {
  it('parsea todos los ítems OK', () => {
    const labels = parseCorreoLabelResponse(
      [
        {
          trackingNumber: '111',
          fileBase64: base64,
          fileName: 'rotulo-111.pdf',
          result: 'OK',
        },
        {
          trackingNumber: '222',
          fileBase64: base64,
          fileName: 'rotulo-222.pdf',
          result: 'OK',
        },
      ],
      ['111', '222'],
    );

    assert.equal(labels.length, 2);
    assert.deepEqual(
      labels.map((label) => label.ok),
      [true, true],
    );
    assert.equal(labels[0]?.base64, base64);
    assert.equal(labels[0]?.fileName, 'rotulo-111.pdf');
    assert.equal(labels[0]?.error, null);
  });

  it('respeta el orden de los tracking numbers pedidos', () => {
    const labels = parseCorreoLabelResponse(
      [
        { trackingNumber: '222', fileBase64: base64, result: 'OK' },
        { trackingNumber: '111', fileBase64: base64, result: 'OK' },
      ],
      ['111', '222'],
    );
    assert.deepEqual(
      labels.map((label) => label.trackingNumber),
      ['111', '222'],
    );
  });

  it('acepta la respuesta envuelta en { labels: [...] }', () => {
    const labels = parseCorreoLabelResponse(
      { labels: [{ trackingNumber: '111', fileBase64: base64, result: 'OK' }] },
      ['111'],
    );
    assert.equal(labels[0]?.ok, true);
  });

  it('respuesta vacía / basura → todos los pedidos como fallidos', () => {
    for (const raw of [[], null, undefined, 'nope', {}]) {
      const labels = parseCorreoLabelResponse(raw, ['111']);
      assert.equal(labels.length, 1);
      assert.equal(labels[0]?.ok, false);
      assert.match(labels[0]?.error ?? '', /NO_RESPONSE/);
    }
  });
});

describe('parseCorreoLabelResponse — fallas parciales con HTTP 200', () => {
  // La API devuelve 200 igual: sin este parseo el operador recibe un ZIP
  // incompleto y ninguna explicación.
  it('separa los OK de los ERROR en la misma respuesta', () => {
    const labels = parseCorreoLabelResponse(
      [
        { trackingNumber: '111', fileBase64: base64, result: 'OK' },
        {
          trackingNumber: '222',
          fileBase64: '',
          result: 'ERROR: el envio ya fue impuesto',
        },
      ],
      ['111', '222'],
    );

    assert.equal(labels[0]?.ok, true);
    assert.equal(labels[1]?.ok, false);
    assert.equal(labels[1]?.base64, null);
    // El prefijo "ERROR:" se limpia: no aporta nada al mensaje.
    assert.equal(labels[1]?.error, 'el envio ya fue impuesto');
  });

  it('un TN pedido que no viene en la respuesta se devuelve como fallido', () => {
    const labels = parseCorreoLabelResponse(
      [{ trackingNumber: '111', fileBase64: base64, result: 'OK' }],
      ['111', '222', '333'],
    );

    assert.equal(labels.length, 3);
    assert.equal(labels[1]?.ok, false);
    assert.match(labels[1]?.error ?? '', /NO_RESPONSE/);
    assert.equal(labels[2]?.ok, false);
  });

  it('un "OK" sin fileBase64 NO es un rótulo: se trata como fallo', () => {
    const labels = parseCorreoLabelResponse(
      [{ trackingNumber: '111', result: 'OK' }],
      ['111'],
    );
    assert.equal(labels[0]?.ok, false);
    assert.equal(labels[0]?.base64, null);
    assert.match(labels[0]?.error ?? '', /no fileBase64/);
  });

  it('sin campo de estado, el criterio es si vino el archivo', () => {
    const withFile = parseCorreoLabelResponse(
      [{ trackingNumber: '111', fileBase64: base64 }],
      ['111'],
    );
    assert.equal(withFile[0]?.ok, true);

    const withoutFile = parseCorreoLabelResponse(
      [{ trackingNumber: '111' }],
      ['111'],
    );
    assert.equal(withoutFile[0]?.ok, false);
    assert.match(withoutFile[0]?.error ?? '', /no fileBase64/);
  });

  it('conserva los ítems que la API devolvió sin trackingNumber', () => {
    const labels = parseCorreoLabelResponse(
      [
        { trackingNumber: '111', fileBase64: base64, result: 'OK' },
        { result: 'ERROR: tracking number desconocido' },
      ],
      ['111'],
    );

    assert.equal(labels.length, 2);
    assert.equal(labels[1]?.trackingNumber, '');
    assert.equal(labels[1]?.error, 'tracking number desconocido');
  });
});

describe('parseCorreoLabelResponse — la doc de Correo es inconsistente', () => {
  it('acepta fileName y filename', () => {
    const upper = parseCorreoLabelResponse(
      [{ trackingNumber: '111', fileBase64: base64, fileName: 'a.pdf', result: 'OK' }],
      ['111'],
    );
    const lower = parseCorreoLabelResponse(
      [{ trackingNumber: '111', fileBase64: base64, filename: 'a.pdf', result: 'OK' }],
      ['111'],
    );

    assert.equal(upper[0]?.fileName, 'a.pdf');
    assert.equal(lower[0]?.fileName, 'a.pdf');
  });

  it('acepta result y status', () => {
    const withResult = parseCorreoLabelResponse(
      [{ trackingNumber: '111', fileBase64: base64, result: 'OK' }],
      ['111'],
    );
    const withStatus = parseCorreoLabelResponse(
      [{ trackingNumber: '111', fileBase64: base64, status: 'OK' }],
      ['111'],
    );
    const errorViaStatus = parseCorreoLabelResponse(
      [{ trackingNumber: '111', status: 'ERROR: no existe' }],
      ['111'],
    );

    assert.equal(withResult[0]?.ok, true);
    assert.equal(withStatus[0]?.ok, true);
    assert.equal(errorViaStatus[0]?.ok, false);
    assert.equal(errorViaStatus[0]?.error, 'no existe');
  });

  it('"ok" en minúsculas o con espacios también es OK', () => {
    for (const outcome of ['ok', ' OK ', 'Ok']) {
      const labels = parseCorreoLabelResponse(
        [{ trackingNumber: '111', fileBase64: base64, result: outcome }],
        ['111'],
      );
      assert.equal(labels[0]?.ok, true, `"${outcome}" debería ser OK`);
    }
  });

  it('un trackingNumber numérico se stringifica', () => {
    const labels = parseCorreoLabelResponse(
      [{ trackingNumber: 111, fileBase64: base64, result: 'OK' }],
      ['111'],
    );
    assert.equal(labels[0]?.trackingNumber, '111');
    assert.equal(labels[0]?.ok, true);
  });
});

describe('normalizeLabelFormat', () => {
  it('acepta los dos formatos funcionales', () => {
    assert.equal(normalizeLabelFormat('10x15'), '10x15');
    assert.equal(normalizeLabelFormat('label'), 'label');
    assert.equal(normalizeLabelFormat(' LABEL '), 'label');
  });

  it('cualquier otro valor cae al default (la API lo ignoraría en silencio)', () => {
    assert.equal(normalizeLabelFormat('a4'), '10x15');
    assert.equal(normalizeLabelFormat('zpl'), '10x15');
    assert.equal(normalizeLabelFormat(''), '10x15');
    assert.equal(normalizeLabelFormat(undefined), '10x15');
  });
});

describe('sanitizeLabelFileName', () => {
  it('reemplaza lo que no es seguro para un header o un ZIP', () => {
    assert.equal(
      sanitizeLabelFileName('rótulo 111 (copia).pdf', 'fallback.pdf'),
      'r_tulo_111__copia_.pdf',
    );
  });

  it('agrega la extensión cuando falta', () => {
    assert.equal(sanitizeLabelFileName('rotulo', 'fallback.pdf'), 'rotulo.pdf');
  });

  it('usa el fallback cuando el nombre viene vacío o null', () => {
    assert.equal(sanitizeLabelFileName('', 'fallback.pdf'), 'fallback.pdf');
    assert.equal(sanitizeLabelFileName(null, 'fallback.pdf'), 'fallback.pdf');
    assert.equal(sanitizeLabelFileName(undefined, 'fallback.pdf'), 'fallback.pdf');
  });
});

describe('toLabelBuffer', () => {
  it('decodifica el base64 del rótulo', () => {
    assert.equal(toLabelBuffer(base64).toString('utf8'), '%PDF-1.4 fake');
  });
});
