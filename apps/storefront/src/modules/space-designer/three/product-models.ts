import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SpaceProduct } from '@lib/space-designer/types';

type Point = readonly [number, number, number];
type PlanPoint = readonly [number, number];
type ModelName = NonNullable<NonNullable<SpaceProduct['asset']>['model']>;

const DEFAULT_DIMENSIONS: Record<ModelName, { width: number; depth: number; height: number }> = {
  table: { width: 0.8, depth: 1.05, height: 0.82 },
  desk: { width: 1.4, depth: 1.15, height: 0.95 },
  'hex-table-set': { width: 2.8, depth: 2.6, height: 0.82 },
  shelving: { width: 1, depth: 0.4, height: 1.7 },
  cabinet: { width: 0.95, depth: 0.45, height: 1.15 },
  chair: { width: 0.46, depth: 0.5, height: 0.82 },
  computer: { width: 0.57, depth: 0.43, height: 0.43 },
  projector: { width: 0.36, depth: 0.29, height: 0.13 },
  'robotics-kit': { width: 0.43, depth: 0.32, height: 0.12 },
};

/** Each call owns its resources; there are no global materials to invalidate on disposal. */
function modelTools(color: string, accent: string) {
  const geometryCache = new Map<string, THREE.BufferGeometry>();
  const material = (value: string, roughness = 0.65, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color: value, roughness, metalness });
  const tones = {
    body: material(color),
    edge: material(new THREE.Color(color).multiplyScalar(0.77).getStyle()),
    accent: material(accent, 0.48),
    accentLight: material(
      new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.38).getStyle()
    ),
    metal: material('#c3cccf', 0.33, 0.62),
    frame: material('#edf0ed', 0.4, 0.24),
    dark: material('#25343b', 0.52),
    rubber: material('#18232a', 0.95),
    pale: material('#f2f1eb'),
    wood: material('#d5b993', 0.8),
    screen: new THREE.MeshStandardMaterial({
      color: '#284953',
      emissive: '#163946',
      emissiveIntensity: 0.32,
      roughness: 0.22,
      metalness: 0.12,
    }),
    screenLight: new THREE.MeshStandardMaterial({
      color: '#98d7da',
      emissive: '#5fadaf',
      emissiveIntensity: 0.25,
      roughness: 0.5,
    }),
    led: new THREE.MeshStandardMaterial({
      color: '#97e4bd',
      emissive: '#47c890',
      emissiveIntensity: 0.5,
    }),
  };
  const cached = (key: string, make: () => THREE.BufferGeometry) => {
    const existing = geometryCache.get(key);
    if (existing) return existing;
    const geometry = make();
    geometryCache.set(key, geometry);
    return geometry;
  };
  const mesh = (
    parent: THREE.Object3D,
    name: string,
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    at: Point
  ): THREE.Mesh => {
    const object = new THREE.Mesh(geometry, surface);
    object.name = name;
    object.position.set(...at);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (
    parent: THREE.Object3D,
    name: string,
    size: Point,
    at: Point,
    surface = tones.body,
    radius = 0.008
  ) => {
    const r = Math.min(radius, Math.min(...size) * 0.3);
    return mesh(
      parent,
      name,
      cached(`box:${size.join(',')}:${r}`, () =>
        r > 0 ? new RoundedBoxGeometry(...size, 2, r) : new THREE.BoxGeometry(...size)
      ),
      surface,
      at
    );
  };
  const cylinder = (
    parent: THREE.Object3D,
    name: string,
    radius: number,
    height: number,
    at: Point,
    surface = tones.metal,
    segments = 12
  ) =>
    mesh(
      parent,
      name,
      cached(
        `cyl:${radius}:${height}:${segments}`,
        () => new THREE.CylinderGeometry(radius, radius, height, segments)
      ),
      surface,
      at
    );
  const rod = (
    parent: THREE.Object3D,
    name: string,
    from: Point,
    to: Point,
    radius = 0.014,
    surface = tones.metal
  ) => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const delta = end.clone().sub(start);
    const center = start.add(end).multiplyScalar(0.5);
    const object = cylinder(
      parent,
      name,
      radius,
      delta.length(),
      [center.x, center.y, center.z],
      surface
    );
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  };
  const group = (parent: THREE.Object3D, name: string, at: Point = [0, 0, 0], yaw = 0) => {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(...at);
    object.rotation.y = yaw;
    parent.add(object);
    return object;
  };
  const slab = (
    parent: THREE.Object3D,
    name: string,
    points: PlanPoint[],
    baseY: number,
    thickness: number,
    surface = tones.body
  ) => {
    const shape = new THREE.Shape();
    points.forEach(([x, z], index) => (index ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    return mesh(parent, name, geometry, surface, [0, baseY, 0]);
  };
  return { tones, box, cylinder, rod, group, slab };
}

type ModelTools = ReturnType<typeof modelTools>;

/** The front of a chair points toward local -Z, so its back can face an outer aisle. */
function chair(
  parent: THREE.Object3D,
  t: ModelTools,
  at: Point = [0, 0, 0],
  yaw = 0,
  office = false
) {
  const { tones: m, box, rod, cylinder, group } = t;
  const seat = group(parent, office ? 'office-chair' : 'chair', at, yaw);
  box(seat, 'moulded-seat', [0.42, 0.047, 0.4], [0, 0.425, 0], m.accent, 0.025);
  const back = box(
    seat,
    'curved-back',
    [0.41, office ? 0.35 : 0.26, 0.046],
    [0, office ? 0.7 : 0.66, 0.178],
    m.accent,
    0.025
  );
  back.rotation.x = -0.14;
  if (office) {
    box(seat, 'back-cushion', [0.345, 0.28, 0.027], [0, 0.7, 0.14], m.dark, 0.018);
    cylinder(seat, 'lift-column', 0.03, 0.3, [0, 0.22, 0], m.metal);
    cylinder(seat, 'column-cover', 0.044, 0.12, [0, 0.11, 0], m.dark);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const x = Math.sin(angle) * 0.23;
      const z = Math.cos(angle) * 0.23;
      rod(seat, 'star-base', [0, 0.11, 0], [x, 0.055, z], 0.021, m.dark);
      const caster = cylinder(seat, 'caster', 0.028, 0.037, [x, 0.028, z], m.rubber);
      caster.rotation.z = Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      rod(
        seat,
        'arm-support',
        [side * 0.18, 0.415, 0.1],
        [side * 0.235, 0.585, 0.07],
        0.013,
        m.dark
      );
      box(seat, 'arm-pad', [0.055, 0.03, 0.26], [side * 0.235, 0.59, 0.035], m.dark);
    }
    rod(seat, 'back-spine', [0, 0.38, 0.12], [0, 0.79, 0.22], 0.018, m.dark);
  } else {
    for (const x of [-0.158, 0.158]) {
      for (const z of [-0.14, 0.14]) {
        rod(seat, 'splayed-leg', [x * 1.1, 0.015, z * 1.18], [x, 0.408, z], 0.014, m.frame);
        cylinder(seat, 'foot-cap', 0.017, 0.018, [x * 1.1, 0.009, z * 1.18], m.rubber);
      }
      rod(seat, 'back-support', [x, 0.37, 0.14], [x, 0.765, 0.19], 0.013, m.frame);
    }
    rod(seat, 'seat-brace', [-0.158, 0.37, 0.04], [0.158, 0.37, 0.04], 0.012, m.frame);
    box(seat, 'back-grip', [0.12, 0.018, 0.004], [0, 0.735, 0.169], m.edge, 0.003);
  }
  return seat;
}

