'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  LayoutGrid,
  LockKeyhole,
  Minus,
  Move,
  Package,
  Plus,
  RotateCw,
  Save,
  ShoppingBag,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useCartStore } from '@lib/stores/cart.store';
import {
  fitObject,
  readSavedDesign,
  resizeRoom,
  snapshotFromTemplate,
  summarizeDesign,
  type SavedSpaceDesign,
} from '@lib/space-designer/design';
import type {
  SpaceObject,
  SpaceProduct,
  SpacePublicConfigurator,
  SpaceSnapshot,
  SpaceTemplate,
} from '@lib/space-designer/types';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import styles from './space-designer.module.css';

const SpaceScene = dynamic(() => import('./space-scene'), {
  ssr: false,
  loading: () => (
    <div className={styles.sceneLoading} role="status">
      Preparando tu espacio en 3D…
    </div>
  ),
});

const money = (amount: number, currency = 'ars') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    amount
  );

export default function SpaceDesigner({
  configurator,
  countryCode,
}: {
  configurator: SpacePublicConfigurator;
  countryCode: string;
}) {
  const { config } = configurator;
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SpaceSnapshot | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const viewTopRef = useRef<HTMLDivElement>(null);
  const previousView = useRef(showTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<SavedSpaceDesign | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const storageKey = `space-design:v1:${configurator.id}:${countryCode}`;
  const templates = [...config.templates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const currentTemplate = templates.find((entry) => entry.id === templateId);
  const categories = Array.from(new Set(config.products.map((product) => product.category)));
  const selectedObject = snapshot?.objects.find((object) => object.id === selectedId);
  const selectedDefinition = config.products.find(
    (product) => product.id === selectedObject?.product_ref
  );
  const summary = useMemo(
    () => (snapshot ? summarizeDesign(snapshot, configurator) : []),
    [snapshot, configurator]
  );
  const units = summary.reduce((count, item) => count + item.quantity, 0);
  const currencies = new Set(summary.map((item) => item.variant?.currency_code).filter(Boolean));
  const unavailable = summary.some(
    (item) => !item.variant?.available || item.variant.calculated_amount === null
  );
  const total = summary.reduce(
    (amount, item) => amount + (item.variant?.calculated_amount ?? 0) * item.quantity,
    0
  );
  const currency =
    summary.find((item) => item.variant?.currency_code)?.variant?.currency_code || 'ars';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDraft(readSavedDesign(raw, configurator));
    } catch {
      /* Private browsing can disable local storage. */
    }
  }, [storageKey, configurator]);

  useEffect(() => {
    if (previousView.current === showTemplates) return;
    previousView.current = showTemplates;
    const frame = requestAnimationFrame(() => {
      viewTopRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [showTemplates]);

  const chooseTemplate = (template: SpaceTemplate) => {
    setTemplateId(template.id);
    setSnapshot(snapshotFromTemplate(template));
    setSelectedId(null);
    setShowTemplates(false);
    setError('');
    setNotice('El espacio ya está equipado. Podés revisar todo lo incluido.');
  };
  const save = () => {
    if (!snapshot || !templateId) return;
    const saved = {
      configurator_id: configurator.id,
      template_id: templateId,
      snapshot,
      saved_at: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
      setDraft(saved);
      setNotice('Diseño guardado en este navegador. Podés recuperarlo cuando vuelvas.');
      setError('');
    } catch {
      setError('Este navegador no permite guardar el diseño. Podés seguir y agregarlo al carrito.');
    }
  };
  const restore = () => {
    if (!draft) return;
    setSnapshot(JSON.parse(JSON.stringify(draft.snapshot)) as SpaceSnapshot);
    setTemplateId(draft.template_id);
    setSelectedId(null);
    setShowTemplates(false);
    setNotice('Recuperamos tu diseño guardado.');
    setError('');
  };
  const edit = (next: SpaceSnapshot) => {
    setSnapshot(next);
    setError('');
    setNotice('');
  };
  const move = (object: SpaceObject) => {
    if (!config.allow_custom || object.locked) return;
    setSnapshot((current) =>
      current
        ? {
            ...current,
            objects: current.objects.map((entry) => (entry.id === object.id ? object : entry)),
          }
        : current
    );
  };
  const remove = (id: string) => {
    if (
      !snapshot ||
      !config.allow_custom ||
      snapshot.objects.find((object) => object.id === id)?.locked
    )
      return;
    edit({ ...snapshot, objects: snapshot.objects.filter((object) => object.id !== id) });
    setSelectedId(null);
  };
  const rotate = (id: string) => {
    const object = snapshot?.objects.find((entry) => entry.id === id);
    const product = config.products.find((entry) => entry.id === object?.product_ref);
    if (!snapshot || !object || !product || object.locked || !config.allow_custom) return;
    const rotations = product.allowed_rotations?.length
      ? product.allowed_rotations
      : [0, 90, 180, 270];
    const next = rotations[(rotations.indexOf(object.rotation) + 1) % rotations.length]!;
    const fitted = fitObject({ ...object, rotation: next }, product, snapshot.room);
    if (fitted) move(fitted);
    else setError('El objeto no entra en el espacio con esa orientación.');
  };
  const addProduct = (product: SpaceProduct) => {
    if (!snapshot || !config.allow_custom) return;
    if (
      summary
        .filter((item) => item.definition?.variant_id === product.variant_id)
        .reduce((count, item) => count + item.quantity, 0) >= 999
    ) {
      setError('Podés incluir hasta 999 unidades de una misma variante.');
      return;
    }
    if (product.placement === 'included') {
      const existing = snapshot.included_items.find((item) => item.product_ref === product.id);
      if (!existing && snapshot.included_items.length >= 100) {
        setError('El diseño admite hasta 100 tipos de equipamiento incluido.');
        return;
      }
      edit({
        ...snapshot,
        included_items: existing
          ? snapshot.included_items.map((item) =>
              item.product_ref === product.id
                ? { ...item, quantity: Math.min(999, item.quantity + 1) }
                : item
            )
          : [...snapshot.included_items, { product_ref: product.id, quantity: 1 }],
      });
      return;
    }
    if (snapshot.objects.length >= 300) {
      setError('El diseño admite hasta 300 objetos en el plano.');
      return;
    }
    const object = fitObject(
      {
        id: crypto.randomUUID(),
        product_ref: product.id,
        x: snapshot.room.width / 2,
        z: snapshot.room.depth / 2,
        rotation: product.allowed_rotations?.[0] ?? 0,
      },
      product,
      snapshot.room
    );
    if (!object) {
      setError('Este producto no entra en las dimensiones del espacio.');
      return;
    }
    edit({ ...snapshot, objects: [...snapshot.objects, object] });
    setSelectedId(object.id);
  };
  const changeIncluded = (ref: string, delta: number) => {
    if (!snapshot || !config.allow_custom) return;
    if (delta > 0) {
      const definition = config.products.find((product) => product.id === ref);
      if (definition) addProduct(definition);
      return;
    }
    edit({
      ...snapshot,
      included_items: snapshot.included_items
        .map((item) =>
          item.product_ref === ref
            ? { ...item, quantity: Math.min(999, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0),
    });
  };
  const changeDimension = (dimension: 'width' | 'depth' | 'height', value: number) => {
    if (!snapshot || !config.allow_custom) return false;
    const resized = resizeRoom(snapshot, config.products, { ...snapshot.room, [dimension]: value });
    if (resized) {
      edit(resized);
      return true;
    }
    setError(
      'Usá una medida de 1 a 100 m en la que entren todos los objetos, incluidos los fijos.'
    );
    return false;
  };
  const addToCart = async () => {
    if (!snapshot || adding || unavailable || currencies.size > 1 || units === 0) return;
    setAdding(true);
    setError('');
    try {
      const response = await fetch('/api/store/space-designer/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode,
          configurator_id: configurator.id,
          template_id: templateId,
          snapshot,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.added)
        throw new Error(result.message || 'No pudimos agregar el diseño al carrito.');
      if (result.cart) useCartStore.getState().setCart(result.cart);
      else await useCartStore.getState().fetchCart();
      useCartStore.getState().openCart();
      setNotice('Todos los productos del diseño se agregaron al carrito.');
    } catch (failure) {
      setError(
        (failure as Error).message || 'No pudimos conectar con la tienda. Intentá de nuevo.'
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <LocalizedClientLink href="/espacios" className={styles.back}>
            <ArrowLeft size={15} /> Diseñadores de espacios
          </LocalizedClientLink>
          <h1>{configurator.title}</h1>
          <p>{config.description || 'Un espacio pensado por vos, con todo lo que necesitás.'}</p>
        </div>
        {!showTemplates && (
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setShowTemplates(true)}
            >
              <LayoutGrid size={16} /> Ver espacios
            </button>
            <button type="button" className={styles.secondaryButton} onClick={save}>
              <Save size={16} /> Guardar diseño
            </button>
          </div>
        )}
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          <Check size={16} /> {notice}
        </p>
      )}
      {showTemplates ? (
        <section className={styles.templateSection} aria-labelledby="space-template-heading">
          <div ref={viewTopRef} className={`${styles.sectionHeading} ${styles.viewStart}`}>
            <div>
              <span className={styles.eyebrow}>Tu punto de partida</span>
              <h2 id="space-template-heading">Elegí un espacio listo para usar</h2>
              <p>
                Cada propuesta ya incluye su distribución y equipamiento.
                {config.allow_custom ? ' Después podés adaptarla a lo que necesitás.' : ''}
              </p>
            </div>
            {snapshot && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setShowTemplates(false)}
              >
                Volver a mi diseño <ArrowRight size={16} />
              </button>
            )}
          </div>
          {draft && (
            <div className={styles.draft}>
              <div>
                <strong>Tenés un diseño guardado</strong>
                <span>
                  Guardado en este navegador el{' '}
                  {new Date(draft.saved_at).toLocaleDateString('es-AR')}.
                </span>
              </div>
              <button type="button" className={styles.secondaryButton} onClick={restore}>
                <Undo2 size={16} /> Recuperar diseño
              </button>
            </div>
          )}
          <div className={styles.templateGrid}>
            {templates.map((template) => {
              const count =
                template.objects.length +
                template.included_items.reduce((total, item) => total + item.quantity, 0);
              return (
                <button
                  type="button"
                  key={template.id}
                  className={styles.templateCard}
                  onClick={() => chooseTemplate(template)}
                >
                  <div className={styles.templatePreview}>
                    {template.image_url ? (
                      <img src={template.image_url} alt="" />
                    ) : (
                      <SpaceScene
                        preview
                        snapshot={snapshotFromTemplate(template)}
                        products={config.products}
                        catalog={configurator.catalog}
                      />
                    )}
                    <span className={styles.equippedBadge}>
                      <CheckCheck size={14} /> Equipado
                    </span>
                  </div>
                  <div className={styles.templateBody}>
                    <div className={styles.templateTitle}>
                      <h3>{template.name}</h3>
                      <ArrowRight size={20} />
                    </div>
                    <p>
                      {template.description ||
                        `${template.room.width} × ${template.room.depth} metros para dar forma a tus ideas.`}
                    </p>
                    <div className={styles.templateFacts}>
                      <span>
                        {template.room.width} × {template.room.depth} m
                      </span>
                      <span>{count} productos incluidos</span>
                    </div>
                    <span className={styles.chooseLabel}>
                      Usar este espacio <ArrowRight size={15} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {templates.length === 0 && (
            <div className={styles.emptyState}>
              <LayoutGrid size={32} />
              <h3>Estamos preparando nuevos espacios</h3>
              <p>Pronto vas a poder elegir una propuesta para empezar.</p>
            </div>
          )}
        </section>
      ) : (
        snapshot && (
          <div ref={viewTopRef} className={`${styles.editor} ${styles.viewStart}`}>
            <aside className={styles.catalog} aria-label="Productos para el espacio">
              <div className={styles.panelHeading}>
                <span className={styles.eyebrow}>Todo en su lugar</span>
                <h2>Productos y equipamiento</h2>
                <p>
                  {config.allow_custom
                    ? 'Agregá lo que necesitás a tu diseño.'
                    : 'Conocé los productos de esta propuesta.'}
                </p>
              </div>
              <div className={styles.catalogFilters}>
                <label className={styles.srOnly} htmlFor="space-product-search">
                  Buscar productos
                </label>
                <input
                  id="space-product-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar un producto"
                />
                <label className={styles.srOnly} htmlFor="space-category">
                  Categoría
                </label>
                <select
                  id="space-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.productList}>
                {config.products
                  .filter((entry) => category === 'all' || entry.category === category)
                  .filter((entry) =>
                    `${entry.label || ''} ${configurator.catalog.find((product) => product.id === entry.product_id)?.title || ''}`
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )
                  .map((definition) => {
                    const product = configurator.catalog.find(
                      (entry) => entry.id === definition.product_id
                    );
                    const variant = product?.variants.find(
                      (entry) => entry.id === definition.variant_id
                    );
                    const title = definition.label || product?.title || 'Producto no disponible';
                    const img =
                      definition.asset?.kind === 'image'
                        ? definition.asset.url
                        : product?.thumbnail;
                    return (
                      <article key={definition.id} className={styles.productCard}>
                        <div className={styles.productImage}>
                          {img ? <img src={img} alt="" loading="lazy" /> : <Package size={26} />}
                        </div>
                        <div className={styles.productInfo}>
                          <span className={styles.productCategory}>{definition.category}</span>
                          <h3>{title}</h3>
                          <p>
                            {definition.placement === 'scene'
                              ? 'Ubicalo en tu espacio'
                              : 'Equipamiento incluido'}
                          </p>
                          <div className={styles.productBottom}>
                            <strong>
                              {variant?.calculated_amount != null
                                ? money(
                                    variant.calculated_amount,
                                    variant.currency_code || currency
                                  )
                                : 'Sin precio'}
                            </strong>
                            {config.allow_custom && (
                              <button
                                type="button"
                                aria-label={`Agregar ${title}`}
                                disabled={!variant?.available}
                                onClick={() => addProduct(definition)}
                              >
                                <Plus size={17} />
                              </button>
                            )}
                          </div>
                          {!variant?.available && (
                            <span className={styles.unavailable}>No disponible</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
              </div>
            </aside>
            <main className={styles.workspace}>
              <div className={styles.canvasToolbar}>
                <div>
                  <span className={styles.eyebrow}>Tu espacio en 3D</span>
                  <h2>
                    {currentTemplate?.name || 'Tu espacio'}{' '}
                    <span>{(snapshot.room.width * snapshot.room.depth).toFixed(1)} m²</span>
                  </h2>
                </div>
                <span className={styles.canvasPill}>{units} productos incluidos</span>
              </div>
              <div className={styles.canvas}>
                <SpaceScene
                  snapshot={snapshot}
                  products={config.products}
                  catalog={configurator.catalog}
                  selectedId={selectedId}
                  interactive={config.allow_custom}
                  onSelect={setSelectedId}
                  onMove={move}
                  onRotate={rotate}
                  onDelete={remove}
                />
                {snapshot.objects.length === 0 && (
                  <div className={styles.canvasEmpty}>
                    <Move size={24} />
                    <p>
                      {config.allow_custom
                        ? 'Agregá un producto para empezar a diseñar.'
                        : 'Conocé el equipamiento de esta propuesta.'}
                    </p>
                  </div>
                )}
              </div>
              <div className={styles.objectToolbar}>
                {selectedObject ? (
                  <>
                    <span>
                      <strong>
                        {selectedDefinition?.label ||
                          configurator.catalog.find(
                            (entry) => entry.id === selectedDefinition?.product_id
                          )?.title ||
                          'Objeto'}
                      </strong>
                      <small>
                        {selectedObject.locked
                          ? 'Objeto fijo en esta propuesta'
                          : `${selectedObject.x.toFixed(1)} m · ${selectedObject.z.toFixed(1)} m · ${selectedObject.rotation}°`}
                      </small>
                    </span>
                    <div>
                      {selectedObject.locked ? (
                        <LockKeyhole size={18} />
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Rotar objeto seleccionado"
                            onClick={() => rotate(selectedObject.id)}
                          >
                            <RotateCw size={17} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label="Eliminar objeto seleccionado"
                            onClick={() => remove(selectedObject.id)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p>
                    <Move size={16} />{' '}
                    {config.allow_custom
                      ? 'Arrastrá para recorrer el ambiente. Seleccioná un mueble para moverlo o rotarlo.'
                      : 'Esta propuesta conserva su distribución y equipamiento.'}
                  </p>
                )}
              </div>
              <details className={styles.roomSettings}>
                <summary>
                  <span>Dimensiones y terminaciones</span>
                  <ChevronDown size={17} />
                </summary>
                <div className={styles.roomSettingsBody}>
                  <div className={styles.dimensionFields}>
                    {(['width', 'depth', 'height'] as const).map((dimension, index) => (
                      <label key={dimension}>
                        {['Ancho', 'Profundidad', 'Altura'][index]}
                        <div>
                          <input
                            key={`${templateId}-${snapshot.room[dimension]}`}
                            type="number"
                            min="1"
                            max="100"
                            step="0.1"
                            defaultValue={snapshot.room[dimension]}
                            disabled={!config.allow_custom}
                            onBlur={(event) => {
                              if (
                                Number(event.target.value) !== snapshot.room[dimension] &&
                                !changeDimension(dimension, Number(event.target.value))
                              ) {
                                event.currentTarget.value = String(snapshot.room[dimension]);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') event.currentTarget.blur();
                            }}
                          />
                          <span>m</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className={styles.finishes}>
                    {(['floors', 'walls'] as const).map((surface) => {
                      const key = surface === 'floors' ? 'floor_color' : 'wall_color';
                      const textureKey =
                        surface === 'floors' ? 'floor_texture_url' : 'wall_texture_url';
                      const choices = config.surface_options?.[surface] ?? [];
                      return (
                        <fieldset key={surface}>
                          <legend>{surface === 'floors' ? 'Piso' : 'Paredes'}</legend>
                          <div>
                            {choices.length ? (
                              choices.map((choice) => (
                                <button
                                  type="button"
                                  key={`${choice.label}:${choice.color}:${choice.texture_url ?? ''}`}
                                  disabled={!config.allow_custom}
                                  aria-label={`${surface === 'floors' ? 'Piso' : 'Paredes'}: ${choice.label}`}
                                  aria-pressed={
                                    snapshot.room[key] === choice.color &&
                                    (snapshot.room[textureKey] ?? '') === (choice.texture_url ?? '')
                                  }
                                  title={choice.label}
                                  style={{
                                    backgroundColor: choice.color,
                                    ...(choice.texture_url
                                      ? {
                                          backgroundImage: `url("${choice.texture_url}")`,
                                          backgroundSize: 'cover',
                                        }
                                      : {}),
                                  }}
                                  onClick={() =>
                                    edit({
                                      ...snapshot,
                                      room: {
                                        ...snapshot.room,
                                        [key]: choice.color,
                                        [textureKey]: choice.texture_url,
                                      },
                                    })
                                  }
                                >
                                  {snapshot.room[key] === choice.color &&
                                    (snapshot.room[textureKey] ?? '') ===
                                      (choice.texture_url ?? '') && <Check size={16} />}
                                </button>
                              ))
                            ) : (
                              <span className={styles.finishValue}>
                                <i style={{ backgroundColor: snapshot.room[key] }} /> Terminación de
                                la propuesta
                              </span>
                            )}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                </div>
              </details>
              <section className={styles.included} aria-labelledby="space-included-heading">
                <div>
                  <Package size={18} />
                  <h2 id="space-included-heading">Equipamiento incluido</h2>
                  <span>
                    {snapshot.included_items.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                </div>
                <p>
                  El equipamiento que acompaña la propuesta, con sus cantidades listas para comprar.
                </p>
                <div className={styles.includedGrid}>
                  {snapshot.included_items.map((item) => {
                    const definition = config.products.find(
                      (entry) => entry.id === item.product_ref
                    );
                    const product = configurator.catalog.find(
                      (entry) => entry.id === definition?.product_id
                    );
                    const title = definition?.label || product?.title || 'Producto no disponible';
                    return (
                      <article className={styles.includedItem} key={item.product_ref}>
                        <span className={styles.includedImage}>
                          {product?.thumbnail ? (
                            <img src={product.thumbnail} alt="" />
                          ) : (
                            <Package size={23} />
                          )}
                        </span>
                        <div>
                          <h3>{title}</h3>
                          <span>{definition?.category}</span>
                          <div className={styles.quantity}>
                            {config.allow_custom && (
                              <button
                                type="button"
                                aria-label={`Quitar una unidad de ${title}`}
                                onClick={() => changeIncluded(item.product_ref, -1)}
                              >
                                <Minus size={14} />
                              </button>
                            )}
                            <b>
                              {item.quantity}
                              {!config.allow_custom ? ' unidades' : ''}
                            </b>
                            {config.allow_custom && (
                              <button
                                type="button"
                                aria-label={`Sumar una unidad de ${title}`}
                                onClick={() => changeIncluded(item.product_ref, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {snapshot.included_items.length === 0 && (
                  <p className={styles.subtle}>
                    {config.allow_custom
                      ? 'Podés agregar equipamiento desde el catálogo de productos.'
                      : 'Esta propuesta no incluye equipamiento adicional.'}
                  </p>
                )}
              </section>
            </main>
            <aside className={styles.summary} aria-labelledby="space-summary-heading">
              <div className={styles.panelHeading}>
                <span className={styles.eyebrow}>Tu propuesta</span>
                <h2 id="space-summary-heading">Resumen del diseño</h2>
                <p>{units} productos en total</p>
              </div>
              <div className={styles.summaryItems}>
                {summary.map((item) => (
                  <div key={item.ref} className={styles.summaryItem}>
                    <span className={styles.summaryQuantity}>{item.quantity}×</span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>
                        {item.definition?.placement === 'included' ? 'Equipamiento' : 'Mobiliario'}
                        {item.variant?.title && item.variant.title !== 'Default variant'
                          ? ` · ${item.variant.title}`
                          : ''}
                      </small>
                      {!item.variant?.available && (
                        <span className={styles.unavailable}>No disponible</span>
                      )}
                    </div>
                    <b>
                      {item.variant?.calculated_amount != null
                        ? money(
                            item.variant.calculated_amount * item.quantity,
                            item.variant.currency_code || currency
                          )
                        : '—'}
                    </b>
                  </div>
                ))}
              </div>
              <div className={styles.summaryFooter}>
                <div className={styles.total}>
                  <span>Subtotal</span>
                  <strong>
                    {currencies.size <= 1 ? money(total, currency) : 'Revisar monedas'}
                  </strong>
                </div>
                <p>El envío y los descuentos se calculan en el carrito.</p>
                {unavailable && (
                  <p className={styles.checkoutIssue}>
                    Hay productos sin disponibilidad o precio.{' '}
                    {config.allow_custom
                      ? 'Quitalos o elegí otra propuesta para continuar.'
                      : 'Elegí otra propuesta para continuar.'}
                  </p>
                )}
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={adding || unavailable || currencies.size > 1 || units === 0}
                  onClick={addToCart}
                >
                  <ShoppingBag size={17} />
                  {adding ? 'Agregando al carrito…' : 'Agregar todo al carrito'}
                </button>
                <span className={styles.secureNote}>
                  <Check size={14} /> Los mismos productos y precios de la tienda
                </span>
              </div>
            </aside>
          </div>
        )
      )}
    </div>
  );
}
