import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, offerableOptions, impliedAnswers, describeAnswers, answeredCount, type FacetCounts } from './engine';
import { buildAdvisorFilterBy, clauseFor, relaxableDimensions, pendingFacetFields, type AdvisorAnswers } from './filters';
import { ADVISOR_FLOW, dimensionByKey, neutralValue } from './dimensions';
import { sanitizeExtractedFilters, parseAdvisorButtonId, advisorButtonId } from './flow';

const CONFIG = { showThreshold: 5, maxQuestions: 3 };
const CHANNEL = ['sc_test'];

/** Facetas con todos los valores disponibles (catálogo "completo"). */
const RICH_FACETS: FacetCounts = {
  advisor_surface: { wall: 300, metal: 400, wood: 500, plastic: 20, multi: 300 },
  advisor_product_type: { paint: 1300, art_paint: 250, prep: 200, accessory: 600, tool: 170 },
  advisor_environment: { interior: 400, exterior: 300, unknown: 900 },
  advisor_special_use: { floor: 58, pool: 5 },
  advisor_base: { water: 400, solvent: 300, unknown: 700 },
};

describe('filters — expansión de compatibilidad (§12)', () => {
  test('madera trae también multisuperficie', () => {
    assert.equal(clauseFor('surface', 'wood'), 'advisor_surface:=[wood,multi]');
  });

  test('metal trae también multisuperficie', () => {
    assert.equal(clauseFor('surface', 'metal'), 'advisor_surface:=[metal,multi]');
  });

  test('multisuperficie explícito NO se expande a todo', () => {
    assert.equal(clauseFor('surface', 'multi'), 'advisor_surface:=[multi]');
  });

  test('"me da igual" no filtra', () => {
    assert.equal(clauseFor('environment', 'any'), null);
    assert.equal(clauseFor('base', 'any'), null);
  });

  test('el "No" de uso especial NO filtra por ausencia', () => {
    // Una pintura de piso sirve para una pared: filtrar por ausencia esconderia
    // productos válidos.
    assert.equal(clauseFor('special_use', 'none'), null);
  });

  test('piso y pileta sí filtran', () => {
    assert.equal(clauseFor('special_use', 'floor'), 'advisor_special_use:=[floor]');
    assert.equal(clauseFor('special_use', 'pool'), 'advisor_special_use:=[pool]');
  });
});

describe('buildAdvisorFilterBy', () => {
  test('siempre acota por canal y oculta los hidden_from_store', () => {
    const filter = buildAdvisorFilterBy({}, CHANNEL);
    assert.match(filter, /sales_channels\.id:=\[sc_test\]/);
    assert.match(filter, /metadata\.hidden_from_store:!=true/);
  });

  test('con VARIOS canales, la búsqueda abarca todos', () => {
    // El bot puede atender más de un catálogo (Admin → WhatsApp → Ajustes).
    const filter = buildAdvisorFilterBy({}, ['sc_a', 'sc_b']);
    assert.match(filter, /sales_channels\.id:=\[sc_a,sc_b\]/);
  });

  test('acumula las cláusulas de las dimensiones respondidas', () => {
    const filter = buildAdvisorFilterBy(
      { surface: 'wood', product_type: 'paint', environment: 'exterior', base: 'water' },
      CHANNEL,
    );
    assert.match(filter, /advisor_surface:=\[wood,multi\]/);
    assert.match(filter, /advisor_product_type:=\[paint\]/);
    assert.match(filter, /advisor_environment:=\[exterior\]/);
    assert.match(filter, /advisor_base:=\[water\]/);
  });

  test('`dropped` saca sólo la dimensión pedida', () => {
    const filter = buildAdvisorFilterBy({ surface: 'wood', base: 'water' }, CHANNEL, ['base']);
    assert.match(filter, /advisor_surface/);
    assert.doesNotMatch(filter, /advisor_base/);
  });
});

