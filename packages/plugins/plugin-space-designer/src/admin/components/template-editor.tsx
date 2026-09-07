import { Badge, Button, Heading, Input, Text, Textarea, toast } from '@medusajs/ui';
import { useRef, useState } from 'react';
import type { SpaceObject, SpaceProduct, SpaceRoom, SpaceTemplate } from '../../types';
import { ColorField, Empty, Field, newId, NumberField, selectClass } from './fields';

export const defaultRoom = (): SpaceRoom => ({
  width: 8,
  depth: 6,
  height: 2.6,
  shape: 'rectangle',
  floor_color: '#eee5d5',
  wall_color: '#d6e4da',
});
export const emptyTemplate = (): SpaceTemplate => ({
  id: newId('template'),
  name: 'Nuevo espacio',
  room: defaultRoom(),
  objects: [],
  included_items: [],
});

function footprint(product: SpaceProduct | undefined, rotation: number, scale = 1) {
  const angle = (rotation * Math.PI) / 180;
  const width = (product?.dimensions?.width ?? 1) * scale;
  const depth = (product?.dimensions?.depth ?? 1) * scale;
  return {
    width: Math.abs(width * Math.cos(angle)) + Math.abs(depth * Math.sin(angle)),
    depth: Math.abs(width * Math.sin(angle)) + Math.abs(depth * Math.cos(angle)),
  };
}

/** Places complete units in free cells; never invents a quantity outside the room. */
export function placeUnits(
  template: SpaceTemplate,
  product: SpaceProduct,
  products: SpaceProduct[],
  quantity: number
) {
  const objects = [...template.objects];
  const rotation = product.allowed_rotations?.[0] ?? 0;
  const size = footprint(product, rotation);
  const gap = 0.2;
  let added = 0;
  if (
    [template.room.width, template.room.depth, template.room.height].some(
      (value) => value < 1 || value > 100 || !Number.isFinite(value)
    ) ||
    [size.width, size.depth].some((value) => value <= 0 || !Number.isFinite(value)) ||
    (product.dimensions?.height ?? 0) > template.room.height ||
    objects.length + quantity > 300
  )
    return { objects, added };
  for (
    let z = size.depth / 2 + gap;
    z + size.depth / 2 <= template.room.depth - gap && added < quantity;
    z += size.depth + gap
  ) {
    for (
      let x = size.width / 2 + gap;
      x + size.width / 2 <= template.room.width - gap && added < quantity;
      x += size.width + gap
    ) {
      const occupied = objects.some((object) => {
        const other = footprint(
          products.find((item) => item.id === object.product_ref),
          object.rotation,
          object.scale
        );
        return (
          Math.abs(object.x - x) < (size.width + other.width) / 2 + gap / 2 &&
          Math.abs(object.z - z) < (size.depth + other.depth) / 2 + gap / 2
        );
      });
      if (!occupied) {
        objects.push({
          id: newId('object'),
          product_ref: product.id,
          x: Math.round(x * 100) / 100,
          z: Math.round(z * 100) / 100,
          rotation,
          scale: 1,
          locked: false,
        });
        added++;
      }
    }
  }
  return { objects, added };
}

