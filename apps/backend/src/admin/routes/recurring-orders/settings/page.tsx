import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  type FrequencyDiscount,
  type RecurringScope,
  useDeleteRecurringOffer,
  useProductCategoriesList,
  useProductSearch,
  useProductsByIds,
  useProductTagsList,
  useRecurringOffers,
  useRecurringSettings,
  useSalesChannelsList,
  useSaveRecurringOffer,
  useSaveRecurringSettings,
} from '../../../hooks/api/recurring-orders';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SettingLabel } from '../../../components/common/setting-label';
import { useActiveSite } from '../../../hooks/use-active-site';
import { SingleColumnLayout } from '../../../components/layouts/single-column';
import { SubscriptionSectionNav } from '../section-nav';

const GLOBAL = '__global__';

/**
 * Las tres secciones del motor. Van en cards SEPARADAS de la configuración de
 * arriba a propósito, y la diferencia no es visual: lo de arriba se guarda por
 * canal de venta en `recurring_setting`, esto se guarda una sola vez para toda la
 * instalación. Meterlos en el mismo formulario, debajo del mismo selector de
 * alcance, haría creer que también se aplican al canal elegido.
 *
 * Los cinco valores de "Reintentos" y "Pago" son justamente los que
 * `recurring_setting` puede pisar por canal (`runtime-config.ts:48-72`): acá se
 * edita el piso, arriba la excepción.
 */
const ENGINE_SECTIONS: { title: string; groups: string[]; description: string }[] = [
  {
    title: 'Motor de renovaciones',
    groups: ['Suscripciones', 'Operación'],
    // UNA oración. Que para apagar las recurrentes en una tienda puntual está el
    // toggle de esa tienda es la sección "Tres capas, y la de abajo es la que se
    // edita acá" del drawer, que además dibuja las tres — cosa que en un renglón
    // no entraba.
    description: 'Interruptor general y cuánto procesa cada corrida del cron.',
  },
  {
    title: 'Reintentos y cobro',
    groups: ['Reintentos', 'Pago'],
    // UNA oración, y se queda la que ubica esta card respecto del formulario de
    // arriba: sin eso, dos pantallas de los mismos cinco valores en la misma
    // página se leen como una duplicación. El mecanismo de herencia completo está
    // en la misma sección del drawer.
    description:
      'Valores BASE de la instalación, que cada canal de venta puede pisar desde la configuración de arriba.',
  },
];

/**
 * Las tres frecuencias que ofrece el storefront. Los % del form se mapean a
 * este shape exacto (interval + count) que persiste el backend.
 */
const FREQUENCY_PRESETS = [
  { key: 'weekly', label: 'Semanal', interval: 'week', count: 1 },
  { key: 'biweekly', label: 'Quincenal', interval: 'week', count: 2 },
  { key: 'monthly', label: 'Mensual', interval: 'month', count: 1 },
] as const;

type PctByPreset = Record<string, string>;

function toIntOrNull(value: string | undefined): number | null {
  const n = Number(value);
  return value && Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function discountsToForm(discounts: FrequencyDiscount[] | undefined): PctByPreset {
  const form: PctByPreset = {};
  for (const preset of FREQUENCY_PRESETS) {
    const match = (discounts ?? []).find(
      (d) => d.interval === preset.interval && d.count === preset.count
    );
    form[preset.key] = match ? String(match.percentage) : '';
  }
  return form;
}

function formToDiscounts(form: PctByPreset): FrequencyDiscount[] {
  return FREQUENCY_PRESETS.flatMap((preset) => {
    const pct = Number(form[preset.key]);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 90) return [];
    return [{ interval: preset.interval, count: preset.count, percentage: pct }];
  });
}