function table(parent: THREE.Object3D, t: ModelTools, teacher: boolean) {
  const { tones: m, box, rod, cylinder } = t;
  const width = teacher ? 1.4 : 0.78;
  const depth = teacher ? 0.68 : 0.56;
  const z = -0.18;
  box(parent, 'table-edge', [width, 0.038, depth], [0, 0.722, z], m.edge, 0.018);
  box(parent, 'tabletop', [width, 0.028, depth], [0, 0.744, z], m.body, 0.017);
  box(
    parent,
    'underframe-front',
    [width - 0.14, 0.048, 0.024],
    [0, 0.69, z - depth / 2 + 0.06],
    m.frame
  );
  for (const side of [-1, 1]) {
    if (teacher && side === 1) continue;
    const x = side * (width / 2 - 0.065);
    for (const end of [-1, 1]) {
      const legZ = z + end * (depth / 2 - 0.06);
      rod(parent, 'table-leg', [x, 0.025, legZ], [x, 0.704, legZ], 0.021, m.frame);
      cylinder(parent, 'leveling-foot', 0.023, 0.022, [x, 0.011, legZ], m.rubber);
    }
    rod(
      parent,
      'side-brace',
      [x, 0.68, z - depth / 2 + 0.06],
      [x, 0.68, z + depth / 2 - 0.06],
      0.014,
      m.frame
    );
  }
  if (teacher) {
    box(
      parent,
      'drawer-pedestal',
      [0.35, 0.655, depth - 0.065],
      [width / 2 - 0.23, 0.3475, z],
      m.edge
    );
    for (let i = 0; i < 3; i++) {
      const y = 0.145 + i * 0.21;
      box(
        parent,
        'drawer-front',
        [0.32, 0.193, 0.024],
        [width / 2 - 0.23, y, z + depth / 2 - 0.018],
        m.body
      );
      rod(
        parent,
        'drawer-handle',
        [width / 2 - 0.295, y + 0.055, z + depth / 2 + 0.006],
        [width / 2 - 0.165, y + 0.055, z + depth / 2 + 0.006],
        0.007,
        m.dark
      );
    }
    box(
      parent,
      'modesty-panel',
      [width - 0.49, 0.34, 0.028],
      [-0.19, 0.45, z - depth / 2 + 0.09],
      m.body
    );
    const grommet = cylinder(
      parent,
      'cable-grommet',
      0.027,
      0.004,
      [0.36, 0.76, z - 0.21],
      m.dark,
      20
    );
    grommet.receiveShadow = false;
    chair(parent, t, [-0.17, 0, 0.5], 0, true);
  } else {
    box(parent, 'under-desk-tray', [width - 0.17, 0.02, depth - 0.18], [0, 0.6, z], m.frame);
    box(parent, 'tray-back', [width - 0.17, 0.08, 0.015], [0, 0.63, z - 0.18], m.frame);
    chair(parent, t, [0, 0, 0.4]);
  }
}