describe('relaxableDimensions — §14', () => {
  test('la base es relajable', () => {
    assert.deepEqual(relaxableDimensions({ base: 'water' }), ['base']);
  });

  test('superficie y tipo de producto NUNCA se relajan', () => {
    const relaxable = relaxableDimensions({ surface: 'wood', product_type: 'paint' });
    assert.deepEqual(relaxable, []);
  });

  test('piso y pileta NUNCA se relajan', () => {
    assert.deepEqual(relaxableDimensions({ special_use: 'pool' }), []);
    assert.deepEqual(relaxableDimensions({ special_use: 'floor' }), []);
  });

  test('una respuesta que no filtra no es relajable (no hay nada que soltar)', () => {
    assert.deepEqual(relaxableDimensions({ base: 'any' }), []);
  });

  test('el ambiente es relajable pero después de nada más restrictivo', () => {
    const relaxable = relaxableDimensions({
      surface: 'wood',
      special_use: 'floor',
      environment: 'exterior',
      base: 'water',
    });
    // Sólo las no restrictivas, en el orden del flujo: ambiente y después base.
    assert.deepEqual(relaxable, ['environment', 'base']);
  });
});

describe('nextStep — reglas del §13', () => {
  test('con 5 resultados o menos, muestra', () => {
    const step = nextStep({}, 5, RICH_FACETS, CONFIG);
    assert.deepEqual(step, { kind: 'show', reason: 'threshold' });
  });

  test('con 0 resultados, empty', () => {
    assert.deepEqual(nextStep({}, 0, RICH_FACETS, CONFIG), { kind: 'empty' });
  });

  test('con muchos resultados y nada respondido, pregunta la primera dimensión', () => {
    const step = nextStep({}, 2660, RICH_FACETS, CONFIG);
    assert.equal(step.kind, 'ask');
    assert.equal(step.kind === 'ask' && step.dimension.key, 'surface');
  });

  test('no repite una dimensión ya respondida', () => {
    const step = nextStep({ surface: 'wood' }, 500, RICH_FACETS, CONFIG);
    assert.equal(step.kind, 'ask');
    assert.notEqual(step.kind === 'ask' && step.dimension.key, 'surface');
  });

  test('OMITE la pregunta cuando la faceta tiene una sola opción posible', () => {
    // Sólo queda interior: preguntar el ambiente no discrimina nada.
    const facets: FacetCounts = {
      ...RICH_FACETS,
      advisor_environment: { interior: 120 },
    };
    const step = nextStep({ surface: 'wall', product_type: 'paint' }, 120, facets, {
      ...CONFIG,
      maxQuestions: 5,
    });
    assert.equal(step.kind, 'ask');
    assert.notEqual(step.kind === 'ask' && step.dimension.key, 'environment');
  });

  test('al llegar al tope de preguntas muestra igual', () => {
    const step = nextStep(
      { surface: 'wood', product_type: 'paint', environment: 'exterior' },
      400,
      RICH_FACETS,
      CONFIG,
    );
    assert.deepEqual(step, { kind: 'show', reason: 'max_questions' });
  });

  test('pintura artística corta el recorrido técnico (§11.2)', () => {
    const step = nextStep({ product_type: 'art_paint' }, 256, RICH_FACETS, CONFIG);
    assert.deepEqual(step, { kind: 'show', reason: 'short_circuit' });
  });

  test('accesorio y herramienta también cortan', () => {
    assert.equal(nextStep({ product_type: 'accessory' }, 600, RICH_FACETS, CONFIG).kind, 'show');
    assert.equal(nextStep({ product_type: 'tool' }, 170, RICH_FACETS, CONFIG).kind, 'show');
  });

  test('pintura NO corta: sigue preguntando', () => {
    assert.equal(nextStep({ product_type: 'paint' }, 1300, RICH_FACETS, CONFIG).kind, 'ask');
  });

  test('sin preguntas útiles restantes, muestra', () => {
    // Todas las dimensiones respondidas y aún muchos resultados.
    const answers: AdvisorAnswers = {
      surface: 'wood', product_type: 'paint', environment: 'exterior',
      special_use: 'none', base: 'water',
    };
    const step = nextStep(answers, 400, RICH_FACETS, { showThreshold: 5, maxQuestions: 99 });
    assert.deepEqual(step, { kind: 'show', reason: 'exhausted' });
  });

  test('la frase completa del §13 no genera ninguna pregunta', () => {
    // "Necesito una pintura al agua para madera exterior": 4 dimensiones resueltas.
    // Con el tope de 3 preguntas, se muestra directo.
    const answers: AdvisorAnswers = {
      product_type: 'paint', base: 'water', surface: 'wood', environment: 'exterior',
    };
    assert.equal(nextStep(answers, 40, RICH_FACETS, CONFIG).kind, 'show');
  });
});