/** Fila de inputs % por frecuencia (reusada por la base del canal y los overrides). */
function DiscountInputs({
  value,
  onChange,
  compact,
}: {
  value: PctByPreset;
  onChange: (next: PctByPreset) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {FREQUENCY_PRESETS.map((preset) => (
        <div className="flex flex-1 flex-col gap-y-1" key={preset.key}>
          {!compact && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              {preset.label}
            </Text>
          )}
          <div className="relative">
            <Input
              min={0}
              max={90}
              onChange={(e) => onChange({ ...value, [preset.key]: e.target.value })}
              placeholder={compact ? preset.label : '0'}
              size="small"
              type="number"
              value={value[preset.key] ?? ''}
            />
            <span className="-translate-y-1/2 absolute top-1/2 right-2 text-ui-fg-subtle text-xs">
              %
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Configuración de compras recurrentes por sales channel (o la global por
 * defecto): elegibilidad, ofertas, retención y políticas de renovación.
 */
const RecurringSettingsPage = () => {
  const [channel, setChannel] = useState<string>(GLOBAL);
  const salesChannelId = channel === GLOBAL ? null : channel;

  // Sólo para rotular la opción "Predeterminada": con tienda activa NO es global.
  const { activeSite } = useActiveSite();

  const { data: channelsData } = useSalesChannelsList();
  const { data, isPending } = useRecurringSettings(salesChannelId);
  const save = useSaveRecurringSettings();

  const [scope, setScope] = useState<RecurringScope>('all');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagValues, setTagValues] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [discountForm, setDiscountForm] = useState<PctByPreset>({});
  const [retentionPct, setRetentionPct] = useState('');
  const [retentionCycles, setRetentionCycles] = useState('');
  const [policies, setPolicies] = useState<Record<string, string>>({});

  // Re-seed del form al cambiar de canal o llegar la data: fila propia del
  // canal, o (para visualizar el fallback efectivo) la global, o "all".
  useEffect(() => {
    const effective = data?.setting ?? data?.global_setting ?? null;
    setScope(effective?.scope ?? 'all');
    setCategoryIds(effective?.category_ids ?? []);
    setTagValues(effective?.tag_values ?? []);
    setProductIds(effective?.product_ids ?? []);
    setDiscountForm(discountsToForm(effective?.frequency_discounts));
    setRetentionPct(
      effective?.retention_discount ? String(effective.retention_discount.percentage) : ''
    );
    setRetentionCycles(
      effective?.retention_discount ? String(effective.retention_discount.cycles) : ''
    );
    setPolicies({
      reminder_hours: effective?.reminder_hours ? String(effective.reminder_hours) : '',
      expiration_hours: effective?.expiration_hours ? String(effective.expiration_hours) : '',
      max_attempts: effective?.max_attempts ? String(effective.max_attempts) : '',
      retry_hours: effective?.retry_hours ? String(effective.retry_hours) : '',
      max_consecutive_failures: effective?.max_consecutive_failures
        ? String(effective.max_consecutive_failures)
        : '',
      stock_policy: effective?.stock_policy ?? '',
      price_change_policy: effective?.price_change_policy ?? '',
      price_change_threshold_pct: effective?.price_change_threshold_pct
        ? String(effective.price_change_threshold_pct)
        : '',
    });
  }, [data]);

  const handleSave = () => {
    const pct = Number(retentionPct);
    const cycles = Number(retentionCycles);
    const retention =
      Number.isFinite(pct) && pct > 0 && pct <= 90 && Number.isFinite(cycles) && cycles >= 1
        ? { percentage: pct, cycles: Math.trunc(cycles) }
        : null;
    save.mutate(
      {
        sales_channel_id: salesChannelId,
        scope,
        category_ids: scope === 'selected' ? categoryIds : [],
        tag_values: scope === 'selected' ? tagValues : [],
        product_ids: scope === 'selected' ? productIds : [],
        frequency_discounts: formToDiscounts(discountForm),
        retention_discount: retention,
        reminder_hours: toIntOrNull(policies.reminder_hours),
        expiration_hours: toIntOrNull(policies.expiration_hours),
        max_attempts: toIntOrNull(policies.max_attempts),
        retry_hours: toIntOrNull(policies.retry_hours),
        max_consecutive_failures: toIntOrNull(policies.max_consecutive_failures),
        stock_policy: (policies.stock_policy || null) as 'skip_unavailable' | 'fail_cycle' | null,
        price_change_policy: (policies.price_change_policy || null) as
          | 'always_current'
          | 'warn_over_threshold'
          | null,
        price_change_threshold_pct: toIntOrNull(policies.price_change_threshold_pct),
      },
      {
        onSuccess: () => toast.success('Configuración guardada'),
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  const usingGlobalFallback = Boolean(salesChannelId) && !data?.setting;

  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <SubscriptionSectionNav />
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading>Configuración</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Elegibilidad, ofertas, retención y políticas — por tienda o global.
            </Text>
          </div>
          {/*
            El drawer va acá, junto a Guardar, y no en un header propio como en las
            pantallas que sólo montan cards: ésta YA tiene header con acción, así que
            agregarle un `Container` de más sería una caja vacía arriba de todo. Mismo
            lugar que en `routes/seo-geo/configuracion/page.tsx`.

            Uno solo para toda la pantalla aunque haya tres formularios: la ayuda es
            de la extensión, y su sección central —las tres capas— es justamente la
            que explica cómo se relacionan entre sí.
          */}
          <div className="flex items-center gap-2">
            <HelpDrawer slug="recurring-orders" />
            <Button isLoading={save.isPending} onClick={handleSave} size="small">
              Guardar
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-y-5 border-t px-6 py-5">
          <div className="flex flex-col gap-y-2">
            <Label>Alcance de la configuración</Label>
            <Select onValueChange={setChannel} value={channel}>
              <Select.Trigger>
                <Select.Value placeholder="Canal" />
              </Select.Trigger>
              <Select.Content>
                {/*
                  El rótulo depende de si hay tienda activa, porque el efecto depende
                  de eso. Decía siempre "Predeterminada (todas las tiendas)", y con una
                  tienda elegida es falso: el handler hace
                  `sales_channel_id ?? defaultChannel` (`settings/route.ts:135`) y
                  `defaultChannel` es el primer canal de la tienda ACTIVA. O sea que
                  elegir "todas las tiendas" parado en Norte guardaba la configuración
                  de Norte.

                  Y no es un descuido de la ruta: escribir la fila global desde una
                  tienda secundaria le cambiaría los valores a todas las demás, así que
                  la ruta lo impide a propósito. El que mentía era el rótulo.
                */}
                <Select.Item value={GLOBAL}>
                  {activeSite
                    ? `Predeterminada de ${activeSite.name}`
                    : 'Predeterminada (todas las tiendas)'}
                </Select.Item>
                {(channelsData?.sales_channels ?? []).map((sc) => (
                  <Select.Item key={sc.id} value={sc.id}>
                    {sc.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            {usingGlobalFallback && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                Esta tienda no tiene configuración propia: hereda la predeterminada. Al guardar se
                crea una específica.
              </Text>
            )}
          </div>

          <div className="flex flex-col gap-y-2">
            <Label>Productos que pueden suscribirse</Label>
            <RadioGroup onValueChange={(v) => setScope(v as RecurringScope)} value={scope}>
              <div className="flex items-start gap-x-2">
                <RadioGroup.Item id="scope-all" value="all" />
                <div className="flex flex-col">
                  <Label htmlFor="scope-all">Todos los productos</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Cualquier producto del catálogo muestra "Suscribirse".
                  </Text>
                </div>
              </div>
              <div className="flex items-start gap-x-2">
                <RadioGroup.Item id="scope-selected" value="selected" />
                <div className="flex flex-col">
                  <Label htmlFor="scope-selected">Productos seleccionados</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Solo los que matcheen alguna categoría, etiqueta o producto elegido (unión de
                    los tres criterios).
                  </Text>
                </div>
              </div>
            </RadioGroup>
          </div>

          {scope === 'selected' && !isPending && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <CategoryPicker selected={categoryIds} onChange={setCategoryIds} />
              <TagPicker selected={tagValues} onChange={setTagValues} />
              <ProductPicker selected={productIds} onChange={setProductIds} />
              {!categoryIds.length && !tagValues.length && !productIds.length && (
                <Text size="xsmall" className="text-ui-fg-error md:col-span-3">
                  Sin criterios elegidos, ningún producto va a poder suscribirse.
                </Text>
              )}
            </div>
          )}

          {/* La semántica del campo —cuándo se aplica y qué significa vacío— va al
              tooltip del label: es cierta siempre y no depende de lo cargado. El
              mecanismo completo (base del canal, overrides por producto) ya está en
              la sección "Elegibilidad, ofertas y retención" del drawer de arriba. */}
          <div className="flex flex-col gap-y-2 border-t pt-4">
            <SettingLabel
              label="Ofertas: descuento por frecuencia"
              hint='Se aplica automáticamente en cada renovación como "Descuento por suscripción", sobre los precios vigentes. Vacío = sin descuento.'
            />
            <div className="max-w-md">
              <DiscountInputs onChange={setDiscountForm} value={discountForm} />
            </div>
          </div>

          <div className="flex flex-col gap-y-2 border-t pt-4">
            <SettingLabel
              label="Retención al cancelar"
              hint="Cuando el cliente va a cancelar, se le ofrece quedarse con este descuento en sus próximas N entregas. Vacío = no ofrecer."
            />
            <div className="flex max-w-md gap-2">
              <div className="relative flex-1">
                <Input
                  min={0}
                  max={90}
                  onChange={(e) => setRetentionPct(e.target.value)}
                  placeholder="Descuento"
                  size="small"
                  type="number"
                  value={retentionPct}
                />
                <span className="-translate-y-1/2 absolute top-1/2 right-2 text-ui-fg-subtle text-xs">
                  %
                </span>
              </div>
              <div className="relative flex-1">
                <Input
                  min={1}
                  max={24}
                  onChange={(e) => setRetentionCycles(e.target.value)}
                  placeholder="Entregas"
                  size="small"
                  type="number"
                  value={retentionCycles}
                />
                <span className="-translate-y-1/2 absolute top-1/2 right-2 text-ui-fg-subtle text-xs">
                  entregas
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 border-t pt-4">
            <SettingLabel
              label="Políticas de renovación"
              hint="Editables sin redeploy. Vacío = heredar (global → configuración del servidor). Los ciclos ya generados conservan su vencimiento."
            />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {(
                [
                  ['reminder_hours', 'Recordatorio (hs)'],
                  ['expiration_hours', 'Vencimiento link (hs)'],
                  ['max_attempts', 'Reintentos por ciclo'],
                  ['retry_hours', 'Horas entre reintentos'],
                  ['max_consecutive_failures', 'Fallos antes de caer'],
                ] as const
              ).map(([key, label]) => (
                <div className="flex flex-col gap-y-1" key={key}>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {label}
                  </Text>
                  <Input
                    min={1}
                    onChange={(e) => setPolicies((p) => ({ ...p, [key]: e.target.value }))}
                    size="small"
                    type="number"
                    value={policies[key] ?? ''}
                  />
                </div>
              ))}
            </div>
            <div className="grid max-w-2xl grid-cols-1 gap-2 md:grid-cols-2">
              <div className="flex flex-col gap-y-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Stock insuficiente
                </Text>
                <Select
                  onValueChange={(v) =>
                    setPolicies((p) => ({ ...p, stock_policy: v === 'inherit' ? '' : v }))
                  }
                  size="small"
                  value={policies.stock_policy || 'inherit'}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="inherit">Heredar</Select.Item>
                    <Select.Item value="skip_unavailable">
                      Omitir productos sin stock (entrega parcial)
                    </Select.Item>
                    <Select.Item value="fail_cycle">
                      Frenar el ciclo completo y reintentar
                    </Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="flex flex-col gap-y-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Cambio de precio
                </Text>
                <Select
                  onValueChange={(v) =>
                    setPolicies((p) => ({
                      ...p,
                      price_change_policy: v === 'inherit' ? '' : v,
                    }))
                  }
                  size="small"
                  value={policies.price_change_policy || 'inherit'}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="inherit">Heredar</Select.Item>
                    <Select.Item value="always_current">Usar precio vigente sin avisar</Select.Item>
                    <Select.Item value="warn_over_threshold">
                      Avisar si supera un umbral
                    </Select.Item>
                  </Select.Content>
                </Select>
              </div>
            </div>
            {policies.price_change_policy === 'warn_over_threshold' && (
              <div className="relative w-40">
                <Input
                  min={1}
                  onChange={(e) =>
                    setPolicies((p) => ({ ...p, price_change_threshold_pct: e.target.value }))
                  }
                  placeholder="Umbral"
                  size="small"
                  type="number"
                  value={policies.price_change_threshold_pct ?? ''}
                />
                <span className="-translate-y-1/2 absolute top-1/2 right-2 text-ui-fg-subtle text-xs">
                  % de suba
                </span>
              </div>
            )}
          </div>

          <OffersSection salesChannelId={salesChannelId} />
        </div>
      </Container>

      {/*
        `hideSiteContext` con el mismo criterio que `hideEnvOnly`: la barra de
        contexto de tienda es del namespace, no de cada card, así que sólo la
        primera la muestra.
      */}
      {ENGINE_SECTIONS.map((section, index) => (
        <ExtensionSettingsCard
          key={section.title}
          namespace="extension:recurring-orders"
          title={section.title}
          groups={section.groups}
          description={section.description}
          hideEnvOnly={index > 0}
          hideSiteContext={index > 0}
        />
      ))}

      <Toaster />
    </SingleColumnLayout>
  );
};

function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { data } = useProductCategoriesList();
  const [filter, setFilter] = useState('');
  const categories = data?.product_categories ?? [];
  const visible = useMemo(
    () =>
      filter.trim()
        ? categories.filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase()))
        : categories,
    [categories, filter]
  );

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);

  return (
    <div className="flex flex-col gap-y-2">
      <Label>Categorías{selected.length ? ` (${selected.length})` : ''}</Label>
      <Input
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar categorías…"
        size="small"
        value={filter}
      />
      <div className="flex max-h-44 flex-col gap-y-1 overflow-y-auto rounded-lg border border-ui-border-base p-2">
        {visible.map((c) => (
          <label className="flex cursor-pointer items-center gap-x-2" key={c.id}>
            <Checkbox checked={selected.includes(c.id)} onCheckedChange={() => toggle(c.id)} />
            <Text size="small">{c.name}</Text>
          </label>
        ))}
        {!visible.length && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Sin categorías.
          </Text>
        )}
      </div>
    </div>
  );
}

function TagPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const { data } = useProductTagsList();
  const [filter, setFilter] = useState('');
  const tags = data?.product_tags ?? [];
  const visible = useMemo(
    () =>
      filter.trim()
        ? tags.filter((t) => t.value.toLowerCase().includes(filter.trim().toLowerCase()))
        : tags,
    [tags, filter]
  );

  const toggle = (value: string) =>
    onChange(selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value]);

  return (
    <div className="flex flex-col gap-y-2">
      <Label>Etiquetas{selected.length ? ` (${selected.length})` : ''}</Label>
      <Input
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar etiquetas…"
        size="small"
        value={filter}
      />
      <div className="flex max-h-44 flex-col gap-y-1 overflow-y-auto rounded-lg border border-ui-border-base p-2">
        {visible.map((t) => (
          <label className="flex cursor-pointer items-center gap-x-2" key={t.id}>
            <Checkbox
              checked={selected.includes(t.value)}
              onCheckedChange={() => toggle(t.value)}
            />
            <Text size="small">{t.value}</Text>
          </label>
        ))}
        {!visible.length && (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Sin etiquetas.
          </Text>
        )}
      </div>
    </div>
  );
}

function ProductPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const { data: results } = useProductSearch(q);
  const { data: selectedData } = useProductsByIds(selected);
  const titleById = new Map((selectedData?.products ?? []).map((p) => [p.id, p.title]));

  return (
    <div className="flex flex-col gap-y-2">
      <Label>Productos puntuales{selected.length ? ` (${selected.length})` : ''}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => (
            <Badge
              className="cursor-pointer"
              key={id}
              onClick={() => onChange(selected.filter((s) => s !== id))}
              size="small"
              title="Quitar"
            >
              {titleById.get(id) ?? id} ✕
            </Badge>
          ))}
        </div>
      )}
      <Input
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto por nombre…"
        size="small"
        value={q}
      />
      {q.trim().length >= 2 && (
        <div className="flex max-h-44 flex-col gap-y-1 overflow-y-auto rounded-lg border border-ui-border-base p-2">
          {(results?.products ?? [])
            .filter((p) => !selected.includes(p.id))
            .map((p) => (
              <button
                className="rounded px-2 py-1 text-left text-sm hover:bg-ui-bg-subtle"
                key={p.id}
                onClick={() => {
                  onChange([...selected, p.id]);
                  setQ('');
                }}
                type="button"
              >
                {p.title}
              </button>
            ))}
          {!(results?.products ?? []).length && (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Sin resultados.
            </Text>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Overrides de descuento por producto: pisan la base del canal para productos
 * puntuales (ej. "café: 15% semanal aunque la base sea 5%").
 */
function OffersSection({ salesChannelId }: { salesChannelId: string | null }) {
  const { data } = useRecurringOffers(salesChannelId);
  const saveOffer = useSaveRecurringOffer();
  const deleteOffer = useDeleteRecurringOffer();

  const [q, setQ] = useState('');
  const { data: results } = useProductSearch(q);
  const [newProduct, setNewProduct] = useState<{ id: string; title: string } | null>(null);
  const [newDiscounts, setNewDiscounts] = useState<PctByPreset>({});

  const offers = data?.offers ?? [];

  const handleAdd = () => {
    if (!newProduct) return;
    const discounts = formToDiscounts(newDiscounts);
    if (!discounts.length) {
      toast.error('Cargá al menos un % válido (1 a 90).');
      return;
    }
    saveOffer.mutate(
      {
        sales_channel_id: salesChannelId,
        product_id: newProduct.id,
        discounts,
        enabled: true,
      },
      {
        onSuccess: () => {
          toast.success('Oferta guardada');
          setNewProduct(null);
          setNewDiscounts({});
          setQ('');
        },
        onError: (e) => toast.error((e as Error).message),
      }
    );
  };

  return (
    <div className="flex flex-col gap-y-2 border-t pt-4">
      <SettingLabel
        label="Ofertas por producto (overrides)"
        hint="Pisan el descuento base del canal para productos puntuales."
      />

      {offers.length > 0 && (
        <div className="flex max-w-2xl flex-col gap-y-1">
          {offers.map((offer) => (
            <div
              className="flex items-center justify-between gap-2 rounded-lg border border-ui-border-base px-3 py-2"
              key={offer.id}
            >
              <div className="min-w-0 flex-1">
                <Text size="small" className="truncate font-medium">
                  {offer.product_title ?? offer.product_id}
                </Text>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {offer.discounts
                    .map((d) => {
                      const preset = FREQUENCY_PRESETS.find(
                        (p) => p.interval === d.interval && p.count === d.count
                      );
                      return `${preset?.label ?? `${d.interval}×${d.count}`} -${d.percentage}%`;
                    })
                    .join(' · ')}
                </Text>
              </div>
              <Button
                disabled={deleteOffer.isPending}
                onClick={() =>
                  deleteOffer.mutate(
                    { id: offer.id },
                    {
                      onSuccess: () => toast.success('Oferta eliminada'),
                      onError: (e) => toast.error((e as Error).message),
                    }
                  )
                }
                size="small"
                variant="transparent"
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}

      {newProduct ? (
        <div className="flex max-w-2xl flex-col gap-y-2 rounded-lg border border-ui-border-base p-3">
          <Text size="small" className="font-medium">
            {newProduct.title}
          </Text>
          <DiscountInputs compact onChange={setNewDiscounts} value={newDiscounts} />
          <div className="flex gap-2">
            <Button isLoading={saveOffer.isPending} onClick={handleAdd} size="small">
              Guardar oferta
            </Button>
            <Button
              onClick={() => {
                setNewProduct(null);
                setNewDiscounts({});
              }}
              size="small"
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-w-md">
          <Input
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar producto para agregar una oferta…"
            size="small"
            value={q}
          />
          {q.trim().length >= 2 && (
            <div className="mt-1 flex max-h-40 flex-col gap-y-1 overflow-y-auto rounded-lg border border-ui-border-base p-2">
              {(results?.products ?? [])
                .filter((p) => !offers.some((o) => o.product_id === p.id))
                .map((p) => (
                  <button
                    className="rounded px-2 py-1 text-left text-sm hover:bg-ui-bg-subtle"
                    key={p.id}
                    onClick={() => setNewProduct(p)}
                    type="button"
                  >
                    {p.title}
                  </button>
                ))}
              {!(results?.products ?? []).length && (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Sin resultados.
                </Text>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const config = defineRouteConfig({
  label: 'Configuración',
});

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default RecurringSettingsPage;