function hexTableSet(parent: THREE.Object3D, t: ModelTools) {
  const { tones: m, slab, rod, cylinder } = t;
  const outerRadius = 0.94;
  const innerRadius = 0.18;
  const seam = 0.008;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const a = angle - Math.PI / 6;
    const b = angle + Math.PI / 6;
    // An annular hexagon sector is a trapezoid. Its neighbours share radial edges.
    const points: PlanPoint[] = [
      [Math.sin(a) * outerRadius, Math.cos(a) * outerRadius],
      [Math.sin(b) * outerRadius, Math.cos(b) * outerRadius],
      [Math.sin(b) * innerRadius, Math.cos(b) * innerRadius],
      [Math.sin(a) * innerRadius, Math.cos(a) * innerRadius],
    ];
    const center = points.reduce((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4], [0, 0]);
    const separated: PlanPoint[] = points.map(([x, z]) => [
      center[0] + (x - center[0]) * (1 - seam),
      center[1] + (z - center[1]) * (1 - seam),
    ]);
    slab(parent, `trapezoid-edge-${i}`, separated, 0.708, 0.033, m.edge);
    const top = slab(parent, `trapezoid-top-${i}`, separated, 0.737, 0.018, m.body);
    top.userData.footprint = separated;
    for (const [x, z] of points.map(([x, z]) => [
      center[0] + (x - center[0]) * 0.8,
      center[1] + (z - center[1]) * 0.8,
    ])) {
      rod(parent, 'trapezoid-leg', [x, 0.021, z], [x, 0.71, z], 0.015, m.frame);
      cylinder(parent, 'trapezoid-foot', 0.018, 0.018, [x, 0.009, z], m.rubber);
    }
    const radius = 1.11;
    chair(parent, t, [Math.sin(angle) * radius, 0, Math.cos(angle) * radius], angle);
  }
  // A recessed cable well keeps the six individual table tops visibly separate.
  const well: PlanPoint[] = Array.from({ length: 6 }, (_, i) => [
    Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * 0.168,
    Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * 0.168,
  ]);
  slab(parent, 'central-cable-well', well, 0.683, 0.012, m.dark);
}