function ScenePreview({
  template,
  products,
  selectedId,
  onSelect,
  onMove,
}: {
  template: SpaceTemplate;
  products: SpaceProduct[];
  selectedId: string;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, z: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; offsetX: number; offsetZ: number } | null>(null);
  const { width, depth } = template.room;
  function point(clientX: number, clientY: number) {
    const svg = ref.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  }
  function move(id: string, x: number, z: number) {
    const object = template.objects.find((item) => item.id === id);
    if (!object) return;
    const size = footprint(
      products.find((product) => product.id === object.product_ref),
      object.rotation,
      object.scale
    );
    const clamp = (value: number, edge: number, bound: number) =>
      Math.round(Math.max(edge / 2, Math.min(bound - edge / 2, value)) * 100) / 100;
    onMove(id, clamp(x, size.width, width), clamp(z, size.depth, depth));
  }
  return (
    <div className="overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
      <svg
        ref={ref}
        role="img"
        aria-label={`Plano equipado de ${template.name}`}
        viewBox={`-0.45 -0.45 ${Math.max(width, 0.1) + 0.9} ${Math.max(depth, 0.1) + 0.9}`}
        className="max-h-[420px] min-h-[220px] w-full touch-none"
        onPointerMove={(event) => {
          if (!drag.current) return;
          const cursor = point(event.clientX, event.clientY);
          move(drag.current.id, cursor.x - drag.current.offsetX, cursor.y - drag.current.offsetZ);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <rect
          width={Math.max(0.1, width)}
          height={Math.max(0.1, depth)}
          fill={template.room.floor_color}
          stroke={template.room.wall_color}
          strokeWidth={0.12}
        />
        {template.room.background_url && (
          <image
            href={template.room.background_url}
            width={width}
            height={depth}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.5}
          />
        )}
        <text x={width / 2} y={-0.18} textAnchor="middle" fontSize={0.18} fill="currentColor">
          {width} m
        </text>
        <text
          x={-0.2}
          y={depth / 2}
          textAnchor="middle"
          fontSize={0.18}
          fill="currentColor"
          transform={`rotate(-90,-0.2,${depth / 2})`}
        >
          {depth} m
        </text>
        {template.objects.map((object, index) => {
          const product = products.find((item) => item.id === object.product_ref);
          if (!product) return null;
          const size = product.dimensions ?? { width: 1, depth: 1 };
          const selected = object.id === selectedId;
          return (
            <g
              key={object.id}
              role="button"
              tabIndex={0}
              aria-label={`${product.label ?? product.product_id}, posición ${index + 1}${object.locked ? ', bloqueado para el cliente' : ''}. Usá las flechas para mover.`}
              transform={`translate(${object.x},${object.z}) rotate(${object.rotation}) scale(${object.scale ?? 1})`}
              style={{ cursor: 'grab', outline: 'none' }}
              onFocus={() => onSelect(object.id)}
              onPointerDown={(event) => {
                event.preventDefault();
                onSelect(object.id);
                const cursor = point(event.clientX, event.clientY);
                drag.current = {
                  id: object.id,
                  offsetX: cursor.x - object.x,
                  offsetZ: cursor.y - object.z,
                };
                ref.current?.setPointerCapture(event.pointerId);
              }}
              onKeyDown={(event) => {
                const directions: Record<string, [number, number]> = {
                  ArrowLeft: [-0.1, 0],
                  ArrowRight: [0.1, 0],
                  ArrowUp: [0, -0.1],
                  ArrowDown: [0, 0.1],
                };
                const delta = directions[event.key];
                if (delta) {
                  event.preventDefault();
                  move(object.id, object.x + delta[0], object.z + delta[1]);
                }
              }}
            >
              {product.asset?.shape === 'cylinder' ? (
                <ellipse
                  rx={size.width / 2}
                  ry={size.depth / 2}
                  fill={product.asset?.color ?? '#b9cdb0'}
                  stroke={selected ? '#2563eb' : '#718077'}
                  strokeWidth={selected ? 0.07 : 0.025}
                />
              ) : (
                <rect
                  x={-size.width / 2}
                  y={-size.depth / 2}
                  width={size.width}
                  height={size.depth}
                  rx={0.04}
                  fill={product.asset?.color ?? '#b9cdb0'}
                  stroke={selected ? '#2563eb' : '#718077'}
                  strokeWidth={selected ? 0.07 : 0.025}
                />
              )}
              {product.asset?.kind === 'image' && product.asset.url && (
                <image
                  href={product.asset.url}
                  x={-size.width / 2}
                  y={-size.depth / 2}
                  width={size.width}
                  height={size.depth}
                  preserveAspectRatio="xMidYMid meet"
                  pointerEvents="none"
                />
              )}
              <text
                x={0}
                y={0.065}
                textAnchor="middle"
                fontSize={0.16}
                fontWeight="bold"
                fill="#163126"
                stroke="white"
                strokeWidth={0.025}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {index + 1}
                {object.locked ? ' •' : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Arrastrá los objetos para ubicarlos. También podés usar las coordenadas o las flechas del
        teclado. El punto indica un objeto bloqueado para el cliente.
      </Text>
    </div>
  );
}

export function TemplateEditor({
  templates,
  products,
  onChange,
}: {
  templates: SpaceTemplate[];
  products: SpaceProduct[];
  onChange: (templates: SpaceTemplate[]) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState('');
  const [sceneRef, setSceneRef] = useState('');
  const [includedRef, setIncludedRef] = useState('');
  const [quantity, setQuantity] = useState(1);
  const template = templates.find((item) => item.id === templateId) ?? templates[0];
  const sceneProducts = products.filter((product) => product.placement === 'scene');
  const includedProducts = products.filter((product) => product.placement === 'included');
  const sceneProduct = sceneProducts.find((item) => item.id === sceneRef) ?? sceneProducts[0];
  const includedProduct =
    includedProducts.find((item) => item.id === includedRef) ?? includedProducts[0];

  function patch(input: Partial<SpaceTemplate>) {
    if (template)
      onChange(templates.map((item) => (item.id === template.id ? { ...item, ...input } : item)));
  }
  function patchObject(id: string, input: Partial<SpaceObject>) {
    if (template)
      patch({
        objects: template.objects.map((object) =>
          object.id === id ? { ...object, ...input } : object
        ),
      });
  }
  function create() {
    const next = emptyTemplate();
    onChange([...templates, next]);
    setTemplateId(next.id);
  }
  function duplicate() {
    if (!template) return;
    const next: SpaceTemplate = {
      ...structuredClone(template),
      id: newId('template'),
      name: `${template.name} (copia)`,
      objects: template.objects.map((object) => ({ ...object, id: newId('object') })),
    };
    onChange([...templates, next]);
    setTemplateId(next.id);
  }
  function remove() {
    if (
      !template ||
      !window.confirm(`¿Eliminar el template “${template.name}” de este configurador?`)
    )
      return;
    onChange(templates.filter((item) => item.id !== template.id));
    setTemplateId('');
  }
  function addScene() {
    if (!template || !sceneProduct || !Number.isInteger(quantity) || quantity < 1 || quantity > 200)
      return;
    const result = placeUnits(template, sceneProduct, products, quantity);
    if (result.added < quantity) {
      toast.error('No hay suficiente espacio libre', {
        description: `Entra${result.added === 1 ? '' : 'n'} ${result.added} de ${quantity} unidades. Reducí la cantidad o ampliá el espacio.`,
      });
      return;
    }
    patch({ objects: result.objects });
    setSelectedId(result.objects[result.objects.length - 1]?.id ?? '');
  }
  function addIncluded() {
    if (!template || !includedProduct) return;
    const existing = template.included_items.find(
      (item) => item.product_ref === includedProduct.id
    );
    patch({
      included_items: existing
        ? template.included_items.map((item) =>
            item.product_ref === includedProduct.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        : [...template.included_items, { product_ref: includedProduct.id, quantity: 1 }],
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level="h2">Templates prearmados</Heading>
          <Text size="small" className="max-w-2xl text-ui-fg-subtle">
            Cada template se abre con sus muebles posicionados y su equipamiento incluido. El
            cliente puede elegir uno y continuar sin armarlo desde cero.
          </Text>
        </div>
        <Button variant="secondary" onClick={create}>
          Nuevo template
        </Button>
      </div>
      {!templates.length ? (
        <Empty>Creá un template, definí sus medidas y agregá los productos que trae.</Empty>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {templates.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setTemplateId(item.id);
                  setSelectedId('');
                }}
                aria-pressed={template?.id === item.id}
                className={`rounded-lg border px-4 py-2 text-left text-sm ${template?.id === item.id ? 'border-ui-border-interactive bg-ui-bg-highlight text-ui-fg-interactive' : 'border-ui-border-base bg-ui-bg-base'}`}
              >
                <span className="block font-medium">{item.name || 'Sin nombre'}</span>
                <span className="text-xs">
                  {item.room.width} × {item.room.depth} m · {item.objects.length} objetos ·{' '}
                  {item.included_items.reduce((total, entry) => total + entry.quantity, 0)}{' '}
                  incluidos
                </span>
              </button>
            ))}
          </div>
          {template && (
            <>
              <div className="grid gap-6 xl:grid-cols-[minmax(250px,0.7fr)_minmax(400px,1.3fr)]">
                <div className="flex min-w-0 flex-col gap-4">
                  <Field label="Nombre del template">
                    <Input
                      aria-label="Nombre del template"
                      value={template.name}
                      onChange={(event) => patch({ name: event.target.value })}
                    />
                  </Field>
                  <Field label="Descripción">
                    <Textarea
                      aria-label="Descripción del template"
                      value={template.description ?? ''}
                      onChange={(event) => patch({ description: event.target.value })}
                    />
                  </Field>
                  <Field label="Imagen de portada del template">
                    <Input
                      aria-label="Imagen de portada del template"
                      type="url"
                      value={template.image_url ?? ''}
                      onChange={(event) => patch({ image_url: event.target.value })}
                      placeholder="https://…"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    {(['width', 'depth', 'height'] as const).map((key, index) => (
                      <NumberField
                        key={key}
                        label={['Ancho (m)', 'Profundidad (m)', 'Alto (m)'][index]}
                        value={template.room[key]}
                        min={1}
                        max={100}
                        onChange={(value) => patch({ room: { ...template.room, [key]: value } })}
                      />
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ColorField
                      label="Piso"
                      value={template.room.floor_color}
                      onChange={(value) =>
                        patch({ room: { ...template.room, floor_color: value } })
                      }
                    />
                    <ColorField
                      label="Paredes"
                      value={template.room.wall_color}
                      onChange={(value) => patch({ room: { ...template.room, wall_color: value } })}
                    />
                  </div>
                  <Field
                    label="Textura del piso"
                    help="Opcional. URL de la textura utilizada por el ambiente 3D."
                  >
                    <Input
                      aria-label="Textura del piso"
                      value={template.room.floor_texture_url ?? ''}
                      placeholder="https://… o /texturas/…"
                      onChange={(event) =>
                        patch({ room: { ...template.room, floor_texture_url: event.target.value } })
                      }
                    />
                  </Field>
                  <Field label="Textura de las paredes">
                    <Input
                      aria-label="Textura de las paredes"
                      value={template.room.wall_texture_url ?? ''}
                      placeholder="https://… o /texturas/…"
                      onChange={(event) =>
                        patch({ room: { ...template.room, wall_texture_url: event.target.value } })
                      }
                    />
                  </Field>
                  <Field
                    label="Imagen de fondo / piso"
                    help="Opcional. Se muestra dentro de las dimensiones del espacio."
                  >
                    <Input
                      aria-label="Imagen de fondo del espacio"
                      type="url"
                      value={template.room.background_url ?? ''}
                      onChange={(event) =>
                        patch({ room: { ...template.room, background_url: event.target.value } })
                      }
                      placeholder="https://…"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button size="small" variant="secondary" onClick={duplicate}>
                      Duplicar template
                    </Button>
                    <Button size="small" variant="danger" onClick={remove}>
                      Eliminar template
                    </Button>
                  </div>
                </div>
                <ScenePreview
                  template={template}
                  products={products}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onMove={(id, x, z) => patchObject(id, { x, z })}
                />
              </div>
              <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
                <Heading level="h3">
                  Objetos colocados <Badge size="xsmall">{template.objects.length}</Badge>
                </Heading>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1">
                    <Field label="Producto para colocar">
                      <select
                        aria-label="Producto para colocar"
                        className={selectClass}
                        value={sceneProduct?.id ?? ''}
                        onChange={(event) => setSceneRef(event.target.value)}
                      >
                        {!sceneProducts.length && (
                          <option value="">Primero habilitá productos ubicables</option>
                        )}
                        {sceneProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.label ?? product.product_id}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="w-28">
                    <NumberField
                      label="Unidades"
                      value={quantity}
                      min={1}
                      max={200}
                      step={1}
                      onChange={setQuantity}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    disabled={
                      !sceneProduct || !Number.isInteger(quantity) || quantity < 1 || quantity > 200
                    }
                    onClick={addScene}
                  >
                    Colocar unidades
                  </Button>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Las unidades se colocan automáticamente en el espacio libre. Revisá las medidas
                  reales y ajustá la distribución en el plano.
                </Text>
                {!template.objects.length ? (
                  <Empty>
                    Este template aún no tiene objetos. Agregá los muebles que debe traer
                    prearmados.
                  </Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b text-ui-fg-subtle">
                          <th className="p-2">Producto</th>
                          <th className="p-2">X (m)</th>
                          <th className="p-2">Z (m)</th>
                          <th className="p-2">Rotación</th>
                          <th className="p-2">Escala</th>
                          <th className="p-2">Bloqueado</th>
                          <th className="p-2">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.objects.map((object, index) => {
                          const product = products.find((item) => item.id === object.product_ref);
                          return (
                            <tr
                              key={object.id}
                              className={`border-b ${selectedId === object.id ? 'bg-ui-bg-highlight' : ''}`}
                            >
                              <td className="max-w-[200px] p-2">
                                <button
                                  type="button"
                                  className="text-left hover:underline"
                                  onClick={() => setSelectedId(object.id)}
                                >
                                  {index + 1}. {product?.label ?? object.product_ref}
                                </button>
                              </td>
                              <td className="w-24 p-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  aria-label={`X del objeto ${index + 1}`}
                                  value={object.x}
                                  onChange={(event) => {
                                    const x = event.target.valueAsNumber;
                                    if (Number.isFinite(x)) patchObject(object.id, { x });
                                  }}
                                />
                              </td>
                              <td className="w-24 p-2">
                                <Input
                                  type="number"
                                  step="0.1"
                                  aria-label={`Z del objeto ${index + 1}`}
                                  value={object.z}
                                  onChange={(event) => {
                                    const z = event.target.valueAsNumber;
                                    if (Number.isFinite(z)) patchObject(object.id, { z });
                                  }}
                                />
                              </td>
                              <td className="w-28 p-2">
                                <select
                                  aria-label={`Rotación del objeto ${index + 1}`}
                                  className={selectClass}
                                  value={object.rotation}
                                  onChange={(event) =>
                                    patchObject(object.id, { rotation: Number(event.target.value) })
                                  }
                                >
                                  {Array.from(
                                    new Set([
                                      ...(product?.allowed_rotations ?? [0, 90, 180, 270]),
                                      object.rotation,
                                    ])
                                  )
                                    .sort((a, b) => a - b)
                                    .map((value) => (
                                      <option key={value} value={value}>
                                        {value}°
                                      </option>
                                    ))}
                                </select>
                              </td>
                              <td className="w-24 p-2">
                                <Input
                                  aria-label={`Escala del objeto ${index + 1}`}
                                  type="number"
                                  min="0.25"
                                  max="4"
                                  step="0.1"
                                  value={object.scale ?? 1}
                                  onChange={(event) => {
                                    const scale = event.target.valueAsNumber;
                                    if (Number.isFinite(scale)) patchObject(object.id, { scale });
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  aria-label={`Bloquear objeto ${index + 1}`}
                                  checked={!!object.locked}
                                  onChange={(event) =>
                                    patchObject(object.id, { locked: event.target.checked })
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <Button
                                  variant="transparent"
                                  size="small"
                                  onClick={() =>
                                    patch({
                                      objects: template.objects.filter(
                                        (item) => item.id !== object.id
                                      ),
                                    })
                                  }
                                >
                                  Quitar
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
                <div>
                  <Heading level="h3">Equipamiento incluido</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    Se agrega al resumen y al carrito con el template, aunque no necesite una
                    posición en el plano.
                  </Text>
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    aria-label="Producto incluido para agregar"
                    className={`${selectClass} min-w-[220px] flex-1`}
                    value={includedProduct?.id ?? ''}
                    onChange={(event) => setIncludedRef(event.target.value)}
                  >
                    {!includedProducts.length && (
                      <option value="">Habilitá productos como equipamiento incluido</option>
                    )}
                    {includedProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.label ?? product.product_id}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" disabled={!includedProduct} onClick={addIncluded}>
                    Incluir producto
                  </Button>
                </div>
                {!template.included_items.length ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    Sin equipamiento adicional.
                  </Text>
                ) : (
                  template.included_items.map((item, index) => (
                    <div
                      key={item.product_ref}
                      className="flex flex-wrap items-center gap-3 border-t pt-3"
                    >
                      <Text className="min-w-[160px] flex-1">
                        {products.find((product) => product.id === item.product_ref)?.label ??
                          item.product_ref}
                      </Text>
                      <div className="w-28">
                        <Input
                          aria-label={`Cantidad incluida ${index + 1}`}
                          type="number"
                          min="1"
                          max="999"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => {
                            const next = event.target.valueAsNumber;
                            if (Number.isFinite(next))
                              patch({
                                included_items: template.included_items.map((entry) =>
                                  entry.product_ref === item.product_ref
                                    ? { ...entry, quantity: next }
                                    : entry
                                ),
                              });
                          }}
                        />
                      </div>
                      <Button
                        variant="transparent"
                        size="small"
                        onClick={() =>
                          patch({
                            included_items: template.included_items.filter(
                              (entry) => entry.product_ref !== item.product_ref
                            ),
                          })
                        }
                      >
                        Quitar
                      </Button>
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
