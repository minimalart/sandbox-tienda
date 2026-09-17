import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DESCRIPTION_RULES_VERSION,
  descriptionRulesFingerprint,
  isRawErpDescription,
  normalizeProductDescription,
} from './product-description';
import { resolveTitleRules } from './product-title';

const rules = resolveTitleRules(null);
const run = (raw: string | null | undefined, title?: string) =>
  normalizeProductDescription(raw, { title, rules });

describe('isRawErpDescription', () => {
  it('reconoce el volcado en mayúsculas de la gestión', () => {
    assert.equal(isRawErpDescription('LATEX 3X MAS LAVABLE QUE LOS NORMALES.'), true);
    assert.equal(isRawErpDescription('871  ESMALTE BRILLANTE'), true);
    assert.equal(isRawErpDescription('AA - LIJA TELA ESMERIL N° 40'), true);
  });

  it('reconoce un texto redactado, aunque tenga siglas y nombres propios', () => {
    assert.equal(
      isRawErpDescription(
        'Obtené acabados profesionales con la lija al agua DOBLE A de grano 1200.'
      ),
      false
    );
    assert.equal(
      isRawErpDescription('El acrílico G2 de EQ Arte es una pintura decorativa de alta calidad.'),
      false
    );
  });
});

describe('normalizeProductDescription — la guardia de propiedad (D01)', () => {
  it('devuelve intacto un texto redactado: es del catalogador, no del ERP', () => {
    const redactada =
      'Descubrí la pintura a la tiza EQ Arte tono oro de 200 cc, perfecta para dar un toque vintage.';
    const result = run(redactada, 'Pintura a la tiza 040 oro x200 cc');
    assert.equal(result.description, redactada);
    assert.deepEqual(result.applied, []);
    assert.equal(result.discarded, null);
  });

  it('sin descripción no inventa nada', () => {
    assert.deepEqual(run(null), { description: null, applied: [], discarded: null });
    assert.deepEqual(run('   '), { description: null, applied: [], discarded: null });
  });

  it('preserva `\\n\\n` de contenido editorial multi-línea (Markdown desde eCommerce)', () => {
    // Cuando el HTML rico de Odoo se convierte a Markdown (htmlToMarkdown) llega
    // con `\n\n` entre bloques. La versión previa aplastaba todo con `collapse`
    // y perdíamos encabezados/listas. D01 debe pasar el texto intacto salvo
    // colapsar runs de espacios/tabs por línea.
    const markdown =
      '### Características Principales\n\n' +
      '- **Diseño ergonómico** para el aula.\n' +
      '- Estructura de acero.\n\n' +
      'Ideal para nivel primario.';
    const result = run(markdown, 'Combo Pupitre');
    assert.equal(result.description, markdown);
    assert.deepEqual(result.applied, []);
    assert.equal(result.discarded, null);
  });

  it('colapsa espacios/tabs dobles por línea pero no toca los `\\n\\n`', () => {
    const input = 'Título del bloque\n\n-   item con  tabs\ty espacios';
    const result = run(input, 'Producto');
    assert.equal(result.description, 'Título del bloque\n\n- item con tabs y espacios');
  });
});