function storage(parent: THREE.Object3D, t: ModelTools, closed: boolean) {
  const { tones: m, box, cylinder, rod } = t;
  const width = 1;
  const height = closed ? 1.15 : 1.65;
  const depth = 0.4;
  const panel = 0.032;
  for (const side of [-1, 1]) {
    box(
      parent,
      'side-panel',
      [panel, height - 0.07, depth],
      [(side * (width - panel)) / 2, (height + 0.07) / 2, 0],
      m.body
    );
    for (const z of [-0.145, 0.145])
      cylinder(parent, 'cabinet-foot', 0.026, 0.08, [side * 0.43, 0.04, z], m.dark);
  }
  box(
    parent,
    'back-panel',
    [width - panel * 2, height - 0.1, 0.02],
    [0, height / 2 + 0.045, -depth / 2 + 0.01],
    m.edge
  );
  const levels = closed ? [0.08, 0.59, height - 0.02] : [0.08, 0.47, 0.86, 1.25, height - 0.02];
  for (const y of levels)
    box(parent, 'shelf', [width - panel * 2, panel, depth], [0, y, 0], m.body);
  if (closed) {
    for (const side of [-1, 1]) {
      box(parent, 'lower-door', [0.456, 0.48, 0.026], [side * 0.239, 0.34, 0.198], m.body);
      rod(
        parent,
        'door-handle',
        [side * 0.047, 0.33, 0.228],
        [side * 0.047, 0.45, 0.228],
        0.008,
        m.dark
      );
    }
    for (let column = 0; column < 3; column++) {
      for (let row = 0; row < 2; row++) {
        const x = (column - 1) * 0.305;
        const y = 0.71 + row * 0.25;
        box(
          parent,
          'storage-drawer',
          [0.279, 0.219, 0.34],
          [x, y, 0.017],
          row === 1 ? m.accentLight : m.accent
        );
        box(parent, 'drawer-label', [0.085, 0.035, 0.004], [x, y + 0.055, 0.191], m.pale, 0.003);
        box(parent, 'drawer-grip', [0.09, 0.022, 0.008], [x, y - 0.045, 0.195], m.dark, 0.006);
      }
    }
  } else {
    // A few curated objects leave the open shelving structure readable from across the room.
    for (let i = 0; i < 5; i++) {
      const book = box(
        parent,
        'book',
        [0.043 + (i % 2) * 0.014, 0.23 + (i % 3) * 0.035, 0.22],
        [-0.36 + i * 0.07, 0.5 + (0.23 + (i % 3) * 0.035) / 2, -0.015],
        i % 2 ? m.accent : m.pale,
        0.003
      );
      if (i === 4) book.rotation.z = -0.09;
    }
    for (const x of [-0.25, 0.25]) {
      box(parent, 'organizer-bin', [0.35, 0.25, 0.3], [x, 0.215, 0.01], m.accent);
      box(parent, 'bin-label', [0.11, 0.045, 0.004], [x, 0.23, 0.163], m.pale);
      box(parent, 'bin-handle', [0.105, 0.019, 0.009], [x, 0.295, 0.166], m.dark, 0.004);
    }
    box(parent, 'project-box', [0.37, 0.18, 0.27], [0.22, 0.965, -0.01], m.accentLight);
    box(parent, 'project-box-lid', [0.388, 0.025, 0.284], [0.22, 1.067, -0.01], m.accent);
    cylinder(parent, 'display-plinth', 0.085, 0.045, [-0.21, 1.289, 0], m.dark, 24);
    const sculpture = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11), m.accent);
    sculpture.name = 'display-object';
    sculpture.position.set(-0.21, 1.408, 0);
    sculpture.castShadow = true;
    parent.add(sculpture);
  }
}

