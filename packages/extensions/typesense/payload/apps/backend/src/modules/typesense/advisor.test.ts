import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyProduct,
  normalizeAdvisorRules,
  foldText,
  type AdvisorRules,
} from './advisor';
import { PAINT_ADVISOR_RULES } from '../../lib/whatsapp/advisor/vocabulary';

/**
 * Los casos son productos REALES del catálogo de la pinturería (medidos contra
 * el índice el 2026-08-03), no inventados: si una regla deja de matchear, este
 * test lo dice antes de que el flujo guiado devuelva cero resultados en vivo.
 */

const RULES = normalizeAdvisorRules(PAINT_ADVISOR_RULES) as AdvisorRules;

/** Producto mínimo con la forma que le llega al mapper. */
function product(opts: {
  title?: string;
  codes?: string[];
  family?: string;
  metadata?: Record<string, unknown>;
}): Record<string, any> {
  return {
    title: opts.title ?? '',
    categories: (opts.codes ?? []).map((code) => ({
      id: `pcat_${code}`,
      name: code,
      external_id: `zeus:${code}`,
    })),
    metadata: {
      ...(opts.family ? { family: opts.family } : {}),
      ...(opts.metadata ?? {}),
    },
  };
}

const sorted = (values: string[] | undefined): string[] => [...(values ?? [])].sort();

describe('normalizeAdvisorRules', () => {
  test('el vocabulario de pinturería normaliza sin perder reglas', () => {
    assert.ok(RULES, 'las reglas de pinturería deberían normalizar');
    assert.equal(RULES.category_external_id_prefix, 'zeus:');
    assert.equal(RULES.unknown_value, 'unknown');
    // Las 10 raíces del árbol Zeus + los nodos de Pintura declarados.
    assert.ok(Object.keys(RULES.by_category_code).length >= 20);
    assert.deepEqual(sorted(RULES.fill_unknown), ['base', 'environment', 'product_type', 'surface']);
  });

  test('devuelve null cuando no hay nada aprovechable', () => {
    assert.equal(normalizeAdvisorRules(null), null);
    assert.equal(normalizeAdvisorRules({}), null);
    assert.equal(normalizeAdvisorRules({ by_category_code: {}, by_family: {} }), null);
  });

  test('tolera valores en texto separados por coma', () => {
    const rules = normalizeAdvisorRules({
      by_category_code: { '0209': { surface: 'wall, multi', environment: 'interior' } },
    });
    assert.deepEqual(rules?.by_category_code['0209'], {
      surface: ['wall', 'multi'],
      environment: ['interior'],
    });
  });
});

describe('classifyProduct — sin reglas', () => {
  test('devuelve null para que el documento no lleve los campos', () => {
    assert.equal(classifyProduct(product({ title: 'Albalatex' }), null), null);
  });
});

