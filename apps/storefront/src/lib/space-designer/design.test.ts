import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fitObject,
  objectFootprint,
  readSavedDesign,
  resizeRoom,
  snapshotFromTemplate,
  summarizeDesign,
} from './design';
import type { SpacePublicConfigurator } from './types';

const room = {
  width: 6,
  depth: 4,
  height: 3,
  shape: 'rectangle' as const,
  floor_color: '#ede9dc',
  wall_color: '#ffffff',
};
const configurator: SpacePublicConfigurator = {
  id: 'config-office',
  title: 'Diseñá tu oficina',
  slug: 'oficina',
  status: 'published',
  sales_channel_id: 'channel-office',
  config: {
    version: 1,
    allow_custom: true,
    products: [
      {
        id: 'desk',
        product_id: 'prod-desk',
        variant_id: 'var-desk-oak',
        placement: 'scene',
        category: 'Mesas',
        dimensions: { width: 2, depth: 1, height: 0.8 },
        allowed_rotations: [0, 90],
      },
      {
        id: 'computer',
        product_id: 'prod-computer',
        variant_id: 'var-computer',
        placement: 'included',
        category: 'Tecnología',
      },
      {
        id: 'desk-white',
        product_id: 'prod-desk',
        variant_id: 'var-desk-white',
        placement: 'scene',
        category: 'Mesas',
        dimensions: { width: 2, depth: 1, height: 0.8 },
      },
    ],
    templates: [
      {
        id: 'office-6',
        name: 'Oficina equipada',
        room,
        objects: [
          { id: 'desk-1', product_ref: 'desk', x: 1, z: 1, rotation: 0 },
          { id: 'desk-2', product_ref: 'desk', x: 4, z: 1, rotation: 0 },
        ],
        included_items: [{ product_ref: 'computer', quantity: 2 }],
      },
    ],
  },
  catalog: [
    {
      id: 'prod-desk',
      title: 'Escritorio',
      handle: 'escritorio',
      thumbnail: null,
      variants: [
        {
          id: 'var-desk-oak',
          title: 'Roble',
          sku: null,
          calculated_amount: 100,
          currency_code: 'ars',
          available: true,
        },
        {
          id: 'var-desk-white',
          title: 'Blanco',
          sku: null,
          calculated_amount: 150,
          currency_code: 'ars',
          available: true,
        },
      ],
    },
    {
      id: 'prod-computer',
      title: 'Computadora',
      handle: 'computadora',
      thumbnail: null,
      variants: [
        {
          id: 'var-computer',
          title: 'Única',
          sku: null,
          calculated_amount: 400,
          currency_code: 'ars',
          available: true,
        },
      ],
    },
  ],
};

test('a predefined space opens with its furniture and non-spatial equipment already populated', () => {
  const template = configurator.config.templates[0]!;
  const snapshot = snapshotFromTemplate(template);
  assert.equal(snapshot.objects.length, 2);
  assert.deepEqual(snapshot.included_items, [{ product_ref: 'computer', quantity: 2 }]);
  snapshot.objects[0]!.x = 3;
  snapshot.included_items[0]!.quantity = 4;
  assert.equal(template.objects[0]!.x, 1);
  assert.equal(template.included_items[0]!.quantity, 2);
});

test('summary counts scene and included items, retaining distinct variants of the same product', () => {
  const snapshot = snapshotFromTemplate(configurator.config.templates[0]!);
  snapshot.objects.push({ id: 'desk-3', product_ref: 'desk-white', x: 3, z: 3, rotation: 0 });
  const summary = summarizeDesign(snapshot, configurator);
  assert.deepEqual(
    summary.map((item) => [item.variant?.id, item.quantity]),
    [
      ['var-desk-oak', 2],
      ['var-desk-white', 1],
      ['var-computer', 2],
    ]
  );
  assert.equal(
    summary.reduce((sum, item) => sum + (item.variant?.calculated_amount ?? 0) * item.quantity, 0),
    1150
  );
  const missing = summarizeDesign(snapshot, {
    ...configurator,
    catalog: configurator.catalog.slice(0, 1),
  });
  assert.equal(missing.find((item) => item.ref === 'computer')?.variant, undefined);
  assert.equal(missing.find((item) => item.ref === 'computer')?.quantity, 2);
});

test('rotated objects remain fully inside the room, and oversized objects are refused', () => {
  const product = configurator.config.products[0]!;
  const moved = fitObject(
    { id: 'a', product_ref: 'desk', x: -10, z: 20, rotation: 90 },
    product,
    room
  )!;
  assert.equal(moved.x, 0.5);
  assert.equal(moved.z, 3);
  const footprint = objectFootprint(product, 45);
  assert.ok(Math.abs(footprint.width - 3 / Math.sqrt(2)) < 0.0001);
  assert.equal(fitObject({ ...moved, scale: 10 }, product, room), null);
});

test('room resize clamps movable furniture but refuses to move locked furniture', () => {
  const snapshot = snapshotFromTemplate(configurator.config.templates[0]!);
  const resized = resizeRoom(snapshot, configurator.config.products, { ...room, width: 4 });
  assert.equal(resized?.objects[1]?.x, 3);
  snapshot.objects[1]!.locked = true;
  assert.equal(resizeRoom(snapshot, configurator.config.products, { ...room, width: 4 }), null);
  assert.equal(resizeRoom(snapshot, configurator.config.products, { ...room, height: NaN }), null);
});

test('saved designs reject stale references, invalid geometry, tampered locks and disabled customisation', () => {
  const snapshot = snapshotFromTemplate(configurator.config.templates[0]!);
  const saved = {
    configurator_id: configurator.id,
    template_id: 'office-6',
    saved_at: new Date().toISOString(),
    snapshot,
  };
  assert.ok(readSavedDesign(JSON.stringify(saved), configurator));
  assert.equal(
    readSavedDesign(JSON.stringify({ ...saved, configurator_id: 'other' }), configurator),
    null
  );
  assert.equal(
    readSavedDesign(
      JSON.stringify({
        ...saved,
        snapshot: { ...snapshot, included_items: [{ product_ref: 'unlisted', quantity: 1 }] },
      }),
      configurator
    ),
    null
  );
  assert.equal(
    readSavedDesign(
      JSON.stringify({
        ...saved,
        snapshot: { ...snapshot, objects: [{ ...snapshot.objects[0], x: -1 }] },
      }),
      configurator
    ),
    null
  );
  const modified = { ...snapshot, included_items: [{ product_ref: 'computer', quantity: 3 }] };
  assert.equal(
    readSavedDesign(JSON.stringify({ ...saved, snapshot: modified }), {
      ...configurator,
      config: { ...configurator.config, allow_custom: false },
    }),
    null
  );
  const lockedConfig = structuredClone(configurator);
  lockedConfig.config.templates[0]!.objects[0]!.locked = true;
  assert.equal(readSavedDesign(JSON.stringify(saved), lockedConfig), null);
});