function computer(parent: THREE.Object3D, t: ModelTools) {
  const { tones: m, box, cylinder, rod, group } = t;
  box(parent, 'monitor-foot', [0.22, 0.018, 0.15], [0, 0.009, -0.065], m.metal, 0.018);
  rod(parent, 'monitor-stand', [0, 0.018, -0.095], [0, 0.21, -0.09], 0.022, m.metal);
  const monitor = group(parent, 'monitor', [0, 0.275, -0.085]);
  monitor.rotation.x = -0.055;
  box(monitor, 'monitor-body', [0.54, 0.32, 0.026], [0, 0, 0], m.body, 0.018);
  box(monitor, 'monitor-bezel', [0.527, 0.306, 0.011], [0, 0, 0.014], m.dark, 0.009);
  box(monitor, 'screen', [0.499, 0.273, 0.003], [0, 0.006, 0.021], m.screen, 0.004);
  box(monitor, 'screen-sidebar', [0.1, 0.252, 0.001], [-0.192, 0.006, 0.024], m.dark, 0.002);
  for (let i = 0; i < 4; i++)
    box(
      monitor,
      'screen-menu-line',
      [0.064, 0.004, 0.001],
      [-0.192, 0.081 - i * 0.027, 0.025],
      m.screenLight,
      0
    );
  for (let i = 0; i < 3; i++) {
    box(
      monitor,
      'screen-card',
      [0.093, 0.069, 0.001],
      [-0.082 + i * 0.111, 0.041, 0.024],
      i === 1 ? m.accent : m.screenLight,
      0.004
    );
    box(
      monitor,
      'screen-text-line',
      [0.077, 0.005, 0.001],
      [-0.082 + i * 0.111, -0.013, 0.024],
      m.screenLight,
      0
    );
  }
  box(
    monitor,
    'screen-bottom-bar',
    [0.245, 0.004, 0.001],
    [0.029, -0.067, 0.024],
    m.screenLight,
    0
  );
  const camera = cylinder(monitor, 'webcam', 0.0026, 0.003, [0, 0.147, 0.022], m.rubber);
  camera.rotation.x = Math.PI / 2;
  box(parent, 'keyboard-base', [0.38, 0.016, 0.128], [-0.04, 0.014, 0.205], m.body, 0.011);
  // Individual keys keep this recognisable even when the catalogue has no image or GLB.
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 12; column++)
      box(
        parent,
        'key',
        [0.024, 0.005, 0.018],
        [-0.195 + column * 0.028, 0.025, 0.166 + row * 0.025],
        m.pale,
        0.003
      );
  }
  box(parent, 'spacebar', [0.144, 0.005, 0.014], [-0.04, 0.025, 0.261], m.pale, 0.003);
  box(parent, 'mouse', [0.056, 0.03, 0.087], [0.205, 0.017, 0.2], m.body, 0.017);
  box(parent, 'mouse-wheel', [0.005, 0.006, 0.017], [0.205, 0.033, 0.18], m.dark, 0.002);
}