describe('offerableOptions', () => {
  test('descarta las opciones sin productos detrás', () => {
    const facets: FacetCounts = { advisor_surface: { wood: 10, multi: 3 } };
    const surface = dimensionByKey('surface')!;
    const values = offerableOptions(surface, facets).map((o) => o.value);
    assert.ok(values.includes('wood'));
    assert.ok(values.includes('multi'));
    assert.ok(!values.includes('plastic'));
  });

  test('una opción se ofrece si CUALQUIERA de sus valores expandidos existe', () => {
    // Sólo hay multisuperficie: "Madera" igual se ofrece porque expande a multi.
    const facets: FacetCounts = { advisor_surface: { multi: 30 } };
    const surface = dimensionByKey('surface')!;
    const values = offerableOptions(surface, facets).map((o) => o.value);
    assert.ok(values.includes('wood'));
    assert.ok(values.includes('metal'));
  });

  test('sin datos de faceta ofrece todo (no corta por falta de datos)', () => {
    const surface = dimensionByKey('surface')!;
    assert.equal(offerableOptions(surface, {}).length, surface.options.length);
  });

  /**
   * La faceta PEDIDA Y VACÍA no es lo mismo que la ausente: significa que el
   * índice no tiene el atributo, así que preguntar por él es un callejón sin
   * salida garantizado. Es el caso de desdeelsur (DESDEELSUR-72, TC-011).
   */
  test('faceta pedida y VACÍA no ofrece ninguna opción que filtre', () => {
    const surface = dimensionByKey('surface')!;
    const offered = offerableOptions(surface, { advisor_surface: {} });
    assert.deepEqual(offered.filter((o) => o.expand.length > 0), []);
  });

  test('las opciones que no filtran se ofrecen siempre', () => {
    const environment = dimensionByKey('environment')!;
    const values = offerableOptions(environment, { advisor_environment: { interior: 5 } }).map(
      (o) => o.value,
    );
    assert.ok(values.includes('any'));
  });
});

describe('el índice sin atributos del asesor', () => {
  /**
   * 2.263 productos, las cinco facetas en cero: el caso medido en desdeelsur. Antes
   * se preguntaba igual y CUALQUIER respuesta devolvía "no encontré productos".
   */
  const EMPTY_FACETS: FacetCounts = {
    advisor_surface: {},
    advisor_product_type: {},
    advisor_environment: {},
    advisor_special_use: {},
    advisor_base: {},
  };

  test('no pregunta nada: muestra los productos que hay', () => {
    const step = nextStep({}, 2263, EMPTY_FACETS, CONFIG);
    assert.equal(step.kind, 'show');
  });

  test('tampoco asume respuestas implícitas', () => {
    assert.deepEqual(impliedAnswers({}, EMPTY_FACETS), {});
  });
});

describe('impliedAnswers', () => {
  test('asume la dimensión con una sola opción real', () => {
    const implied = impliedAnswers({}, { advisor_environment: { interior: 120 } });
    assert.equal(implied.environment, 'interior');
  });

  test('no asume nada cuando hay más de una opción', () => {
    const implied = impliedAnswers({}, { advisor_environment: { interior: 10, exterior: 10 } });
    assert.equal(implied.environment, undefined);
  });

  test('no pisa una respuesta existente', () => {
    const implied = impliedAnswers({ environment: 'exterior' }, { advisor_environment: { interior: 5 } });
    assert.equal(implied.environment, undefined);
  });
});

