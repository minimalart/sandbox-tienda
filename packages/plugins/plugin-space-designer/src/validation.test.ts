import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ConfiguratorSchema,
  ConfigSchema,
  selectionErrors,
  selectionQuantities,
  SnapshotSchema,
} from './validation';
import type { SpaceConfigV1, SpaceSnapshot } from './types';

const room = {
  width: 8,
  depth: 6,
  height: 3,
  shape: 'rectangle' as const,
  floor_color: '#EEEEEE',
  wall_color: '#FFFFFF',
};
const config: SpaceConfigV1 = {
  version: 1,
  allow_custom: true,
  products: [
    {
      id: 'desk',
      product_id: 'prod_desk',
      variant_id: 'variant_desk',
      category: 'Muebles',
      placement: 'scene',
      dimensions: { width: 2, depth: 1, height: 0.75 },
    },
    {
      id: 'robot',
      product_id: 'prod_kit',
      variant_id: 'variant_kit',
      category: 'Robótica',
      placement: 'included',
    },
  ],
  templates: [
    {
      id: 'maker',
      name: 'Aula equipada',
      room,
      objects: [{ id: 'desk_1', product_ref: 'desk', x: 2, z: 2, rotation: 0, locked: true }],
      included_items: [{ product_ref: 'robot', quantity: 12 }],
    },
  ],
};
const snapshot = (): SpaceSnapshot => structuredClone({ version: 1, ...config.templates[0]! });

test('predefined classrooms retain their furniture and non-furniture products without assembly', () => {
  assert.equal(ConfigSchema.safeParse(config).success, true);
  assert.deepEqual(selectionErrors(config, snapshot(), 'maker'), []);
  assert.deepEqual(
    [...selectionQuantities(config, snapshot())],
    [
      ['variant_desk', 1],
      ['variant_kit', 12],
    ]
  );
});
test('publication rejects templates without preassembled furniture, while empty drafts are editable', () => {
  const input = { slug: 'aula-maker', title: 'Aula Maker', config: { ...config, templates: [] } };
  assert.equal(ConfiguratorSchema.safeParse({ ...input, status: 'draft' }).success, true);
  assert.equal(ConfiguratorSchema.safeParse({ ...input, status: 'published' }).success, false);
  assert.equal(
    ConfiguratorSchema.safeParse({
      ...input,
      status: 'published',
      config: { ...config, templates: [{ ...config.templates[0], objects: [] }] },
    }).success,
    false
  );
});
test('included products cannot silently become furniture or unknown billable products', () => {
  const edited = snapshot();
  edited.objects[0]!.product_ref = 'robot';
  edited.included_items.push({ product_ref: 'unknown', quantity: 1 });
  assert.equal(selectionErrors(config, edited).length, 2);
});
test('rotated footprint and height must fit inside the room', () => {
  const edited = snapshot();
  edited.objects[0] = { ...edited.objects[0]!, x: 0.7, z: 0.7, rotation: 90 };
  assert.match(selectionErrors(config, edited).join(' '), /fuera del espacio/);
  edited.objects[0] = { ...edited.objects[0]!, x: 4, z: 3, rotation: 45 };
  assert.match(selectionErrors(config, edited).join(' '), /rotación/);
});
test('published templates reject repeated refs and require scene dimensions', () => {
  const repeated = structuredClone(config);
  repeated.products.push(repeated.products[0]!);
  assert.equal(ConfigSchema.safeParse(repeated).success, false);
  const missing = structuredClone(config);
  delete missing.products[0]!.dimensions;
  assert.equal(ConfigSchema.safeParse(missing).success, false);
});
test('template-only mode rejects changed quantities and omitted template identity', () => {
  const fixed = { ...config, allow_custom: false };
  assert.deepEqual(selectionErrors(fixed, snapshot(), 'maker'), []);
  assert.ok(selectionErrors(fixed, snapshot()).length);
  const edited = snapshot();
  edited.included_items[0]!.quantity = 13;
  assert.match(selectionErrors(fixed, edited, 'maker').join(' '), /únicamente/);
});