function projector(parent: THREE.Object3D, t: ModelTools) {
  const { tones: m, box, cylinder } = t;
  box(parent, 'projector-chassis', [0.35, 0.095, 0.245], [0, 0.064, 0], m.body, 0.021);
  box(parent, 'projector-lower-shell', [0.327, 0.024, 0.224], [0, 0.024, 0], m.edge, 0.012);
  const lensMount = cylinder(
    parent,
    'lens-barrel',
    0.039,
    0.048,
    [-0.085, 0.066, 0.131],
    m.dark,
    28
  );
  lensMount.rotation.x = Math.PI / 2;
  const lensRing = cylinder(parent, 'lens-ring', 0.033, 0.008, [-0.085, 0.066, 0.157], m.metal, 28);
  lensRing.rotation.x = Math.PI / 2;
  const lens = cylinder(parent, 'lens-glass', 0.027, 0.009, [-0.085, 0.066, 0.162], m.screen, 28);
  lens.rotation.x = Math.PI / 2;
  const lensHighlight = cylinder(
    parent,
    'lens-reflection',
    0.009,
    0.001,
    [-0.093, 0.075, 0.168],
    m.screenLight,
    16
  );
  lensHighlight.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++)
    box(
      parent,
      'front-vent',
      [0.007, 0.041, 0.003],
      [0.025 + i * 0.014, 0.064, 0.123],
      m.dark,
      0.002
    );
  for (let i = 0; i < 7; i++)
    box(
      parent,
      'side-vent',
      [0.003, 0.036, 0.008],
      [0.176, 0.067, -0.078 + i * 0.021],
      m.dark,
      0.002
    );
  cylinder(parent, 'focus-dial', 0.023, 0.007, [-0.085, 0.113, 0.055], m.edge, 20);
  cylinder(parent, 'power-button', 0.01, 0.003, [0.061, 0.113, -0.035], m.accent, 16);
  cylinder(parent, 'status-led', 0.003, 0.004, [0.095, 0.114, -0.035], m.led);
  for (const x of [-0.123, 0.123])
    for (const z of [-0.075, 0.075])
      cylinder(parent, 'projector-foot', 0.014, 0.015, [x, 0.0075, z], m.rubber);
}

