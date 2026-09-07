import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { SpaceProduct, SpaceSnapshot } from '../../../lib/space-designer/types';
import { includedPlacements, threeRotation, type SupportSurfaces } from './placement.ts';
import { disposeObject, fitCamera, normaliseModel } from './scene-utils.ts';

const table: SpaceProduct = {
  id: 'table',
  product_id: 'p1',
  variant_id: 'v1',
  placement: 'scene',
  category: 'Muebles',
  dimensions: { width: 2, depth: 2, height: 0.95 },
  asset: { kind: 'primitive', model: 'hex-table-set' },
};
const computer: SpaceProduct = {
  id: 'pc',
  product_id: 'p2',
  variant_id: 'v2',
  placement: 'included',
  category: 'Computación',
  dimensions: { width: 0.32, depth: 0.22, height: 0.28 },
  asset: { kind: 'primitive', model: 'computer', mount: 'surface', anchor_product_ref: 'table' },
};
const projector: SpaceProduct = {
  id: 'projector',
  product_id: 'p3',
  variant_id: 'v3',
  placement: 'included',
  category: 'Equipamiento',
  dimensions: { width: 0.3, depth: 0.3, height: 0.16 },
  asset: { kind: 'primitive', model: 'projector', mount: 'ceiling' },
};
const snapshot: SpaceSnapshot = {
  version: 1,
  room: {
    width: 8,
    depth: 6,
    height: 3.2,
    shape: 'rectangle',
    floor_color: '#ffffff',
    wall_color: '#ffffff',
  },
  objects: [{ id: 'table1', product_ref: 'table', x: 2, z: 3, rotation: 90, scale: 1.5 }],
  included_items: [
    { product_ref: 'pc', quantity: 6 },
    { product_ref: 'projector', quantity: 1 },
  ],
};

test('included quantities become 3D instances without modifying scene/cart quantities', () => {
  const before = JSON.stringify(snapshot);
  const result = includedPlacements(snapshot, [table, computer, projector]);
  assert.equal(result.length, 7);
  assert.equal(new Set(result.map((entry) => entry.id)).size, 7);
  assert.equal(result.filter((entry) => entry.product_ref === 'pc').length, 6);
  assert.equal(JSON.stringify(snapshot), before);
  const hanging = result.find((entry) => entry.product_ref === 'projector')!;
  assert.ok(Math.abs(hanging.y - (3.2 - 0.16 - 0.16)) < 0.00001);
});

test('equipment follows the real tabletop height, offset, scale and clockwise anchor rotation', () => {
  const surfaces: SupportSurfaces = new Map([
    ['table', [{ height: 0.72, width: 0.4, depth: 0.3, x: 0.2, z: -0.1, rotation: 30 }]],
  ]);
  const result = includedPlacements(
    { ...snapshot, included_items: [{ product_ref: 'pc', quantity: 1 }] },
    [table, computer],
    surfaces
  )[0]!;
  assert.ok(Math.abs(result.y - 1.085) < 0.00001);
  assert.ok(Math.abs(result.x - 2.15) < 0.00001);
  assert.ok(Math.abs(result.z - 3.3) < 0.00001);
  assert.equal(result.rotation, 120);
  assert.equal(threeRotation(90), -Math.PI / 2);
});

test('individual hexagonal table supports keep every computer on a separate tabletop', () => {
  const supports = Array.from({ length: 6 }, (_, index) => ({
    height: 0.72,
    width: 0.4,
    depth: 0.3,
    x: Math.cos((index * Math.PI) / 3) * 0.55,
    z: Math.sin((index * Math.PI) / 3) * 0.55,
    rotation: index * 60,
  }));
  const result = includedPlacements(
    snapshot,
    [table, computer, projector],
    new Map([['table', supports]])
  );
  const computers = result.filter((entry) => entry.product_ref === 'pc');
  assert.equal(new Set(computers.map((entry) => `${entry.x},${entry.z}`)).size, 6);
  assert.ok(computers.every((entry) => Math.abs(entry.y - 1.085) < 0.00001));
});

test('GLB normalization centres translated geometry, grounds it and uses declared dimensions', () => {
  const source = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 1), new THREE.MeshStandardMaterial());
  mesh.position.set(10, 6, -3);
  source.add(mesh);
  const normalized = normaliseModel(source, { width: 1.4, height: 0.8, depth: 0.7 });
  const box = new THREE.Box3().setFromObject(normalized);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  assert.ok(
    Math.abs(size.x - 1.4) < 0.00001 &&
      Math.abs(size.y - 0.8) < 0.00001 &&
      Math.abs(size.z - 0.7) < 0.00001
  );
  assert.ok(
    Math.abs(box.min.y) < 0.00001 && Math.abs(centre.x) < 0.00001 && Math.abs(centre.z) < 0.00001
  );
  disposeObject(normalized);
});

test('camera framing includes the entire room on mobile, desktop and top view', () => {
  for (const aspect of [0.55, 1.2, 2])
    for (const top of [false, true]) {
      const camera = new THREE.PerspectiveCamera(40, aspect, 0.05, 500);
      fitCamera(camera, new THREE.Vector3(), snapshot.room, top);
      camera.updateMatrixWorld();
      for (const x of [0, 8])
        for (const y of [0, 3.2])
          for (const z of [0, 6]) {
            const projected = new THREE.Vector3(x, y, z).project(camera);
            assert.ok(
              Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && Math.abs(projected.z) < 1,
              `${aspect}/${top}: ${projected.toArray()}`
            );
          }
    }
});

test('shared cloned resources are disposed only once', () => {
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  const texture = new THREE.Texture();
  material.map = texture;
  let geometryCalls = 0;
  let materialCalls = 0;
  let textureCalls = 0;
  geometry.dispose = () => {
    geometryCalls++;
  };
  material.dispose = () => {
    materialCalls++;
  };
  texture.dispose = () => {
    textureCalls++;
  };
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  disposeObject(group);
  assert.deepEqual([geometryCalls, materialCalls, textureCalls], [1, 1, 1]);
});
