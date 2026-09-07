import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ErpCategoryNode } from '../adapters/types.ts';
import {
  externalIdFor,
  isErpOwned,
  planCategoryTree,
  type ExistingCategory,
} from './plan-category-tree.ts';

const PROVIDER = 'zeus';

function node(overrides: Partial<ErpCategoryNode> & Pick<ErpCategoryNode, 'code' | 'name'>): ErpCategoryNode {
  return {
    parent_code: null,
    rank: 0,
    level: 0,
    image_url: null,
    ...overrides,
  };
}

/** Árbol de muestra con la forma real de Zeus: 3 niveles y un código hex-ish. */
const TREE: ErpCategoryNode[] = [
  node({ code: '02', name: 'PINTURA', rank: 0, level: 0 }),
  node({ code: '020B', name: 'ARTISTICA', parent_code: '02', rank: 1, level: 1 }),
  node({ code: '0201', name: 'INDUSTRIA Y NAUTICA', parent_code: '02', rank: 0, level: 1 }),
  node({ code: '020101', name: 'EPOXI', parent_code: '0201', rank: 0, level: 2 }),
  node({ code: '0A', name: 'COMPLEMENTOS', rank: 1, level: 0 }),
];

function existing(overrides: Partial<ExistingCategory> & Pick<ExistingCategory, 'id' | 'name'>): ExistingCategory {
  return {
    handle: overrides.name.toLowerCase(),
    external_id: null,
    parent_category_id: null,
    rank: 0,
    metadata: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Simula el applier: asigna ids a los creates, nivel por nivel. */
function materialize(nodes: ErpCategoryNode[]): ExistingCategory[] {
  const plan = planCategoryTree({ nodes, existing: [], provider: PROVIDER });
  const idByCode = new Map<string, string>();
  const out: ExistingCategory[] = [];
  let seq = 1;
  for (const bucket of plan.creates) {
    for (const create of bucket) {
      const id = `pcat_${seq++}`;
      idByCode.set(create.code, id);
      out.push({
        id,
        name: create.name,
        handle: create.handle,
        external_id: create.external_id,
        parent_category_id: create.parent_code ? (idByCode.get(create.parent_code) ?? null) : null,
        rank: create.rank,
        metadata: create.metadata,
        created_at: '2026-02-01T00:00:00Z',
      });
    }
  }
  return out;
}

describe('planCategoryTree', () => {
  it('sobre una base vacía crea el árbol completo, un bucket por nivel', () => {
    const plan = planCategoryTree({ nodes: TREE, existing: [], provider: PROVIDER });

    assert.equal(plan.creates.length, 3);
    assert.deepEqual(plan.creates[0]!.map((c) => c.code), ['02', '0A']);
    assert.deepEqual(plan.creates[1]!.map((c) => c.code), ['020B', '0201']);
    assert.deepEqual(plan.creates[2]!.map((c) => c.code), ['020101']);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unchanged, 0);
    assert.equal(plan.orphans.length, 0);
    assert.deepEqual(plan.warnings, []);
  });

  it('el external_id identifica la categoría y el handle lleva la ruta completa', () => {
    const plan = planCategoryTree({ nodes: TREE, existing: [], provider: PROVIDER });
    const epoxi = plan.creates[2]![0]!;

    assert.equal(epoxi.external_id, 'zeus:020101');
    // La ruta completa desambigua ramas: dos "EPOXI" en ramas distintas no chocan.
    assert.equal(epoxi.handle, 'pintura-industria-y-nautica-epoxi');
    assert.equal(epoxi.parent_code, '0201');
    assert.deepEqual(epoxi.metadata, {
      erp_source: 'zeus',
      erp_code: '020101',
      erp_level: 2,
      erp_rank: 0,
    });
  });

  it('guarda la imagen del ERP en metadata cuando viene', () => {
    const plan = planCategoryTree({
      nodes: [node({ code: '03', name: 'TEXTURADOS', image_url: 'https://cdn/03.jpg' })],
      existing: [],
      provider: PROVIDER,
    });
    assert.equal(plan.creates[0]![0]!.metadata.erp_image_url, 'https://cdn/03.jpg');
  });

  it('es idempotente: la segunda corrida no escribe nada', () => {
    const plan = planCategoryTree({
      nodes: TREE,
      existing: materialize(TREE),
      provider: PROVIDER,
    });

    assert.equal(plan.unchanged, TREE.length);
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.resolved.size, TREE.length);
  });

  it('un rename en el ERP actualiza el nombre pero NUNCA el handle', () => {
    const base = materialize(TREE);
    const renamed = TREE.map((n) => (n.code === '020B' ? { ...n, name: 'ARTISTICOS' } : n));
    const plan = planCategoryTree({ nodes: renamed, existing: base, provider: PROVIDER });

    assert.equal(plan.updates.length, 1);
    const update = plan.updates[0]!;
    assert.equal(update.code, '020B');
    // El nombre no vive en metadata, así que el rename es un cambio de un campo.
    assert.deepEqual(update.changed, ['name']);
    // Se propaga NORMALIZADO: el ERP manda mayúsculas sostenidas y eso se
    // muestra tal cual en el storefront.
    assert.equal(update.patch.name, 'Artísticos');
    assert.equal('handle' in update.patch, false);
  });

  it('normaliza el nombre de las categorías nuevas, sin tocar el handle', () => {
    const plan = planCategoryTree({
      nodes: [node({ code: '05', name: 'PISOS PVC Y CEMENTICIO' })],
      existing: [],
      provider: PROVIDER,
    });

    const create = plan.creates[0]![0]!;
    assert.equal(create.name, 'Pisos PVC y cementicio');
    // El handle sale del nombre crudo, que slugificado da lo mismo.
    assert.equal(create.handle, 'pisos-pvc-y-cementicio');
  });

  it('una corrección editorial del nombre sobrevive al sync', () => {
    // Caso real: el árbol de Zeus vino en mayúsculas y sin tildes, y los nombres
    // se corrigieron a mano en Medusa. El ERP sigue informando el original.
    const base = materialize(TREE).map((c) =>
      c.external_id === 'zeus:0201' ? { ...c, name: 'Industria y náutica' } : c
    );
    const plan = planCategoryTree({ nodes: TREE, existing: base, provider: PROVIDER });

    assert.equal(plan.updates.length, 0);
    assert.equal(plan.unchanged, TREE.length);
  });

  it('un nodo movido de padre emite el cambio de jerarquía con el código del padre', () => {
    const base = materialize(TREE);
    const moved = TREE.map((n) => (n.code === '020101' ? { ...n, parent_code: '020B' } : n));
    const plan = planCategoryTree({ nodes: moved, existing: base, provider: PROVIDER });

    const update = plan.updates.find((u) => u.code === '020101')!;
    assert.ok(update.changed.includes('parent_category_id'));
    assert.equal(update.parent_code, '020B');
    // El id lo resuelve el applier: el planner no lo pone en el patch.
    assert.equal('parent_category_id' in update.patch, false);
  });

  it('sin syncRank ignora el rank; con syncRank lo emite', () => {
    const base = materialize(TREE);
    const reordered = TREE.map((n) => (n.code === '0A' ? { ...n, rank: 5 } : n));

    const quiet = planCategoryTree({ nodes: reordered, existing: base, provider: PROVIDER });
    assert.equal(quiet.updates.filter((u) => u.changed.includes('rank')).length, 0);

    const ranked = planCategoryTree({
      nodes: reordered,
      existing: base,
      provider: PROVIDER,
      syncRank: true,
    });
    const update = ranked.updates.find((u) => u.code === '0A')!;
    assert.ok(update.changed.includes('rank'));
    assert.equal(update.patch.rank, 5);
  });

  it('desambigua el handle contra una categoría manual homónima', () => {
    const manual = existing({ id: 'pcat_manual', name: 'Pintura', handle: 'pintura' });
    const plan = planCategoryTree({ nodes: TREE, existing: [manual], provider: PROVIDER });

    const pintura = plan.creates[0]!.find((c) => c.code === '02')!;
    assert.equal(pintura.handle, 'pintura-2');
    // Y no la adopta: la categoría manual no es del ERP.
    assert.equal(plan.updates.length, 0);
  });

  it('con adoptByHandle adopta la categoría manual en vez de duplicarla', () => {
    const manual = existing({ id: 'pcat_manual', name: 'PINTURA', handle: 'pintura' });
    const plan = planCategoryTree({
      nodes: [TREE[0]!],
      existing: [manual],
      provider: PROVIDER,
      adoptByHandle: true,
    });

    assert.equal(plan.creates.length, 0);
    const update = plan.updates[0]!;
    assert.equal(update.id, 'pcat_manual');
    assert.equal(update.patch.external_id, 'zeus:02');
  });

  it('con external_id duplicado usa la más vieja y avisa', () => {
    const older = existing({
      id: 'pcat_old',
      name: 'PINTURA',
      handle: 'pintura',
      external_id: 'zeus:02',
      created_at: '2026-01-01T00:00:00Z',
      metadata: { erp_source: 'zeus', erp_code: '02', erp_level: 0, erp_rank: 0 },
    });
    const clone = existing({
      id: 'pcat_clone',
      name: 'PINTURA',
      handle: 'pintura-2',
      external_id: 'zeus:02',
      created_at: '2026-03-01T00:00:00Z',
    });

    const plan = planCategoryTree({ nodes: [TREE[0]!], existing: [older, clone], provider: PROVIDER });
    assert.equal(plan.resolved.get('02'), 'pcat_old');
    assert.equal(plan.warnings.length, 1);
    assert.match(plan.warnings[0]!, /pcat_clone/);
  });

  it('reporta como huérfanas las categorías del ERP que ya no vienen, sin borrarlas', () => {
    const base = materialize(TREE);
    const shrunk = TREE.filter((n) => n.code !== '0A');
    const plan = planCategoryTree({ nodes: shrunk, existing: base, provider: PROVIDER });

    assert.deepEqual(plan.orphans.map((o) => o.external_id), ['zeus:0A']);
    assert.equal(plan.updates.length, 0);
  });

  it('no toca categorías de otros providers ni las manuales', () => {
    const foreign = existing({
      id: 'pcat_bsale',
      name: 'OTRA',
      handle: 'otra',
      external_id: 'bsale:99',
    });
    const plan = planCategoryTree({ nodes: TREE, existing: [foreign], provider: PROVIDER });
    assert.equal(plan.orphans.length, 0);
    assert.equal(plan.updates.length, 0);
  });

  it('un padre que el ERP no informó degrada a raíz con warning', () => {
    const orphanNode = node({ code: '99', name: 'HUERFANA', parent_code: 'ZZ', level: 1 });
    const plan = planCategoryTree({ nodes: [orphanNode], existing: [], provider: PROVIDER });

    assert.equal(plan.creates[0]![0]!.parent_code, null);
    assert.match(plan.warnings[0]!, /cuelga de ZZ/);
  });

  it('árbol vacío es un no-op', () => {
    const plan = planCategoryTree({ nodes: [], existing: materialize(TREE), provider: PROVIDER });
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.updates.length, 0);
    assert.equal(plan.orphans.length, 0);
  });
});

describe('externalIdFor / isErpOwned', () => {
  it('arma y reconoce la identidad del provider', () => {
    assert.equal(externalIdFor('zeus', '020B'), 'zeus:020B');
    assert.equal(isErpOwned('zeus:020B', 'zeus'), true);
    assert.equal(isErpOwned('bsale:1', 'zeus'), false);
    assert.equal(isErpOwned(null, 'zeus'), false);
    assert.equal(isErpOwned(undefined, 'zeus'), false);
  });
});