function roboticsKit(parent: THREE.Object3D, t: ModelTools) {
  const { tones: m, box, cylinder, rod, group } = t;
  box(parent, 'kit-tray-base', [0.43, 0.013, 0.32], [0, 0.0065, 0], m.body, 0.015);
  for (const side of [-1, 1]) {
    box(parent, 'kit-tray-side', [0.012, 0.043, 0.31], [side * 0.209, 0.031, 0], m.body);
    box(parent, 'kit-tray-end', [0.408, 0.043, 0.012], [0, 0.031, side * 0.154], m.body);
  }
  box(parent, 'tray-divider', [0.009, 0.026, 0.294], [0.07, 0.025, 0], m.edge);
  box(parent, 'tray-compartment', [0.129, 0.026, 0.009], [0.139, 0.025, 0.005], m.edge);
  const robot = group(parent, 'wheeled-robot', [-0.065, 0.014, -0.012], -0.12);
  box(robot, 'robot-chassis', [0.15, 0.019, 0.195], [0, 0.042, 0], m.accent, 0.012);
  box(robot, 'controller-board', [0.115, 0.006, 0.13], [0, 0.057, -0.008], m.accentLight, 0.003);
  box(robot, 'microcontroller', [0.033, 0.008, 0.042], [0, 0.064, -0.012], m.dark, 0.001);
  for (const side of [-1, 1]) {
    for (const z of [-0.059, 0.059]) {
      const wheel = cylinder(
        robot,
        'rubber-wheel',
        0.034,
        0.026,
        [side * 0.087, 0.034, z],
        m.rubber,
        20
      );
      wheel.rotation.z = Math.PI / 2;
      const hub = cylinder(
        robot,
        'wheel-hub',
        0.017,
        0.027,
        [side * 0.091, 0.034, z],
        m.accent,
        16
      );
      hub.rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 5; i++)
      box(
        robot,
        'board-pin',
        [0.005, 0.008, 0.007],
        [side * 0.044, 0.064, -0.045 + i * 0.018],
        m.metal,
        0
      );
  }
  box(robot, 'sensor-board', [0.092, 0.035, 0.01], [0, 0.077, 0.083], m.accentLight, 0.003);
  for (const x of [-0.027, 0.027]) {
    const sensor = cylinder(
      robot,
      'ultrasonic-sensor',
      0.014,
      0.016,
      [x, 0.079, 0.097],
      m.metal,
      16
    );
    sensor.rotation.x = Math.PI / 2;
    const opening = cylinder(robot, 'sensor-opening', 0.01, 0.001, [x, 0.079, 0.106], m.dark, 16);
    opening.rotation.x = Math.PI / 2;
  }
  rod(robot, 'jumper-wire', [0.026, 0.073, -0.037], [0.038, 0.089, 0.047], 0.0024, m.accent);
  box(parent, 'battery-pack', [0.084, 0.032, 0.1], [0.139, 0.03, -0.075], m.dark);
  for (const x of [0.116, 0.159])
    cylinder(parent, 'battery-terminal', 0.008, 0.006, [x, 0.049, -0.096], m.metal);
  for (let i = 0; i < 3; i++) {
    const beam = box(
      parent,
      'construction-beam',
      [0.105, 0.013, 0.021],
      [0.139, 0.023 + i * 0.014, 0.06 + i * 0.017],
      i % 2 ? m.accent : m.accentLight,
      0.004
    );
    beam.rotation.y = (i - 1) * 0.07;
    for (let hole = 0; hole < 4; hole++)
      cylinder(
        parent,
        'beam-socket',
        0.0035,
        0.002,
        [0.106 + hole * 0.022, 0.031 + i * 0.014, 0.06 + i * 0.017],
        m.dark,
        8
      );
  }
}

/**
 * Procedural catalogue models, selected explicitly by asset.model.
 * The complete assembly (including chairs) fits product.dimensions, rests at Y=0,
 * and is centred on X/Z. Images and GLBs are loaded by the scene, never by this factory.
 */