describe('pendingFacetFields', () => {
  test('pide facetas sólo de lo que falta', () => {
    assert.deepEqual(pendingFacetFields({ surface: 'wood' }), [
      'advisor_product_type',
      'advisor_environment',
      'advisor_special_use',
      'advisor_base',
    ]);
  });
});

describe('sanitizeExtractedFilters — el modelo no inventa filtros', () => {
  test('acepta los valores declarados', () => {
    const out = sanitizeExtractedFilters({ surface: 'wood', base: 'water', environment: 'exterior' });
    assert.deepEqual(out, { surface: 'wood', environment: 'exterior', base: 'water' });
  });

  test('descarta valores inventados', () => {
    const out = sanitizeExtractedFilters({ surface: 'ceramica', base: 'aceite' });
    assert.deepEqual(out, {});
  });

  test('descarta dimensiones inexistentes y tipos raros', () => {
    const out = sanitizeExtractedFilters({ color: 'rojo', surface: 42, base: null });
    assert.deepEqual(out, {});
  });

  test('tolera basura', () => {
    assert.deepEqual(sanitizeExtractedFilters(null), {});
    assert.deepEqual(sanitizeExtractedFilters('wood'), {});
  });
});

describe('ids de botón del asesor', () => {
  test('ida y vuelta', () => {
    const id = advisorButtonId('surface', 'wood');
    assert.equal(id, 'adv:surface:wood');
    assert.deepEqual(parseAdvisorButtonId(id), { dimension: 'surface', value: 'wood' });
  });

  test('null para ids que no son del asesor', () => {
    assert.equal(parseAdvisorButtonId('act:close'), null);
    assert.equal(parseAdvisorButtonId('variant_123'), null);
    assert.equal(parseAdvisorButtonId('adv:inventada:x'), null);
    assert.equal(parseAdvisorButtonId('adv:surface'), null);
  });

  test('los ids caben en el límite de WhatsApp (256 chars) y las etiquetas en 20', () => {
    for (const dimension of ADVISOR_FLOW) {
      for (const option of dimension.options) {
        assert.ok(
          advisorButtonId(dimension.key, option.value).length <= 256,
          `${dimension.key}:${option.value}`,
        );
        assert.ok(
          option.label.length <= 20,
          `etiqueta "${option.label}" (${option.label.length} chars) supera el limite de WhatsApp`,
        );
      }
    }
  });
});

describe('relajar no puede volver a preguntar lo mismo', () => {
  test('el valor neutro existe para las dimensiones relajables', () => {
    // Sin un valor neutro, relajar tendría que BORRAR la respuesta y el motor
    // preguntaría de nuevo lo que acaba de soltar: bucle infinito.
    assert.equal(neutralValue('base'), 'any');
    assert.equal(neutralValue('environment'), 'any');
  });

  test('con el neutro puesto, el motor NO vuelve a preguntar esa dimensión', () => {
    // Sin facetas de base (no se pidieron: estaba respondida al buscar), el motor
    // ofrecería las dos opciones si la viera sin responder.
    const facets: FacetCounts = { advisor_environment: { interior: 50, exterior: 50 } };
    const answers: AdvisorAnswers = { surface: 'wood', base: neutralValue('base')! };
    const step = nextStep(answers, 300, facets, { showThreshold: 5, maxQuestions: 5 });
    assert.equal(step.kind, 'ask');
    assert.notEqual(step.kind === 'ask' && step.dimension.key, 'base');
  });

  test('el neutro no filtra, así que el resultado relajado no se vuelve a acotar', () => {
    assert.equal(clauseFor('base', neutralValue('base')!), null);
  });
});

describe('resumen y conteo', () => {
  test('describeAnswers omite las respuestas que no filtran', () => {
    const text = describeAnswers({ surface: 'wood', environment: 'exterior', base: 'any' });
    assert.match(text, /madera/);
    assert.match(text, /exterior/);
    assert.doesNotMatch(text, /igual/);
  });

  test('answeredCount cuenta todas las respondidas, incluso "me da igual"', () => {
    assert.equal(answeredCount({ surface: 'wood', base: 'any' }), 2);
    assert.equal(answeredCount({}), 0);
  });
});