describe('normalizeProductDescription — caso de lectura (D07)', () => {
  it('pasa el volcado en mayúsculas a formato de tienda', () => {
    const result = run(
      'LATEX 3X MAS LAVABLE QUE LOS NORMALES. ES ADEMAS ANTIMARCA Y ANTIMANCHA.',
      'Albalatex ultralavable mate interior blanco x1 lt'
    );
    assert.equal(
      result.description,
      'Látex 3X más lavable que los normales. Es además antimarca y antimancha.'
    );
    assert.ok(result.applied.includes('D07'));
  });

  it('acentúa aunque la palabra tenga la puntuación pegada', () => {
    // El diccionario matchea por token plegado: sin separar la coma,
    // `CERAMICOS,` no encuentra `cerámicos`.
    assert.equal(
      run('AZULEJOS, CERAMICOS, PISOS, INTERIOR O EXTERIOR', 'Adhesivo klaukol x30 kg').description,
      'Azulejos, cerámicos, pisos, interior o exterior'
    );
  });

  it('conserva los códigos técnicos y las siglas', () => {
    assert.equal(
      run('CAUDAL DE AIRE 222L/min - PRESION MAX. 118 PSI', 'Compresor de aire 24 lt')
        .description,
      'Caudal de aire 222L/min - presión max. 118 PSI'
    );
  });

  it('pone mayúscula de oración aunque la oración empiece con un número', () => {
    assert.equal(
      run('100% TRANSPARRENTE - PARA PISTOLAS 40W', 'Sellador de silicona x280 gr').description,
      '100% Transparente - para pistolas 40W'
    );
  });

  it('es idempotente: el resultado ya no es crudo y la guardia lo deja pasar', () => {
    const once = run(
      'ELASTICO, ANTIHONGOS, ANTIALGAS, DIRECTO SOBRE GALVANIZADO',
      'Duralba techos multisuperficies blanco x20 lt'
    ).description!;
    assert.equal(once, 'Elástico, antihongos, antialgas, directo sobre galvanizado');
    assert.equal(run(once, 'Duralba techos multisuperficies blanco x20 lt').description, once);
  });
});

describe('normalizeProductDescription — descartes', () => {
  it('descarta el código interno con la categoría pegada (D03 + D06)', () => {
    const result = run('871  ESMALTE BRILLANTE', 'Albalux diamante 3 en 1 aluminio x0,5 lt');
    assert.equal(result.description, null);
    assert.equal(result.discarded, 'fragmento');
    assert.ok(result.applied.includes('D03'));
  });

  it('descarta cuando sólo quedaba el código (D04)', () => {
    assert.equal(run('11163     KLESTOB', 'Cinta de papel 48 mm').discarded, 'fragmento');
    assert.equal(run('15341  -  ', 'Lo que sea').discarded, 'solo_codigo');
  });

  it('descarta el título del ERP copiado en la descripción (D05)', () => {
    const result = run(
      'ALBA STD - ESMALTE SINTETICO BLANCO SATINADO 4 LTS',
      'Std esmalte sintético blanco satinado x4 lt'
    );
    assert.equal(result.description, null);
    assert.equal(result.discarded, 'repite_el_titulo');
  });

  it('NO descarta un texto que aporta datos que el título no tiene', () => {
    const result = run(
      'ABIERTA 2,69m - EXTENDIDA 4,5m - 9,4kg',
      'Escalera telescópica de aluminio'
    );
    assert.equal(result.discarded, null);
    assert.equal(result.description, 'Abierta 2,69m - extendida 4,5m - 9,4kg');
  });
});

describe('normalizeProductDescription — el código de cabecera (D03)', () => {
  it('lo saca cuando el separador es doble espacio o guion', () => {
    assert.equal(run('14494 - ENDUIDO PARA PAREDES Y CIELORRASOS').description, 'Enduido para paredes y cielorrasos');
    assert.equal(run('5369  NASCAR PERFORMANCE PARA MOTOR').description, 'Nascar performance para motor');
  });

  it('NO se come una medida: un solo espacio no alcanza', () => {
    // `115mm - 750W - 11.000 RPM` y `70mm DE ANCHO` empiezan con un número que ES
    // el contenido. Se mira `applied` y no el texto porque un descarte posterior
    // (D06) taparía el resultado de esta regla.
    assert.equal(run('115mm - 750W - 11.000 RPM').applied.includes('D03'), false);
    assert.equal(run('70mm DE ANCHO').applied.includes('D03'), false);
    assert.equal(
      run('115mm - 750W - 11.000 RPM', 'Amoladora angular').description,
      '115mm - 750W - 11.000 RPM'
    );
  });
});

describe('descriptionRulesFingerprint', () => {
  it('lleva la versión de las reglas de descripción y la huella del título', () => {
    const fingerprint = descriptionRulesFingerprint(rules);
    assert.match(fingerprint, new RegExp(`^d${DESCRIPTION_RULES_VERSION}:\\d+:[0-9a-f]{8}$`));
  });

  it('cambia si cambia el diccionario del tenant', () => {
    const otras = resolveTitleRules({ dictionary: { antihongos: 'antihongos®' } });
    assert.notEqual(descriptionRulesFingerprint(rules), descriptionRulesFingerprint(otras));
  });
});
