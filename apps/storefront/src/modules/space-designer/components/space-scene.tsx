'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Boxes, Expand, Focus, Minus, Plus, RotateCw } from 'lucide-react';
import { fitObject } from '@lib/space-designer/design';
import type {
  SpaceCatalogProduct,
  SpaceObject,
  SpaceProduct,
  SpaceSnapshot,
} from '@lib/space-designer/types';
import { SPACE_PRODUCT_MIME } from '../drag';
import { createProductModel } from '../three/product-models';
import {
  dimensionsOf,
  includedPlacements,
  sceneObjectElevation,
  threeRotation,
  type SupportSurfaces,
} from '../three/placement';
import { createRoom, disposeObject, fitCamera, normaliseModel } from '../three/scene-utils';
import styles from './space-scene.module.css';

export type SpaceSceneProps = {
  snapshot: SpaceSnapshot;
  products: SpaceProduct[];
  catalog?: SpaceCatalogProduct[];
  selectedId?: string | null;
  interactive?: boolean;
  preview?: boolean;
  onSelect?: (id: string | null) => void;
  onMove?: (object: SpaceObject) => void;
  onRotate?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Called with the floor point (metres) where a catalogue product was dropped. */
  onDropProduct?: (productId: string, point: { x: number; z: number }) => void;
};

type SceneRuntime = {
  sync: (props: SpaceSceneProps) => void;
  frame: (top?: boolean) => void;
  zoom: (factor: number) => void;
};
type Prototype = { model: THREE.Group; version: number };
type InstancePart = { mesh: THREE.InstancedMesh; local: THREE.Matrix4 };

