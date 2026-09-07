import { Button, FocusModal, Heading, Input, Text, Textarea, toast } from '@medusajs/ui';
import { useState } from 'react';
import type { SpaceConfigurator, SpaceConfiguratorInput, SpaceProduct } from '../../types';
import { ConfiguratorSchema } from '../../validation';
import { errorMessage, saveConfigurator, useSalesChannels } from '../lib/api';
import { CatalogEditor } from './catalog-editor';
import { ColorField, Field, selectClass } from './fields';
import { placeUnits, TemplateEditor } from './template-editor';

type Tab = 'settings' | 'products' | 'templates';
const newConfigurator = (): SpaceConfiguratorInput => ({
  title: '',
  slug: '',
  status: 'draft',
  sales_channel_id: null,
  config: {
    version: 1,
    description: '',
    products: [],
    templates: [],
    allow_custom: true,
    surface_options: { floors: [], walls: [] },
  },
});
const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function validate(input: SpaceConfiguratorInput): { message: string; tab: Tab } | null {
  if (!input.title.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
    return {
      message: 'Completá el nombre y un slug con letras minúsculas, números y guiones.',
      tab: 'settings',
    };
  for (const product of input.config.products) {
    if (!product.category.trim())
      return {
        message: `Completá el grupo de ${product.label ?? 'cada producto'}.`,
        tab: 'products',
      };
    if (
      product.placement === 'scene' &&
      (!product.dimensions ||
        Object.values(product.dimensions).some((value) => !Number.isFinite(value) || value <= 0) ||
        product.allowed_rotations?.length === 0)
    )
      return {
        message: `Revisá las medidas y rotaciones de ${product.label ?? 'cada producto'}.`,
        tab: 'products',
      };
  }
  if (input.status === 'published' && !input.config.templates.length)
    return { message: 'Creá al menos un template prearmado antes de publicar.', tab: 'templates' };
  for (const template of input.config.templates) {
    if (
      !template.name.trim() ||
      [template.room.width, template.room.depth, template.room.height].some(
        (value) => !Number.isFinite(value) || value < 1 || value > 100
      )
    )
      return {
        message: `Revisá el nombre y las medidas del template “${template.name}”.`,
        tab: 'templates',
      };
    if (input.status === 'published' && !template.objects.length)
      return {
        message: `Agregá los objetos iniciales de “${template.name}”. Los templates publicados deben estar prearmados.`,
        tab: 'templates',
      };
    for (const [index, object] of template.objects.entries()) {
      const product = input.config.products.find((item) => item.id === object.product_ref);
      const scale = object.scale ?? 1;
      if (
        !product?.dimensions ||
        product.placement !== 'scene' ||
        scale < 0.25 ||
        scale > 4 ||
        !Number.isFinite(scale)
      )
        return {
          message: `Revisá el producto y la escala del objeto ${index + 1} de “${template.name}”.`,
          tab: 'templates',
        };
      const radians = (object.rotation * Math.PI) / 180;
      const width =
        (Math.abs(product.dimensions.width * Math.cos(radians)) +
          Math.abs(product.dimensions.depth * Math.sin(radians))) *
        scale;
      const depth =
        (Math.abs(product.dimensions.width * Math.sin(radians)) +
          Math.abs(product.dimensions.depth * Math.cos(radians))) *
        scale;
      if (
        (product.allowed_rotations && !product.allowed_rotations.includes(object.rotation)) ||
        object.x < width / 2 - 0.001 ||
        object.x > template.room.width - width / 2 + 0.001 ||
        object.z < depth / 2 - 0.001 ||
        object.z > template.room.depth - depth / 2 + 0.001
      )
        return {
          message: `El objeto ${index + 1} de “${template.name}” sale del espacio o tiene una rotación no permitida. Ajustá su posición o las medidas.`,
          tab: 'templates',
        };
    }
    if (
      template.included_items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          input.config.products.find((product) => product.id === item.product_ref)?.placement !==
            'included'
      )
    )
      return {
        message: `Revisá las cantidades y productos incluidos en “${template.name}”.`,
        tab: 'templates',
      };
  }
  return null;
}