describe('classifyProduct — categorías del árbol Zeus', () => {
  const cases: Array<{
    name: string;
    codes: string[];
    surface?: string[];
    product_type?: string[];
    environment?: string[];
    special_use?: string[];
  }> = [
    { name: '0209 Paredes interior', codes: ['0209'], surface: ['wall'], product_type: ['paint'], environment: ['interior'] },
    { name: '0205 Paredes exterior', codes: ['0205'], surface: ['wall'], product_type: ['paint'], environment: ['exterior'] },
    { name: '020A Cielorraso', codes: ['020A'], surface: ['wall'], product_type: ['paint'], environment: ['interior'] },
    { name: '0204 Techos', codes: ['0204'], surface: ['wall'], product_type: ['paint'], environment: ['exterior'] },
    { name: '0208 Perfilería metal - madera', codes: ['0208'], surface: ['metal', 'wood'], product_type: ['paint'] },
    { name: '0203 Lacas y barnices', codes: ['0203'], surface: ['wood'], product_type: ['paint'] },
    { name: '0206 Piletas', codes: ['0206'], surface: ['wall'], product_type: ['paint'], environment: ['exterior'], special_use: ['pool'] },
    { name: '0207 Pisos', codes: ['0207'], surface: ['wall', 'wood'], product_type: ['paint'], special_use: ['floor'] },
    { name: '020C Aerosoles', codes: ['020C'], surface: ['multi'], product_type: ['paint'] },
    { name: '020B Artística', codes: ['020B'], product_type: ['art_paint'], environment: ['interior'] },
    { name: '01 Accesorios', codes: ['01'], product_type: ['accessory'] },
    { name: '07 Herramientas', codes: ['07'], product_type: ['tool'] },
    { name: '04 Diluyentes', codes: ['04'], product_type: ['prep'] },
    { name: '03 Texturados', codes: ['03'], surface: ['wall'], product_type: ['paint'], environment: ['interior', 'exterior'] },
    { name: '05 Pisos PVC y cementicio', codes: ['05'], product_type: ['prep'], special_use: ['floor'] },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const out = classifyProduct(product({ codes: c.codes }), RULES)!;
      if (c.surface) assert.deepEqual(sorted(out.advisor_surface), sorted(c.surface));
      if (c.product_type) assert.deepEqual(sorted(out.advisor_product_type), sorted(c.product_type));
      if (c.environment) assert.deepEqual(sorted(out.advisor_environment), sorted(c.environment));
      // `special_use` vacío significa "sin uso especial": nunca lleva `unknown`.
      assert.deepEqual(sorted(out.advisor_special_use), sorted(c.special_use ?? []));
    });
  }

  test('un código hijo sin regla propia hereda del ancestro por prefijo', () => {
    // 020101 Epoxi cuelga de 0201 Industria y náutica.
    const out = classifyProduct(product({ codes: ['020101'] }), RULES)!;
    assert.deepEqual(out.advisor_surface, ['metal']);
    assert.deepEqual(out.advisor_product_type, ['paint']);
    assert.deepEqual(out.advisor_base, ['solvent']);
  });

  test('un código desconocido cae a unknown, no revienta', () => {
    const out = classifyProduct(product({ codes: ['ZZ99'] }), RULES)!;
    assert.deepEqual(out.advisor_surface, ['unknown']);
    assert.deepEqual(out.advisor_product_type, ['unknown']);
    assert.deepEqual(out.advisor_special_use, []);
  });

  test('categorías MÚLTIPLES acumulan: interior y exterior a la vez (§11.3)', () => {
    const out = classifyProduct(product({ codes: ['0209', '0205'] }), RULES)!;
    assert.deepEqual(sorted(out.advisor_environment), ['exterior', 'interior']);
    assert.deepEqual(out.advisor_surface, ['wall']);
  });

  test('metadata.erp_category_code alcanza cuando la categoría no trae external_id', () => {
    const out = classifyProduct(
      { title: '', categories: [], metadata: { erp_category_code: '0209' } },
      RULES,
    )!;
    assert.deepEqual(out.advisor_surface, ['wall']);
    assert.deepEqual(out.advisor_environment, ['interior']);
  });
});

describe('classifyProduct — base agua/solvente', () => {
  test('látex del título → agua (producto real: Albalatex design mate interior)', () => {
    const out = classifyProduct(
      product({ title: 'Albalatex design mate interior blanco x20 l', codes: ['0209'] }),
      RULES,
    )!;
    assert.deepEqual(out.advisor_base, ['water']);
  });

  test('la tilde no importa: Látex matchea igual que latex', () => {
    const out = classifyProduct(product({ title: 'Baños y cocinas Látex antihongo blanco mate x4 l', codes: ['0209'] }), RULES)!;
    assert.deepEqual(out.advisor_base, ['water']);
  });

  test('convertidor de óxido → solvente (producto real)', () => {
    const out = classifyProduct(product({ title: 'Convertidor de óxido gris x1 l', codes: ['0208'] }), RULES)!;
    assert.deepEqual(out.advisor_base, ['solvent']);
  });

  test('la familia PINTURA A LA TIZA aporta agua sin tocar el título', () => {
    const out = classifyProduct(product({ title: 'Sin pistas', family: 'PINTURA A LA TIZA' }), RULES)!;
    assert.deepEqual(out.advisor_base, ['water']);
  });

  test('la familia matchea por PREFIJO: las cuatro TEXTURADO * son agua', () => {
    for (const family of ['TEXTURADO MARBLE', 'TEXTURADO REVEX', 'TEXTURADO STONE', 'TEXTURADO REVOQUE PLASTICO']) {
      const out = classifyProduct(product({ title: 'x', family }), RULES)!;
      assert.deepEqual(out.advisor_base, ['water'], `familia ${family}`);
    }
  });

  test('sin ninguna pista, base queda unknown (no se excluye al producto)', () => {
    const out = classifyProduct(product({ title: 'Producto raro', codes: ['0208'] }), RULES)!;
    assert.deepEqual(out.advisor_base, ['unknown']);
  });
});