test('template-only mode survives the key order used by PostgreSQL jsonb', () => {
  const reorder = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reorder);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, reorder(child)])
      );
    return value;
  };
  const stored = reorder({ ...config, allow_custom: false }) as SpaceConfigV1;
  const request = SnapshotSchema.parse(snapshot());
  assert.deepEqual(selectionErrors(stored, request, 'maker'), []);
});
test('locked furniture cannot be moved or removed when editing a template', () => {
  const moved = snapshot();
  moved.objects[0]!.x = 3;
  assert.match(selectionErrors(config, moved, 'maker').join(' '), /fijo/);
  const removed = snapshot();
  removed.objects = [];
  assert.match(selectionErrors(config, removed, 'maker').join(' '), /fijo/);
});
test('quantities are finite bounded integers and duplicate included rows are rejected', () => {
  for (const quantity of [0, -1, 1.5, 1000, Infinity]) {
    const edited = snapshot();
    edited.included_items[0]!.quantity = quantity;
    assert.equal(SnapshotSchema.safeParse(edited).success, false);
  }
  const duplicate = snapshot();
  duplicate.included_items.push({ product_ref: 'robot', quantity: 1 });
  assert.match(selectionErrors(config, duplicate).join(' '), /repetido/);
});
test('an untrusted payload cannot add a custom price to configuration or saved selections', () => {
  const parsed = SnapshotSchema.parse({ ...snapshot(), unit_price: 1 });
  assert.equal('unit_price' in parsed, false);
  const unsafeAsset = structuredClone(config);
  unsafeAsset.products[0]!.asset = { kind: 'image', url: 'javascript:alert(1)' };
  assert.equal(ConfigSchema.safeParse(unsafeAsset).success, false);
});

test('3D equipment anchors reference actual scene products and never duplicate billed units', () => {
  const configured = structuredClone(config);
  configured.products[1]!.asset = {
    kind: 'primitive',
    model: 'robotics-kit',
    mount: 'surface',
    anchor_product_ref: 'desk',
    color: '#F4BD43',
    accent_color: '#3C77A0',
  };
  configured.products[1]!.dimensions = { width: 0.24, depth: 0.18, height: 0.09 };
  const parsed = ConfigSchema.parse(configured);
  assert.equal(parsed.products[1]!.asset?.model, 'robotics-kit');
  assert.equal(parsed.products[1]!.asset?.anchor_product_ref, 'desk');
  assert.deepEqual(
    [...selectionQuantities(parsed, snapshot())],
    [
      ['variant_desk', 1],
      ['variant_kit', 12],
    ]
  );
  for (const anchor of ['missing', 'robot']) {
    configured.products[1]!.asset!.anchor_product_ref = anchor;
    assert.equal(ConfigSchema.safeParse(configured).success, false);
  }
  configured.products[0]!.asset = { kind: 'primitive', model: 'desk', anchor_product_ref: 'desk' };
  assert.equal(ConfigSchema.safeParse(configured).success, false);
});

test('textured rooms survive parsing and fixed templates reject altered textures', () => {
  const configured = structuredClone(config);
  configured.allow_custom = false;
  configured.templates[0]!.room = {
    ...room,
    floor_texture_url: '/textures/floor.png',
    wall_texture_url: 'https://assets.example.test/wall.png',
  };
  configured.surface_options = {
    floors: [{ label: 'Madera', color: '#FFFFFF', texture_url: '/textures/floor.png' }],
  };
  const parsed = ConfigSchema.parse(configured);
  const request = SnapshotSchema.parse({ version: 1, ...parsed.templates[0]! });
  assert.equal(request.room.floor_texture_url, '/textures/floor.png');
  assert.equal(parsed.surface_options?.floors?.[0]?.texture_url, '/textures/floor.png');
  assert.deepEqual(selectionErrors(parsed, request, 'maker'), []);
  for (const field of ['floor_texture_url', 'wall_texture_url'] as const) {
    const changed = structuredClone(request);
    changed.room[field] = '/textures/different.png';
    assert.match(selectionErrors(parsed, changed, 'maker').join(' '), /únicamente/);
  }
  request.room.floor_texture_url = 'javascript:alert(1)';
  assert.equal(SnapshotSchema.safeParse(request).success, false);
});

test('GLB sources are validated while model, mount and secondary color persist', () => {
  const configured = structuredClone(config);
  configured.products[0]!.asset = {
    kind: 'glb',
    url: 'https://assets.example.test/desk.glb',
    model: 'desk',
    mount: 'floor',
    accent_color: '#123456',
  };
  const parsed = ConfigSchema.parse(configured);
  assert.deepEqual(parsed.products[0]!.asset, configured.products[0]!.asset);
  delete configured.products[0]!.asset!.url;
  assert.equal(ConfigSchema.safeParse(configured).success, false);
});