export function ConfiguratorForm({
  configurator,
  onClose,
  onSaved,
}: {
  configurator: SpaceConfigurator | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [initial] = useState<SpaceConfiguratorInput>(() =>
    configurator
      ? {
          title: configurator.title,
          slug: configurator.slug,
          status: configurator.status,
          sales_channel_id: configurator.sales_channel_id,
          config: structuredClone(configurator.config),
        }
      : newConfigurator()
  );
  const [input, setInput] = useState<SpaceConfiguratorInput>(() => structuredClone(initial));
  const [tab, setTab] = useState<Tab>('settings');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { data: channels, error: channelsError } = useSalesChannels();
  const dirty = JSON.stringify(input) !== JSON.stringify(initial);
  function close() {
    if (!saving && (!dirty || window.confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')))
      onClose();
  }
  function configPatch(patch: Partial<SpaceConfiguratorInput['config']>) {
    setInput((current) => ({ ...current, config: { ...current.config, ...patch } }));
  }
  function changeProducts(products: SpaceProduct[]) {
    let templates = input.config.templates;
    for (const product of products) {
      const previous = input.config.products.find((item) => item.id === product.id);
      if (!previous || previous.placement === product.placement) continue;
      if (product.placement === 'included') {
        templates = templates.map((template) => {
          const quantity = template.objects.filter(
            (object) => object.product_ref === product.id
          ).length;
          const included = template.included_items.find((item) => item.product_ref === product.id);
          return {
            ...template,
            objects: template.objects.filter((object) => object.product_ref !== product.id),
            included_items: quantity
              ? [
                  ...template.included_items.filter((item) => item.product_ref !== product.id),
                  { product_ref: product.id, quantity: quantity + (included?.quantity ?? 0) },
                ]
              : template.included_items,
          };
        });
      } else {
        for (const template of templates) {
          const quantity =
            template.included_items.find((item) => item.product_ref === product.id)?.quantity ?? 0;
          if (quantity && placeUnits(template, product, products, quantity).added !== quantity) {
            toast.error(`No hay espacio para ubicar todas las unidades en “${template.name}”.`, {
              description:
                'Reducí las unidades incluidas o ampliá el template antes de cambiar su representación.',
            });
            return;
          }
        }
        templates = templates.map((template) => ({
          ...template,
          objects: placeUnits(
            template,
            product,
            products,
            template.included_items.find((item) => item.product_ref === product.id)?.quantity ?? 0
          ).objects,
          included_items: template.included_items.filter((item) => item.product_ref !== product.id),
        }));
      }
    }
    const sceneRefs = new Set(
      products.filter((product) => product.placement === 'scene').map((product) => product.id)
    );
    configPatch({
      products: products.map((product) =>
        product.asset?.anchor_product_ref && !sceneRefs.has(product.asset.anchor_product_ref)
          ? { ...product, asset: { ...product.asset, anchor_product_ref: undefined } }
          : product
      ),
      templates,
    });
  }
  function removeProduct(id: string) {
    const product = input.config.products.find((item) => item.id === id);
    if (
      !window.confirm(
        `¿Quitar “${product?.label ?? 'este producto'}” del diseñador y de todos sus templates?`
      )
    )
      return;
    configPatch({
      products: input.config.products
        .filter((item) => item.id !== id)
        .map((item) =>
          item.asset?.anchor_product_ref === id
            ? { ...item, asset: { ...item.asset, anchor_product_ref: undefined } }
            : item
        ),
      templates: input.config.templates.map((template) => ({
        ...template,
        objects: template.objects.filter((item) => item.product_ref !== id),
        included_items: template.included_items.filter((item) => item.product_ref !== id),
      })),
    });
  }
  async function save() {
    const normalized: SpaceConfiguratorInput = {
      ...input,
      title: input.title.trim(),
      config: {
        ...input.config,
        products: input.config.products.map((product) => ({
          ...product,
          label: product.label?.trim() || undefined,
          asset: product.asset
            ? { ...product.asset, url: product.asset.url?.trim() || undefined }
            : undefined,
        })),
        templates: input.config.templates.map((template) => ({
          ...template,
          image_url: template.image_url?.trim() || undefined,
          room: {
            ...template.room,
            background_url: template.room.background_url?.trim() || undefined,
            floor_texture_url: template.room.floor_texture_url?.trim() || undefined,
            wall_texture_url: template.room.wall_texture_url?.trim() || undefined,
          },
        })),
        surface_options: input.config.surface_options
          ? Object.fromEntries(
              Object.entries(input.config.surface_options).map(([kind, options]) => [
                kind,
                options?.map((option) => ({
                  ...option,
                  texture_url: option.texture_url?.trim() || undefined,
                })),
              ])
            )
          : undefined,
      },
    };
    const issue = validate(normalized);
    if (issue) {
      setError(issue.message);
      setTab(issue.tab);
      return;
    }
    const parsed = ConfiguratorSchema.safeParse(normalized);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path ?? [];
      setTab(
        path.includes('templates')
          ? 'templates'
          : path.includes('products')
            ? 'products'
            : 'settings'
      );
      setError(
        `Revisá los campos obligatorios, las medidas, las URLs y los colores (#RRGGBB). ${issue?.message ?? ''}`
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveConfigurator(configurator?.id, parsed.data);
      toast.success('Diseñador guardado');
      onSaved();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }
  function surfaceOptions(kind: 'floors' | 'walls') {
    const options = input.config.surface_options?.[kind] ?? [];
    const title = kind === 'floors' ? 'Pisos disponibles' : 'Paredes disponibles';
    function change(value: typeof options) {
      configPatch({ surface_options: { ...input.config.surface_options, [kind]: value } });
    }
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
        <div className="flex items-center justify-between gap-2">
          <Heading level="h3">{title}</Heading>
          <Button
            variant="secondary"
            size="small"
            onClick={() => change([...options, { label: 'Nueva terminación', color: '#d6e4da' }])}
          >
            Agregar opción
          </Button>
        </div>
        {!options.length && (
          <Text size="small" className="text-ui-fg-subtle">
            Se usa la terminación inicial de cada template.
          </Text>
        )}
        {options.map((option, index) => (
          <div key={index} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[160px] flex-1">
              <Field label="Nombre">
                <Input
                  aria-label={`${title}: nombre ${index + 1}`}
                  value={option.label}
                  onChange={(event) =>
                    change(
                      options.map((entry, i) =>
                        i === index ? { ...entry, label: event.target.value } : entry
                      )
                    )
                  }
                />
              </Field>
            </div>
            <div className="w-44">
              <ColorField
                label={`${kind === 'floors' ? 'Piso' : 'Pared'} ${index + 1}`}
                value={option.color}
                onChange={(color) =>
                  change(options.map((entry, i) => (i === index ? { ...entry, color } : entry)))
                }
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <Field label="URL de textura (opcional)">
                <Input
                  aria-label={`${title}: textura ${index + 1}`}
                  value={option.texture_url ?? ''}
                  placeholder="https://… o /texturas/…"
                  onChange={(event) =>
                    change(
                      options.map((entry, i) =>
                        i === index ? { ...entry, texture_url: event.target.value } : entry
                      )
                    )
                  }
                />
              </Field>
            </div>
            <Button
              variant="transparent"
              size="small"
              onClick={() => change(options.filter((_, i) => i !== index))}
            >
              Quitar
            </Button>
          </div>
        ))}
      </section>
    );
  }

  return (
    <FocusModal
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <Heading>
              {configurator ? `Editar ${configurator.title}` : 'Nuevo diseñador de espacios'}
            </Heading>
          </FocusModal.Title>
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={saving} onClick={close}>
              Cancelar
            </Button>
            <Button isLoading={saving} disabled={saving} onClick={save}>
              Guardar diseñador
            </Button>
          </div>
        </FocusModal.Header>
        <FocusModal.Body className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="flex shrink-0 flex-wrap gap-1 border-b border-ui-border-base px-6 pt-3"
            role="tablist"
            aria-label="Configuración del diseñador"
          >
            {(
              [
                { id: 'settings', label: 'Configuración' },
                { id: 'products', label: `Productos (${input.config.products.length})` },
                { id: 'templates', label: `Templates (${input.config.templates.length})` },
              ] as const
            ).map((item) => (
              <button
                type="button"
                key={item.id}
                role="tab"
                id={`space-tab-${item.id}`}
                aria-controls={`space-panel-${item.id}`}
                aria-selected={tab === item.id}
                className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === item.id ? 'border-ui-border-interactive text-ui-fg-interactive' : 'border-transparent text-ui-fg-subtle'}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {error && (
            <div
              role="alert"
              className="shrink-0 border-b border-ui-border-error bg-ui-bg-error p-4 text-sm text-ui-fg-error"
            >
              {error}
            </div>
          )}
          <div
            role="tabpanel"
            id={`space-panel-${tab}`}
            aria-labelledby={`space-tab-${tab}`}
            className="min-h-0 flex-1 overflow-y-auto p-6"
          >
            <div className="mx-auto max-w-[1300px]">
              {tab === 'settings' && (
                <div className="mx-auto flex max-w-4xl flex-col gap-6">
                  <Text className="text-ui-fg-subtle">
                    Configurá la experiencia, elegí productos del catálogo y prepará los espacios
                    que podrá seleccionar el cliente.
                  </Text>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre">
                      <Input
                        aria-label="Nombre del diseñador"
                        value={input.title}
                        onChange={(event) => {
                          const title = event.target.value;
                          setInput((current) => ({
                            ...current,
                            title,
                            slug:
                              !configurator && current.slug === slugify(current.title)
                                ? slugify(title)
                                : current.slug,
                          }));
                        }}
                        placeholder="Diseñá tu espacio"
                      />
                    </Field>
                    <Field label="Slug" help="Se usa en la dirección pública del diseñador.">
                      <Input
                        aria-label="Slug del diseñador"
                        value={input.slug}
                        onChange={(event) =>
                          setInput((current) => ({ ...current, slug: event.target.value }))
                        }
                        placeholder="disena-tu-espacio"
                      />
                    </Field>
                  </div>
                  <Field label="Descripción">
                    <Textarea
                      aria-label="Descripción del diseñador"
                      value={input.config.description ?? ''}
                      onChange={(event) => configPatch({ description: event.target.value })}
                      rows={3}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Estado" help="Solo los publicados aparecen en la tienda.">
                      <select
                        aria-label="Estado del diseñador"
                        className={selectClass}
                        value={input.status}
                        onChange={(event) =>
                          setInput((current) => ({
                            ...current,
                            status: event.target.value as SpaceConfiguratorInput['status'],
                          }))
                        }
                      >
                        <option value="draft">Borrador / inactivo</option>
                        <option value="published">Publicado / activo</option>
                      </select>
                    </Field>
                    <Field
                      label="Canal de venta"
                      help="El catálogo y los productos publicados deben estar disponibles en este canal."
                    >
                      <select
                        aria-label="Canal de venta"
                        className={selectClass}
                        value={input.sales_channel_id ?? ''}
                        onChange={(event) =>
                          setInput((current) => ({
                            ...current,
                            sales_channel_id: event.target.value || null,
                          }))
                        }
                      >
                        <option value="">Todos los canales</option>
                        {input.sales_channel_id &&
                          !channels?.sales_channels.some(
                            (channel) => channel.id === input.sales_channel_id
                          ) && (
                            <option value={input.sales_channel_id}>{input.sales_channel_id}</option>
                          )}
                        {channels?.sales_channels.map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.name}
                          </option>
                        ))}
                      </select>
                      {channelsError && (
                        <Text role="alert" className="text-ui-fg-error">
                          {errorMessage(channelsError)}
                        </Text>
                      )}
                    </Field>
                  </div>
                  <label className="flex items-start gap-3 rounded-lg border border-ui-border-base p-4 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={input.config.allow_custom}
                      onChange={(event) => configPatch({ allow_custom: event.target.checked })}
                    />
                    <span>
                      <span className="block font-medium">Permitir personalizar espacios</span>
                      <span className="text-ui-fg-subtle">
                        El cliente puede modificar los templates o comenzar con sus propias medidas.
                        Si lo desactivás, se utilizan las predefinidas tal como las publicaste.
                      </span>
                    </span>
                  </label>
                  <div>
                    <Heading level="h2">Terminaciones</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      Opciones que el cliente puede elegir. Cada template conserva su piso y sus
                      paredes iniciales.
                    </Text>
                  </div>
                  {surfaceOptions('floors')}
                  {surfaceOptions('walls')}
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={() => setTab('products')}>
                      Elegir productos del catálogo
                    </Button>
                  </div>
                </div>
              )}
              {tab === 'products' && (
                <CatalogEditor
                  products={input.config.products}
                  channel={input.sales_channel_id}
                  onChange={changeProducts}
                  onRemove={removeProduct}
                />
              )}
              {tab === 'templates' && (
                <TemplateEditor
                  templates={input.config.templates}
                  products={input.config.products}
                  onChange={(templates) => configPatch({ templates })}
                />
              )}
            </div>
          </div>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
}