describe('classifyProduct — precedencia', () => {
  test('la categoría gana sobre la familia en la misma dimensión', () => {
    // 020C Aerosoles dice solvente; si la familia dijera agua, gana la categoría.
    const out = classifyProduct(
      product({ title: 'Aerosol', codes: ['020C'], family: 'PINTURA A LA TIZA' }),
      RULES,
    )!;
    assert.deepEqual(out.advisor_base, ['solvent']);
  });

  test('la categoría gana sobre el título en la misma dimensión', () => {
    // 0209 dice interior; el título dice exterior. Manda la categoría.
    const out = classifyProduct(
      product({ title: 'Latex exterior blanco', codes: ['0209'] }),
      RULES,
    )!;
    assert.deepEqual(out.advisor_environment, ['interior']);
  });

  test('el título aporta la dimensión que la categoría NO define', () => {
    // 0208 no define ambiente; "exterior" del título sí.
    const out = classifyProduct(
      product({ title: 'Esmalte sintetico exterior negro', codes: ['0208'] }),
      RULES,
    )!;
    assert.deepEqual(out.advisor_environment, ['exterior']);
    assert.deepEqual(sorted(out.advisor_surface), ['metal', 'wood']);
  });

  test('metadata.advisor_* PISA todo (corrección manual por producto)', () => {
    const out = classifyProduct(
      product({
        title: 'Albalatex interior',
        codes: ['0209'],
        metadata: { advisor_surface: ['plastic'], advisor_base: ['solvent'] },
      }),
      RULES,
    )!;
    assert.deepEqual(out.advisor_surface, ['plastic']);
    assert.deepEqual(out.advisor_base, ['solvent']);
    // Las dimensiones sin override siguen saliendo de la categoría.
    assert.deepEqual(out.advisor_environment, ['interior']);
  });

  test('un override VACÍO es autoritativo: no cae a las reglas', () => {
    // Una lija no tiene base agua/solvente: el merchant lo dice con un array
    // vacío. Si cayera a las reglas, la categoría/título le pondrían una base
    // inventada, o el `fill_unknown` la marcaría como "no sé" cuando en realidad
    // es "no aplica".
    const out = classifyProduct(
      product({
        title: 'Lija al agua N.º 100',
        codes: ['0207'],
        metadata: { advisor_base: [], advisor_special_use: [] },
      }),
      RULES,
    )!;
    assert.deepEqual(out.advisor_base, [], 'base explícitamente vacía');
    // 0207 Pisos pondría special_use=floor; el merchant dijo que no.
    assert.deepEqual(out.advisor_special_use, []);
    // Las dimensiones SIN override siguen saliendo de la categoría.
    assert.deepEqual(sorted(out.advisor_surface), ['wall', 'wood']);
  });

  test('sin la clave en metadata, las reglas siguen aplicando', () => {
    // Contraste del test anterior: la ausencia de clave NO es un override.
    const out = classifyProduct(product({ codes: ['0207'] }), RULES)!;
    assert.deepEqual(out.advisor_special_use, ['floor']);
  });

  test('el override acepta texto separado por coma', () => {
    const out = classifyProduct(
      product({ codes: ['0209'], metadata: { advisor_surface: 'metal, wood' } }),
      RULES,
    )!;
    assert.deepEqual(sorted(out.advisor_surface), ['metal', 'wood']);
  });
});

describe('foldText', () => {
  test('saca tildes y baja a minúsculas', () => {
    assert.equal(foldText('Látex ACRÍLICO Ébano'), 'latex acrilico ebano');
  });
});
