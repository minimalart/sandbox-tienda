import * as THREE from 'three';
import type { SpaceRoom } from '@lib/space-designer/types';

/** Models can share resources through clones and instancing. Dispose each resource once. */
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const bitmaps = new Set<ImageBitmap>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    if (mesh.material)
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
  });
  textures.forEach((texture) => {
    const image: unknown = texture.source?.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) bitmaps.add(image);
    texture.dispose();
  });
  bitmaps.forEach((bitmap) => bitmap.close());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export function normaliseModel(
  source: THREE.Object3D,
  dimensions: { width: number; height: number; depth: number }
) {
  source.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || Math.min(size.x, size.y, size.z) < 0.00001)
    throw new Error('El archivo 3D no tiene un volumen válido.');
  const centre = bounds.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.add(source);
  pivot.position.set(-centre.x, -bounds.min.y, -centre.z);
  const model = new THREE.Group();
  model.add(pivot);
  model.scale.set(dimensions.width / size.x, dimensions.height / size.y, dimensions.depth / size.z);
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  model.updateWorldMatrix(true, true);
  return model;
}

export function fitCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  room: SpaceRoom,
  top = false
) {
  target.set(room.width / 2, top ? 0 : room.height * 0.28, room.depth / 2);
  const direction = top
    ? new THREE.Vector3(0, 1, 0.001).normalize()
    : new THREE.Vector3(1, 0.95, 1).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanHorizontal = tanVertical * camera.aspect;
  let distance = 1;
  for (const x of [0, room.width])
    for (const y of [0, room.height])
      for (const z of [0, room.depth]) {
        const point = new THREE.Vector3(x, y, z).sub(target);
        distance = Math.max(
          distance,
          point.dot(direction) +
            Math.max(
              Math.abs(point.dot(right)) / tanHorizontal,
              Math.abs(point.dot(up)) / tanVertical
            )
        );
      }
  camera.position.copy(target).addScaledVector(direction, distance * 1.12);
  camera.near = 0.05;
  camera.far = Math.max(500, distance * 8);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e4dcc9';
  ctx.fillRect(0, 0, 512, 512);
  for (let plank = 0; plank < 8; plank++) {
    ctx.fillStyle = ['#e1d5bb', '#e9dfca', '#e6d9c2', '#ded2ba'][plank % 4]!;
    ctx.fillRect(0, plank * 64 + 1, 512, 62);
    for (let grain = 0; grain < 11; grain++) {
      ctx.strokeStyle = `rgba(109,85,53,${0.025 + (grain % 3) * 0.012})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, plank * 64 + grain * 6);
      ctx.bezierCurveTo(
        180,
        plank * 64 + grain * 6 + 4,
        320,
        plank * 64 + grain * 6 - 4,
        512,
        plank * 64 + grain * 6
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#b9ab8d';
    ctx.fillRect(plank % 2 ? 168 : 338, plank * 64, 1, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function measurement(text: string, x: number, z: number, scale: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#57665b';
  ctx.font = '500 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 44);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
  );
  sprite.position.set(x, 0.08, z);
  sprite.scale.set(scale, scale / 4, 1);
  return sprite;
}

export function createRoom(
  room: SpaceRoom,
  invalidate: () => void,
  warning: (text: string) => void
) {
  const group = new THREE.Group();
  let disposed = false;
  const pendingTextures: THREE.Texture[] = [];
  const wallGroups: THREE.Group[] = [];
  const textureLoader = new THREE.TextureLoader();
  const applyTexture = (
    url: string | undefined,
    materials: THREE.MeshStandardMaterial[],
    repeatX: number,
    repeatY: number
  ) => {
    if (!url) return;
    const texture = textureLoader.load(
      url,
      (loaded) => {
        if (disposed) {
          loaded.dispose();
          return;
        }
        loaded.wrapS = loaded.wrapT = THREE.RepeatWrapping;
        loaded.repeat.set(repeatX, repeatY);
        loaded.colorSpace = THREE.SRGBColorSpace;
        for (const material of materials) {
          material.map?.dispose();
          material.map = loaded;
          material.needsUpdate = true;
        }
        invalidate();
      },
      undefined,
      () => {
        if (!disposed)
          warning('No pudimos cargar una textura. Conservamos los colores del espacio.');
      }
    );
    pendingTextures.push(texture);
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent = group
  ) => {
    const result = new THREE.Mesh(geometry, material);
    result.position.set(x, y, z);
    result.receiveShadow = true;
    parent.add(result);
    return result;
  };
  mesh(
    new THREE.BoxGeometry(room.width + 0.16, 0.16, room.depth + 0.16),
    new THREE.MeshStandardMaterial({ color: '#c6c4b7', roughness: 0.85 }),
    room.width / 2,
    -0.095,
    room.depth / 2
  );
  const wood = woodTexture();
  wood.repeat.set(room.width / 3, room.depth / 3);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: room.floor_color,
    map: wood,
    roughness: 0.8,
  });
  const floor = mesh(
    new THREE.PlaneGeometry(room.width, room.depth),
    floorMaterial,
    room.width / 2,
    0,
    room.depth / 2
  );
  floor.rotation.x = -Math.PI / 2;
  applyTexture(
    room.floor_texture_url ?? room.background_url,
    [floorMaterial],
    room.floor_texture_url ? room.width / 3 : 1,
    room.floor_texture_url ? room.depth / 3 : 1
  );
  const wallMaterials: THREE.MeshStandardMaterial[] = [];
  for (let side = 0; side < 4; side++) {
    const wall = new THREE.Group();
    group.add(wall);
    wallGroups.push(wall);
    const alongX = side < 2;
    const width = alongX ? room.width + 0.16 : 0.12;
    const depth = alongX ? 0.12 : room.depth + 0.16;
    const x = alongX ? room.width / 2 : side === 2 ? -0.06 : room.width + 0.06;
    const z = alongX ? (side === 0 ? -0.06 : room.depth + 0.06) : room.depth / 2;
    const material = new THREE.MeshStandardMaterial({ color: room.wall_color, roughness: 0.92 });
    wallMaterials.push(material);
    const panel = mesh(
      new THREE.BoxGeometry(width, room.height, depth),
      material,
      x,
      room.height / 2,
      z,
      wall
    );
    panel.castShadow = false;
    mesh(
      new THREE.BoxGeometry(width + 0.02, 0.08, depth + 0.02),
      new THREE.MeshStandardMaterial({ color: '#faf9f3', roughness: 0.75 }),
      x,
      room.height + 0.04,
      z,
      wall
    );
    mesh(
      new THREE.BoxGeometry(width + 0.02, 0.09, depth + 0.02),
      new THREE.MeshStandardMaterial({ color: '#cbcbbd', roughness: 0.8 }),
      x,
      0.045,
      z,
      wall
    );
  }
  applyTexture(room.wall_texture_url, wallMaterials, 2, 1);
  group.add(
    measurement(
      `${room.width} m`,
      room.width / 2,
      room.depth + 0.42,
      Math.max(0.9, room.width * 0.14)
    )
  );
  group.add(
    measurement(
      `${room.depth} m`,
      room.width + 0.48,
      room.depth / 2,
      Math.max(0.9, room.depth * 0.14)
    )
  );
  return {
    group,
    updateWalls(camera: THREE.Camera) {
      wallGroups[0]!.visible = camera.position.z >= room.depth / 2;
      wallGroups[1]!.visible = camera.position.z < room.depth / 2;
      wallGroups[2]!.visible = camera.position.x >= room.width / 2;
      wallGroups[3]!.visible = camera.position.x < room.width / 2;
    },
    dispose() {
      disposed = true;
      disposeObject(group);
      pendingTextures.forEach((texture) => texture.dispose());
    },
  };
}