export function createProductModel(product: SpaceProduct): THREE.Group {
  const result = new THREE.Group();
  result.name = `product-${product.id}`;
  const content = new THREE.Group();
  content.name = 'model';
  result.add(content);
  const model = product.asset?.model;
  const t = modelTools(product.asset?.color || '#d9c4a6', product.asset?.accent_color || '#328b79');
  switch (model) {
    case 'table':
      table(content, t, false);
      break;
    case 'desk':
      table(content, t, true);
      break;
    case 'hex-table-set':
      hexTableSet(content, t);
      break;
    case 'shelving':
      storage(content, t, false);
      break;
    case 'cabinet':
      storage(content, t, true);
      break;
    case 'chair':
      chair(content, t);
      break;
    case 'computer':
      computer(content, t);
      break;
    case 'projector':
      projector(content, t);
      break;
    case 'robotics-kit':
      roboticsKit(content, t);
      break;
    default:
      if (product.asset?.shape === 'cylinder')
        t.cylinder(content, 'unmodelled-cylinder', 0.5, 1, [0, 0.5, 0], t.tones.body, 32);
      else t.box(content, 'unmodelled-box', [1, 1, 1], [0, 0.5, 0], t.tones.body, 0.018);
  }
  const fallback = (model && DEFAULT_DIMENSIONS[model]) || { width: 1, depth: 1, height: 1 };
  const size = product.dimensions || fallback;
  const bounds = new THREE.Box3().setFromObject(content, true);
  const original = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const positive = (value: number, otherwise: number) =>
    Number.isFinite(value) && value > 0 ? value : otherwise;
  content.scale.set(
    positive(size.width, fallback.width) / original.x,
    positive(size.height, fallback.height) / original.y,
    positive(size.depth, fallback.depth) / original.z
  );
  content.position.set(
    -centre.x * content.scale.x,
    -bounds.min.y * content.scale.y,
    -centre.z * content.scale.z
  );
  const surfaceY =
    model === 'hex-table-set'
      ? 0.755
      : model === 'table' || model === 'desk'
        ? 0.758
        : bounds.max.y;
  result.userData.surfaceHeight = (surfaceY - bounds.min.y) * content.scale.y;
  result.updateMatrixWorld(true);
  const supportBounds = new THREE.Box3();
  if (model === 'table' || model === 'desk') {
    const tabletop = content.getObjectByName('tabletop');
    if (tabletop) supportBounds.setFromObject(tabletop, true);
  } else if (model === 'hex-table-set') {
    content.traverse((object) => {
      if (object.name.startsWith('trapezoid-top-'))
        supportBounds.union(new THREE.Box3().setFromObject(object, true));
    });
  } else if (model === 'shelving' || model === 'cabinet') {
    content.traverse((object) => {
      if (object.name === 'shelf' && object.position.y > bounds.max.y * 0.9)
        supportBounds.union(new THREE.Box3().setFromObject(object, true));
    });
  }
  if (!supportBounds.isEmpty()) {
    const supportSize = supportBounds.getSize(new THREE.Vector3());
    const supportCenter = supportBounds.getCenter(new THREE.Vector3());
    // An axis-aligned rectangle inside this hexagon must use < 2/3 of both bounds.
    // Leave a little extra room at its diagonal edges; chairs are never part of the surface.
    const inset = model === 'hex-table-set' ? 0.64 : 0.95;
    result.userData.supportSurface = {
      height: supportBounds.max.y,
      width: supportSize.x * inset,
      depth: supportSize.z * inset,
      x: supportCenter.x,
      z: supportCenter.z,
    };
    result.userData.surfaceHeight = supportBounds.max.y;
    result.userData.supportSurfaces = [result.userData.supportSurface];
    if (model === 'hex-table-set') {
      result.userData.supportSurfaces = Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.sin(angle) * 0.59 * content.scale.x + content.position.x;
        const z = Math.cos(angle) * 0.59 * content.scale.z + content.position.z;
        const yaw = Math.atan2(
          Math.sin(angle) * content.scale.x,
          Math.cos(angle) * content.scale.z
        );
        const top = content.getObjectByName(`trapezoid-top-${i}`)!;
        const polygon: PlanPoint[] = (top.userData.footprint as PlanPoint[]).map(([px, pz]) => [
          px * content.scale.x + content.position.x,
          pz * content.scale.z + content.position.z,
        ]);
        let width = 0.44 * Math.min(content.scale.x, content.scale.z);
        let depth = 0.34 * Math.min(content.scale.x, content.scale.z);
        const inside = (px: number, pz: number) => {
          const sides = polygon.map(([ax, az], index) => {
            const [bx, bz] = polygon[(index + 1) % polygon.length];
            return (bx - ax) * (pz - az) - (bz - az) * (px - ax);
          });
          return sides.every((value) => value >= -1e-9) || sides.every((value) => value <= 1e-9);
        };
        // Non-square catalogue dimensions shear the wedges. Check the actual polygon,
        // keeping each rectangular support away from seams and the central cable well.
        for (let attempt = 0; attempt < 80; attempt++) {
          const corners = [-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => [
              x + ((sx * width) / 2) * Math.cos(yaw) + ((sz * depth) / 2) * Math.sin(yaw),
              z - ((sx * width) / 2) * Math.sin(yaw) + ((sz * depth) / 2) * Math.cos(yaw),
            ])
          );
          if (corners.every(([px, pz]) => inside(px, pz))) break;
          width *= 0.94;
          depth *= 0.94;
        }
        return {
          height: supportBounds.max.y,
          width,
          depth,
          x,
          z,
          rotation: (-yaw * 180) / Math.PI,
        };
      });
    }
  }
  return result;
}
