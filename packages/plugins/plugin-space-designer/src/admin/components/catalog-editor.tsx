import { Badge, Button, Heading, Input, Text } from '@medusajs/ui';
import { useEffect, useState } from 'react';
import type { SpaceAsset, SpaceCatalogProduct, SpaceProduct } from '../../types';
import { errorMessage, useCatalog } from '../lib/api';
import { ColorField, Empty, Field, newId, NumberField, selectClass } from './fields';

export function CatalogEditor({
  products,
  channel,
  onChange,
  onRemove,
}: {
  products: SpaceProduct[];
  channel: string | null;
  onChange: (products: SpaceProduct[]) => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(products[0]?.id ?? '');
  const [variants, setVariants] = useState<Record<string, string>>({});
  const { data, isPending, error } = useCatalog(debounced, offset, channel);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const selected = products.find((product) => product.id === selectedId);
  function patch(input: Partial<SpaceProduct>) {
    onChange(
      products.map((product) => (product.id === selectedId ? { ...product, ...input } : product))
    );
  }
  function add(product: SpaceCatalogProduct) {
    const variant = product.variants.find(
      (item) => item.id === (variants[product.id] ?? product.variants[0]?.id)
    );
    if (!variant) return;
    const existing = products.find((item) => item.variant_id === variant.id);
    if (existing) {
      setSelectedId(existing.id);
      return;
    }
    const entry: SpaceProduct = {
      id: newId('product'),
      product_id: product.id,
      variant_id: variant.id,
      label: `${product.title}${product.variants.length > 1 ? ` · ${variant.title}` : ''}`,
      placement: 'scene',
      category: 'Productos',
      dimensions: { width: 1, depth: 0.6, height: 0.8 },
      asset: product.thumbnail
        ? { kind: 'image', url: product.thumbnail, color: '#b9cdb0' }
        : { kind: 'primitive', shape: 'box', color: '#b9cdb0' },
      allowed_rotations: [0, 90, 180, 270],
    };
    onChange([...products, entry]);
    setSelectedId(entry.id);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(360px,1.2fr)]">
      <section className="flex min-w-0 flex-col gap-4">
        <div>
          <Heading level="h2">Catálogo de la tienda</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Buscá cualquier producto: muebles, tecnología, herramientas o accesorios. Elegí la
            variante que se agregará al carrito.
          </Text>
        </div>
        <Input
          aria-label="Buscar productos del catálogo"
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {error && (
          <Text role="alert" className="text-ui-fg-error">
            {errorMessage(error)}
          </Text>
        )}
        {isPending ? (
          <Text role="status">Cargando productos…</Text>
        ) : !data?.products.length ? (
          <Empty>No se encontraron productos en este canal.</Empty>
        ) : (
          <div className="divide-y rounded-lg border border-ui-border-base">
            {data.products.map((product) => {
              const variantId = variants[product.id] ?? product.variants[0]?.id;
              const exists = products.some((entry) => entry.variant_id === variantId);
              return (
                <div key={product.id} className="flex gap-3 p-3">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded border object-contain"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-ui-bg-subtle text-xs text-ui-fg-muted">
                      Imagen
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Text weight="plus">{product.title}</Text>
                    <select
                      aria-label={`Variante de ${product.title}`}
                      className={selectClass}
                      value={variantId ?? ''}
                      onChange={(event) =>
                        setVariants((current) => ({ ...current, [product.id]: event.target.value }))
                      }
                    >
                      {!product.variants.length && <option value="">Sin variantes</option>}
                      {product.variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.title}
                          {variant.sku ? ` · ${variant.sku}` : ''}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={!variantId}
                      onClick={() => add(product)}
                    >
                      {exists ? 'Editar producto agregado' : 'Habilitar en el espacio'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <Text size="small" className="text-ui-fg-subtle">
            {data?.count ?? 0} productos
          </Text>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={offset === 0 || isPending}
              onClick={() => setOffset(Math.max(0, offset - 8))}
            >
              Anterior
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={isPending || offset + 8 >= (data?.count ?? 0)}
              onClick={() => setOffset(offset + 8)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>
      <section className="flex min-w-0 flex-col gap-4">
        <div>
          <Heading level="h2">
            Productos habilitados <Badge size="xsmall">{products.length}</Badge>
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Definí la representación 3D de cada producto. El equipamiento incluido se distribuye
            automáticamente según su montaje y anclaje, conservando sus cantidades.
          </Text>
        </div>
        {!products.length ? (
          <Empty>Habilitá productos del catálogo para equipar los templates.</Empty>
        ) : (
          <>
            <select
              aria-label="Editar producto habilitado"
              className={selectClass}
              value={selected?.id ?? ''}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              <option value="" disabled>
                Elegí un producto
              </option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label ?? product.product_id}
                </option>
              ))}
            </select>
            {selected && (
              <div className="flex flex-col gap-4 rounded-lg border border-ui-border-base p-4">
                <Field label="Nombre en el espacio">
                  <Input
                    aria-label="Nombre en el espacio"
                    value={selected.label ?? ''}
                    onChange={(event) => patch({ label: event.target.value })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Grupo del catálogo"
                    help="Podés crear cualquier grupo para organizar los productos."
                  >
                    <Input
                      aria-label="Grupo del catálogo"
                      value={selected.category}
                      onChange={(event) => patch({ category: event.target.value })}
                      placeholder="Mobiliario, tecnología…"
                    />
                  </Field>
                  <Field label="Representación">
                    <select
                      aria-label="Representación del producto"
                      className={selectClass}
                      value={selected.placement}
                      onChange={(event) =>
                        patch({
                          placement: event.target.value as SpaceProduct['placement'],
                          ...(event.target.value === 'scene' && !selected.dimensions
                            ? { dimensions: { width: 1, depth: 0.6, height: 0.8 } }
                            : {}),
                        })
                      }
                    >
                      <option value="scene">Ubicable en el plano</option>
                      <option value="included">Equipamiento incluido</option>
                    </select>
                  </Field>
                </div>
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {(['width', 'depth', 'height'] as const).map((key, index) => (
                      <NumberField
                        key={key}
                        label={['Ancho (m)', 'Profundidad (m)', 'Alto (m)'][index]}
                        min={0.01}
                        step={0.01}
                        value={selected.dimensions?.[key] ?? 0.6}
                        onChange={(value) =>
                          patch({
                            dimensions: {
                              ...(selected.dimensions ?? { width: 0.6, depth: 0.6, height: 0.6 }),
                              [key]: value,
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                  <Field label="Representación visual 3D">
                    <select
                      aria-label="Tipo de asset visual"
                      className={selectClass}
                      value={selected.asset?.kind ?? 'primitive'}
                      onChange={(event) =>
                        patch({
                          asset: {
                            ...selected.asset,
                            kind: event.target.value as 'image' | 'primitive' | 'glb',
                          },
                        })
                      }
                    >
                      <option value="image">Imagen de referencia</option>
                      <option value="primitive">Modelo paramétrico</option>
                      <option value="glb">Modelo 3D GLB</option>
                    </select>
                  </Field>
                  {selected.asset && selected.asset.kind !== 'primitive' && (
                    <Field
                      label="URL del asset"
                      help={
                        selected.asset?.kind === 'glb'
                          ? 'Archivo GLB servido por tu tienda o CDN con acceso CORS. Se ajusta a las dimensiones del producto.'
                          : 'Imagen de referencia del producto. Elegí un modelo paramétrico para definir su representación 3D.'
                      }
                    >
                      <Input
                        aria-label="URL del asset"
                        type="url"
                        value={selected.asset?.url ?? ''}
                        onChange={(event) =>
                          patch({ asset: { ...selected.asset!, url: event.target.value } })
                        }
                      />
                    </Field>
                  )}
                  <Field
                    label="Modelo paramétrico"
                    help="Se usa para la geometría integrada y como respaldo si un archivo GLB no carga."
                  >
                    <select
                      aria-label="Modelo paramétrico"
                      className={selectClass}
                      value={selected.asset?.model ?? ''}
                      onChange={(event) =>
                        patch({
                          asset: {
                            kind: 'primitive',
                            ...selected.asset,
                            model: (event.target.value || undefined) as SpaceAsset['model'],
                          },
                        })
                      }
                    >
                      <option value="">Forma básica</option>
                      <option value="table">Mesa</option>
                      <option value="desk">Escritorio</option>
                      <option value="hex-table-set">Conjunto de mesas hexagonal</option>
                      <option value="shelving">Estantería</option>
                      <option value="cabinet">Armario</option>
                      <option value="chair">Silla</option>
                      <option value="computer">Computadora</option>
                      <option value="projector">Proyector</option>
                      <option value="robotics-kit">Kit de robótica</option>
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Forma de respaldo">
                      <select
                        aria-label="Forma de respaldo"
                        className={selectClass}
                        value={selected.asset?.shape ?? 'box'}
                        onChange={(event) =>
                          patch({
                            asset: {
                              kind: 'primitive',
                              ...selected.asset,
                              shape: event.target.value as 'box' | 'cylinder',
                            },
                          })
                        }
                      >
                        <option value="box">Rectangular</option>
                        <option value="cylinder">Circular</option>
                      </select>
                    </Field>
                    <ColorField
                      label="Color del producto"
                      value={selected.asset?.color ?? '#b9cdb0'}
                      onChange={(color) =>
                        patch({ asset: { kind: 'primitive', ...selected.asset, color } })
                      }
                    />
                    <ColorField
                      label="Color secundario"
                      value={selected.asset?.accent_color ?? '#454a50'}
                      onChange={(accent_color) =>
                        patch({ asset: { kind: 'primitive', ...selected.asset, accent_color } })
                      }
                    />
                    <Field label="Montaje">
                      <select
                        aria-label="Montaje"
                        className={selectClass}
                        value={selected.asset?.mount ?? 'floor'}
                        onChange={(event) =>
                          patch({
                            asset: {
                              kind: 'primitive',
                              ...selected.asset,
                              mount: event.target.value as SpaceAsset['mount'],
                            },
                          })
                        }
                      >
                        <option value="floor">Sobre el piso</option>
                        <option value="surface">Sobre un mueble</option>
                        <option value="wall">En la pared</option>
                        <option value="ceiling">En el techo</option>
                      </select>
                    </Field>
                  </div>
                  {selected.asset?.mount === 'surface' && (
                    <Field
                      label="Mueble de anclaje"
                      help="El equipamiento incluido se reparte sobre las unidades presentes de este mueble."
                    >
                      <select
                        aria-label="Mueble de anclaje"
                        className={selectClass}
                        value={selected.asset.anchor_product_ref ?? ''}
                        onChange={(event) =>
                          patch({
                            asset: {
                              ...selected.asset!,
                              anchor_product_ref: event.target.value || undefined,
                            },
                          })
                        }
                      >
                        <option value="">Distribución automática</option>
                        {products
                          .filter(
                            (product) => product.placement === 'scene' && product.id !== selected.id
                          )
                          .map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.label ?? product.id}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
                  {selected.placement === 'scene' && (
                    <Field label="Rotaciones permitidas">
                      <div className="flex flex-wrap gap-4">
                        {Array.from(
                          new Set([0, 90, 180, 270, ...(selected.allowed_rotations ?? [])])
                        )
                          .sort((a, b) => a - b)
                          .map((rotation) => (
                            <label key={rotation} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={(selected.allowed_rotations ?? [0, 90, 180, 270]).includes(
                                  rotation
                                )}
                                onChange={(event) => {
                                  const rotations = selected.allowed_rotations ?? [0, 90, 180, 270];
                                  patch({
                                    allowed_rotations: event.target.checked
                                      ? [...rotations, rotation]
                                      : rotations.filter((value) => value !== rotation),
                                  });
                                }}
                              />
                              {rotation}°
                            </label>
                          ))}
                      </div>
                    </Field>
                  )}
                </>
                <Text size="xsmall" className="break-all text-ui-fg-muted">
                  Variante: {selected.variant_id}
                </Text>
                <Button variant="danger" size="small" onClick={() => onRemove(selected.id)}>
                  Quitar del espacio
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