export default function SpaceScene(props: SpaceSceneProps) {
  const {
    snapshot,
    products,
    catalog = [],
    selectedId,
    interactive = false,
    preview = false,
  } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const runtime = useRef<SceneRuntime | null>(null);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [inspected, setInspected] = useState('');
  const [ready, setReady] = useState(false);
  const [topView, setTopView] = useState(false);
  const [retry, setRetry] = useState(0);
  const [dropping, setDropping] = useState(false);
  const descriptionId = useId();
  const titleOf = (product: SpaceProduct) =>
    product.label ||
    catalog.find((entry) => entry.id === product.product_id)?.title ||
    product.category;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setReady(false);
    setError('');
    setWarning('');
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: preview ? 'low-power' : 'high-performance',
      });
    } catch {
      setError(
        'No pudimos iniciar la vista 3D. Activá la aceleración gráfica del navegador o probá otro navegador.'
      );
      return;
    }
    let disposed = false;
    let pendingFrame = 0;
    let roomView: ReturnType<typeof createRoom> | null = null;
    let roomKey = '';
    let productsKey = '';
    let includedKey = '';
    let isTop = false;
    let current = latest.current;
    const touchPointers = new Set<number>();
    let drag: {
      pointerId: number;
      objectId: string;
      dx: number;
      dz: number;
      plane: THREE.Plane;
    } | null = null;
    // Follow the tenant palette instead of a hardcoded green. The CSS tints are
    // color-mix(), which getComputedStyle does NOT evaluate and three cannot
    // parse, so read the raw --primary-color and mix it here.
    const primary = new THREE.Color('#2e7d32');
    const declared = getComputedStyle(host).getPropertyValue('--primary-color').trim();
    if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(declared)) primary.setStyle(declared);
    const tint = (amount: number, base: string) =>
      primary.clone().lerp(new THREE.Color(base), 1 - amount);
    const scene = new THREE.Scene();
    scene.background = tint(0.07, '#f2f3ef');
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
    const target = new THREE.Vector3();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preview ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !preview;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      'Vista tridimensional del espacio con muebles y equipamiento'
    );
    host.appendChild(renderer.domElement);
    const controls = preview ? null : new OrbitControls(camera, renderer.domElement);
    if (controls) {
      controls.enableDamping = false;
      controls.maxPolarAngle = Math.PI / 2 - 0.04;
      controls.minPolarAngle = 0.02;
      controls.minDistance = 0.8;
      controls.screenSpacePanning = false;
      controls.zoomSpeed = 0.85;
      controls.target.copy(target);
    }
    const hemisphere = new THREE.HemisphereLight('#fffaf0', '#8f9490', 2.5);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight('#fff4dc', 3.4);
    sun.castShadow = !preview;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#ecf3ff', 1.3);
    fill.position.set(-5, 6, 6);
    scene.add(fill);
    const objects = new THREE.Group();
    scene.add(objects);
    const included = new THREE.Group();
    scene.add(included);
    const prototypes = new Map<string, Prototype>();
    const carriers = new Map<string, THREE.Group>();
    const batches = new Map<string, InstancePart[]>();
    const selection = new THREE.Box3Helper(new THREE.Box3(), tint(0.7, '#ffffff'));
    (selection.material as THREE.LineBasicMaterial).depthTest = false;
    selection.renderOrder = 20;
    selection.visible = false;
    scene.add(selection);
    const loader = new GLTFLoader();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const intersection = new THREE.Vector3();
    const placementMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();
    const rotationQuaternion = new THREE.Quaternion();

    const invalidate = () => {
      if (disposed || pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        if (disposed) return;
        roomView?.updateWalls(camera);
        renderer.render(scene, camera);
      });
    };
    const notify = (text: string) => {
      if (!disposed) setWarning(text);
    };
    const frame = (top = false) => {
      isTop = top;
      fitCamera(camera, target, current.snapshot.room, top);
      if (controls) {
        controls.target.copy(target);
        controls.maxDistance =
          Math.max(
            current.snapshot.room.width,
            current.snapshot.room.depth,
            current.snapshot.room.height
          ) * 7;
        controls.update();
      }
      invalidate();
    };
    const withMount = (model: THREE.Group, product: SpaceProduct) => {
      if (product.asset?.mount !== 'ceiling') return model;
      const group = new THREE.Group();
      group.add(model);
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.16, 10),
        new THREE.MeshStandardMaterial({ color: '#50545a', metalness: 0.4, roughness: 0.45 })
      );
      rod.position.y = dimensionsOf(product).height + 0.08;
      group.add(rod);
      return group;
    };
    const getPrototype = (product: SpaceProduct) => {
      let entry = prototypes.get(product.id);
      if (entry) return entry;
      entry = { model: withMount(createProductModel(product), product), version: 0 };
      prototypes.set(product.id, entry);
      if (product.asset?.kind === 'glb' && product.asset.url) {
        const owner = entry;
        loader.load(
          product.asset.url,
          (gltf) => {
            if (disposed || prototypes.get(product.id) !== owner) {
              disposeObject(gltf.scene);
              return;
            }
            try {
              const replacement = withMount(
                normaliseModel(gltf.scene, dimensionsOf(product)),
                product
              );
              const old = owner.model;
              if (product.asset?.model) {
                for (const key of ['supportSurface', 'supportSurfaces', 'surfaceHeight']) {
                  if (old.userData[key] !== undefined)
                    replacement.userData[key] = structuredClone(old.userData[key]);
                }
              }
              owner.model = replacement;
              owner.version++;
              runtime.current?.sync(latest.current);
              disposeObject(old);
            } catch {
              disposeObject(gltf.scene);
              notify(
                `El modelo de ${product.label || product.category} no tiene un volumen válido. Mostramos su representación 3D.`
              );
            }
          },
          undefined,
          () => {
            if (prototypes.get(product.id) === owner)
              notify(
                `No pudimos cargar el modelo de ${product.label || product.category}. Mostramos su representación 3D.`
              );
          }
        );
      }
      return entry;
    };
    const clearBatches = () => {
      for (const parts of Array.from(batches.values()))
        for (const part of parts) part.mesh.dispose();
      included.clear();
      batches.clear();
      includedKey = '';
    };
    const sync = (next: SpaceSceneProps) => {
      if (disposed) return;
      current = next;
      const room = next.snapshot.room;
      const nextProductsKey = JSON.stringify(next.products);
      if (productsKey !== nextProductsKey) {
        clearBatches();
        objects.clear();
        carriers.clear();
        for (const entry of Array.from(prototypes.values())) disposeObject(entry.model);
        prototypes.clear();
        productsKey = nextProductsKey;
      }
      const nextRoomKey = JSON.stringify(room);
      if (roomKey !== nextRoomKey) {
        if (roomView) {
          scene.remove(roomView.group);
          roomView.dispose();
        }
        roomView = createRoom(room, invalidate, notify);
        scene.add(roomView.group);
        roomKey = nextRoomKey;
        const span = Math.max(room.width, room.depth);
        sun.position.set(room.width * 0.6, Math.max(room.height * 3, span), room.depth * 0.8);
        sun.target.position.set(room.width / 2, 0, room.depth / 2);
        Object.assign(sun.shadow.camera, {
          left: -span,
          right: span,
          top: span,
          bottom: -span,
          near: 0.1,
          far: span * 5 + room.height * 3,
        });
        sun.shadow.camera.updateProjectionMatrix();
        frame(isTop);
      }
      const activeIds = new Set(next.snapshot.objects.map((object) => object.id));
      const surfaces: SupportSurfaces = new Map();
      for (const product of next.products.filter((entry) => entry.placement === 'scene')) {
        const model = getPrototype(product).model;
        if (model.userData.supportSurfaces?.length)
          surfaces.set(product.id, model.userData.supportSurfaces);
        else if (model.userData.supportSurface)
          surfaces.set(product.id, [model.userData.supportSurface]);
      }
      for (const [id, group] of Array.from(carriers))
        if (!activeIds.has(id)) {
          objects.remove(group);
          carriers.delete(id);
        }
      for (const object of next.snapshot.objects) {
        const product = next.products.find((entry) => entry.id === object.product_ref);
        if (!product) continue;
        const prototype = getPrototype(product);
        let carrier = carriers.get(object.id);
        if (!carrier) {
          carrier = new THREE.Group();
          carriers.set(object.id, carrier);
          objects.add(carrier);
        }
        if (
          carrier.userData.productRef !== product.id ||
          carrier.userData.version !== prototype.version
        ) {
          carrier.clear();
          carrier.add(prototype.model.clone(true));
          carrier.userData = {
            sceneObjectId: object.id,
            productRef: product.id,
            version: prototype.version,
          };
        }
        carrier.position.set(
          object.x,
          sceneObjectElevation(object, product, next.snapshot, next.products, surfaces),
          object.z
        );
        carrier.rotation.y = threeRotation(object.rotation);
        carrier.scale.setScalar(object.scale ?? 1);
        carrier.updateWorldMatrix(true, true);
      }
      const placements = includedPlacements(next.snapshot, next.products, surfaces);
      const grouped = new Map<string, typeof placements>();
      for (const placement of placements) {
        const group = grouped.get(placement.product_ref) ?? [];
        group.push(placement);
        grouped.set(placement.product_ref, group);
      }
      for (const ref of Array.from(grouped.keys())) {
        const product = next.products.find((entry) => entry.id === ref);
        if (product) getPrototype(product);
      }
      const nextIncludedKey = JSON.stringify(
        Array.from(grouped).map(([ref, entries]) => [
          ref,
          entries.length,
          prototypes.get(ref)?.version,
        ])
      );
      if (includedKey !== nextIncludedKey) {
        clearBatches();
        includedKey = nextIncludedKey;
        for (const [ref, entries] of Array.from(grouped)) {
          const prototype = prototypes.get(ref);
          if (!prototype) continue;
          prototype.model.updateWorldMatrix(true, true);
          const parts: InstancePart[] = [];
          prototype.model.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const mesh = new THREE.InstancedMesh(object.geometry, object.material, entries.length);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.includedRef = ref;
            included.add(mesh);
            parts.push({ mesh, local: object.matrixWorld.clone() });
          });
          batches.set(ref, parts);
        }
      }
      for (const [ref, entries] of Array.from(grouped)) {
        const parts = batches.get(ref);
        if (!parts) continue;
        entries.forEach((placement, index) => {
          rotationQuaternion.setFromAxisAngle(
            THREE.Object3D.DEFAULT_UP,
            threeRotation(placement.rotation)
          );
          placementMatrix.compose(
            new THREE.Vector3(placement.x, placement.y, placement.z),
            rotationQuaternion,
            new THREE.Vector3(1, 1, 1)
          );
          for (const part of parts)
            part.mesh.setMatrixAt(
              index,
              instanceMatrix.multiplyMatrices(placementMatrix, part.local)
            );
        });
        for (const part of parts) {
          part.mesh.instanceMatrix.needsUpdate = true;
          part.mesh.computeBoundingSphere();
        }
      }
      const selected = next.selectedId ? carriers.get(next.selectedId) : null;
      selection.visible = Boolean(selected);
      if (selected) selection.box.setFromObject(selected).expandByScalar(0.035);
      renderer.domElement.setAttribute(
        'aria-label',
        `Espacio 3D de ${room.width} por ${room.depth} metros: ${next.snapshot.objects.length} muebles y ${placements.length} productos de equipamiento.`
      );
      invalidate();
    };
    const setRay = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
    };
    const endDrag = (releaseCapture = true) => {
      const pointerId = drag?.pointerId;
      drag = null;
      if (controls) controls.enableRotate = controls.enablePan = controls.enableZoom = true;
      if (
        releaseCapture &&
        pointerId !== undefined &&
        renderer.domElement.hasPointerCapture(pointerId)
      )
        renderer.domElement.releasePointerCapture(pointerId);
      renderer.domElement.style.cursor = 'grab';
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        touchPointers.add(event.pointerId);
        if (touchPointers.size > 1) {
          // OrbitControls already tracks the first finger; keep its capture for the pinch.
          endDrag(false);
          return;
        }
      }
      if (event.button !== 0) return;
      if (drag && event.pointerId !== drag.pointerId) {
        endDrag(false);
        return;
      }
      setRay(event);
      const hit = raycaster.intersectObjects([...objects.children, ...included.children], true)[0];
      let owner: THREE.Object3D | undefined = hit?.object;
      while (owner && !owner.userData.sceneObjectId && !owner.userData.includedRef)
        owner = owner.parent ?? undefined;
      const ref = owner?.userData.includedRef as string | undefined;
      if (ref) {
        const product = current.products.find((entry) => entry.id === ref);
        if (product)
          setInspected(
            `${product.label || current.catalog?.find((entry) => entry.id === product.product_id)?.title || product.category} · equipamiento incluido`
          );
        return;
      }
      const id = owner?.userData.sceneObjectId as string | undefined;
      latest.current.onSelect?.(id ?? null);
      setInspected('');
      const object = current.snapshot.objects.find((entry) => entry.id === id);
      if (!object || !current.interactive || object.locked) return;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(hit?.point.y ?? 0));
      if (!raycaster.ray.intersectPlane(plane, intersection)) return;
      drag = {
        pointerId: event.pointerId,
        objectId: object.id,
        dx: intersection.x - object.x,
        dz: intersection.z - object.z,
        plane,
      };
      // Leave pointer tracking enabled so a second finger can become a camera gesture.
      if (controls) controls.enableRotate = controls.enablePan = controls.enableZoom = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
      event.preventDefault();
    };
    const pointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      setRay(event);
      if (!raycaster.ray.intersectPlane(drag.plane, intersection)) return;
      const object = current.snapshot.objects.find((entry) => entry.id === drag!.objectId);
      const product = current.products.find((entry) => entry.id === object?.product_ref);
      if (!object || !product) return;
      const fitted = fitObject(
        { ...object, x: intersection.x - drag.dx, z: intersection.z - drag.dz },
        product,
        current.snapshot.room
      );
      if (fitted) latest.current.onMove?.(fitted);
    };
    const pointerUp = (event: PointerEvent) => {
      touchPointers.delete(event.pointerId);
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag();
    };
    const lostCapture = (event: PointerEvent) => {
      if (drag?.pointerId === event.pointerId) endDrag(false);
    };
    // A catalogue card dropped on the canvas lands where the pointer is, not in
    // the middle of the room. Touch has no HTML5 drag, hence the "+" button too.
    const floorPoint = (event: DragEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, camera);
      const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      return raycaster.ray.intersectPlane(floor, intersection)
        ? { x: intersection.x, z: intersection.z }
        : null;
    };
    const carriesProduct = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes(SPACE_PRODUCT_MIME);
    const dragOver = (event: DragEvent) => {
      if (!latest.current.onDropProduct || !carriesProduct(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setDropping(true);
    };
    const dragLeave = (event: DragEvent) => {
      if (event.relatedTarget && host.contains(event.relatedTarget as Node)) return;
      setDropping(false);
    };
    const drop = (event: DragEvent) => {
      setDropping(false);
      const handler = latest.current.onDropProduct;
      if (!handler || !carriesProduct(event)) return;
      event.preventDefault();
      const productId = event.dataTransfer?.getData(SPACE_PRODUCT_MIME);
      const point = floorPoint(event);
      if (productId && point) handler(productId, point);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      endDrag();
      setError(
        'Se interrumpió la vista 3D. Tu distribución sigue en el editor. Podés volver a cargar la vista.'
      );
    };
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      frame(isTop);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    controls?.addEventListener('change', invalidate);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    if (!preview) {
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.addEventListener('pointerdown', pointerDown, true);
      renderer.domElement.addEventListener('pointermove', pointerMove, true);
      renderer.domElement.ownerDocument.addEventListener('pointerup', pointerUp, true);
      renderer.domElement.ownerDocument.addEventListener('pointercancel', pointerUp, true);
      renderer.domElement.addEventListener('lostpointercapture', lostCapture);
      host.addEventListener('dragover', dragOver);
      host.addEventListener('dragleave', dragLeave);
      host.addEventListener('drop', drop);
    }
    runtime.current = {
      sync,
      frame,
      zoom(factor) {
        camera.position
          .sub(controls?.target ?? target)
          .multiplyScalar(factor)
          .add(controls?.target ?? target);
        controls?.update();
        invalidate();
      },
    };
    sync(latest.current);
    resize();
    setReady(true);
    return () => {
      disposed = true;
      runtime.current = null;
      endDrag();
      observer.disconnect();
      controls?.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('pointerdown', pointerDown, true);
      renderer.domElement.removeEventListener('pointermove', pointerMove, true);
      renderer.domElement.ownerDocument.removeEventListener('pointerup', pointerUp, true);
      renderer.domElement.ownerDocument.removeEventListener('pointercancel', pointerUp, true);
      renderer.domElement.removeEventListener('lostpointercapture', lostCapture);
      host.removeEventListener('dragover', dragOver);
      host.removeEventListener('dragleave', dragLeave);
      host.removeEventListener('drop', drop);
      cancelAnimationFrame(pendingFrame);
      clearBatches();
      roomView?.dispose();
      for (const entry of Array.from(prototypes.values())) disposeObject(entry.model);
      selection.geometry.dispose();
      (selection.material as THREE.Material).dispose();
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [preview, retry]);

  useEffect(() => {
    runtime.current?.sync(props);
  }, [snapshot, products, catalog, selectedId, interactive, props]);

  const keyMove = (event: KeyboardEvent, object: SpaceObject) => {
    if (!interactive || object.locked) return;
    const keys = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'r',
      'R',
      'Delete',
      'Backspace',
    ];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key.toLowerCase() === 'r') {
      props.onRotate?.(object.id);
      return;
    }
    if (['Delete', 'Backspace'].includes(event.key)) {
      props.onDelete?.(object.id);
      return;
    }
    const product = products.find((entry) => entry.id === object.product_ref);
    if (!product) return;
    const step = event.shiftKey ? 0.5 : 0.1;
    const fitted = fitObject(
      {
        ...object,
        x: object.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        z: object.z + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      },
      product,
      snapshot.room
    );
    if (fitted) props.onMove?.(fitted);
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement === rootRef.current) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      setWarning('Este navegador no permite ampliar la vista a pantalla completa.');
    }
  };
  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${preview ? styles.preview : ''} ${dropping ? styles.dropTarget : ''}`}
      data-space-scene="3d"
    >
      <div
        ref={hostRef}
        className={styles.viewport}
        aria-describedby={preview ? undefined : descriptionId}
      />
      {!ready && !error && (
        <div className={styles.loading} role="status">
          Preparando tu espacio 3D…
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <Boxes size={32} />
          <p>{error}</p>
          {!preview && (
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              Volver a cargar la vista 3D
            </button>
          )}
        </div>
      )}
      {!preview && !error && (
        <>
          <div className={styles.controls} aria-label="Cámara del espacio">
            <div className={styles.viewButtons}>
              <button
                type="button"
                aria-pressed={!topView}
                onClick={() => {
                  runtime.current?.frame(false);
                  setTopView(false);
                }}
              >
                <Boxes size={15} /> 3D
              </button>
              <button
                type="button"
                aria-pressed={topView}
                onClick={() => {
                  runtime.current?.frame(true);
                  setTopView(true);
                }}
              >
                Planta
              </button>
            </div>
            <button
              type="button"
              aria-label="Recentrar espacio"
              title="Recentrar espacio"
              onClick={() => runtime.current?.frame(topView)}
            >
              <Focus size={17} />
            </button>
            <button
              type="button"
              aria-label="Acercar cámara"
              title="Acercar"
              onClick={() => runtime.current?.zoom(0.85)}
            >
              <Plus size={17} />
            </button>
            <button
              type="button"
              aria-label="Alejar cámara"
              title="Alejar"
              onClick={() => runtime.current?.zoom(1.18)}
            >
              <Minus size={17} />
            </button>
            <button
              type="button"
              aria-label="Ampliar vista 3D a pantalla completa"
              title="Pantalla completa"
              onClick={fullscreen}
            >
              <Expand size={17} />
            </button>
          </div>
          <p id={descriptionId} className={styles.instructions}>
            {interactive ? 'Arrastrá un producto del catálogo hasta acá para agregarlo. ' : ''}
            {interactive ? 'Arrastrá un mueble para moverlo. ' : ''}Arrastrá el fondo para girar ·
            Pellizcá o usá la rueda para acercar.
          </p>
          <details className={styles.objectList}>
            <summary>
              <Boxes size={14} /> Objetos del espacio
            </summary>
            <div className={styles.listContent}>
              <p>
                {interactive
                  ? 'Seleccioná un mueble. Flechas: mover · R: rotar · Suprimir: quitar.'
                  : 'Muebles y equipamiento de esta propuesta.'}
              </p>
              <ul>
                {snapshot.objects.map((object, index) => {
                  const product = products.find((entry) => entry.id === object.product_ref);
                  if (!product) return null;
                  return (
                    <li key={object.id}>
                      <button
                        type="button"
                        aria-pressed={object.id === selectedId}
                        onClick={() => props.onSelect?.(object.id)}
                        onKeyDown={(event) => keyMove(event, object)}
                      >
                        {index + 1}. {titleOf(product)}
                        {object.locked ? ' · fijo' : ''}
                        <span>
                          {object.x.toFixed(1)}, {object.z.toFixed(1)} m · {object.rotation}°
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {snapshot.included_items.length > 0 && (
                <>
                  <strong>Equipamiento incluido en la vista</strong>
                  <ul>
                    {snapshot.included_items.map((item) => {
                      const product = products.find((entry) => entry.id === item.product_ref);
                      return (
                        <li key={item.product_ref} className={styles.includedLabel}>
                          {product ? titleOf(product) : item.product_ref}
                          <span>× {item.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </details>
          {inspected && (
            <div className={styles.inspected} role="status">
              {inspected}
            </div>
          )}
          {warning && (
            <div className={styles.warning} role="status">
              {warning}
            </div>
          )}
          {selectedId &&
            interactive &&
            !snapshot.objects.find((object) => object.id === selectedId)?.locked && (
              <button
                type="button"
                className={styles.rotate}
                onClick={() => props.onRotate?.(selectedId)}
                aria-label="Rotar mueble seleccionado"
              >
                <RotateCw size={16} /> Rotar
              </button>
            )}
        </>
      )}
    </div>
  );
}
