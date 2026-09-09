import { useB2BPriceListOptions } from '../../../hooks/api/demo-stores';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Drawer, Input, Label, Select, Switch, Tabs, Text, toast } from '@medusajs/ui';
import {
  useAdminRegions,
  useDemoTemplates,
  useSourceSalesChannels,
  useDemoStoreStockLocationOptions,
  useUpdateDemoStore,
  type AdminUpdateDemoStore,
  type DemoStore,
} from '../../../hooks/api';
import { ColorField, DEFAULT_FONT, GOOGLE_FONTS } from './branding';
import {
  ContentConfigFields,
  contentConfigToForm,
  formToContentConfig,
  type ContentConfigForm,
} from './content-config-fields';
import { ImageField } from '../../../components/image-field';
import { StoreCatalog } from './store-catalog';
import { CheckoutConfig } from './checkout-config';

/** Copia el theme y siembra `icon` desde el viejo `mobile_logo` (compat). */
function seedTheme(theme: Record<string, unknown> | null | undefined): Record<string, string> {
  const next = { ...((theme ?? {}) as Record<string, string>) };
  if (!next.icon && next.mobile_logo) next.icon = next.mobile_logo;
  return next;
}

type Props = { demo: DemoStore; open: boolean; onOpenChange: (open: boolean) => void };

export const DemoStoreEdit = ({ demo, open, onOpenChange }: Props) => {
  const { t } = useTranslation('demo-stores');
  const [activeTab, setActiveTab] = useState('general');
  const { data: templatesData } = useDemoTemplates();
  const templates = templatesData?.demo_templates ?? [];

  const [name, setName] = useState(demo.name);
  const [templateCode, setTemplateCode] = useState(demo.template_code);
  const [canonicalForm, setCanonicalForm] = useState<'host' | 'path'>(
    (demo.canonical_form as 'host' | 'path' | undefined) ?? 'host'
  );
  const [theme, setTheme] = useState<Record<string, string>>(seedTheme(demo.theme));
  const [font, setFont] = useState<string>(demo.theme?.typography || DEFAULT_FONT);
  const [content, setContent] = useState<ContentConfigForm>(
    contentConfigToForm(demo.content_config)
  );
  const alreadyB2B = !!demo.b2b_enabled;
  const [b2bEnabled, setB2bEnabled] = useState(alreadyB2B);
  const AUTO_B2B = '__auto__';
  const [b2bChannelId, setB2bChannelId] = useState(demo.b2b_sales_channel_id || AUTO_B2B);
  const [b2bPriceListId, setB2bPriceListId] = useState(demo.b2b_price_list_id || AUTO_B2B);
  const b2bPriceLists = useB2BPriceListOptions();
  const [recurringEnabled, setRecurringEnabled] = useState(!!demo.recurring_enabled);
  const [tintingEnabled, setTintingEnabled] = useState(!!demo.tinting_enabled);
  // Stock location asignado. `null` = sin location (comportamiento inicial de la
  // principal). El valor "" en el select representa el detach (para no colisionar
  // con la falta de valor). Se manda `null` explícito al backend si el operador
  // elige "sin asignar".
  const SL_DETACH = '__detach__';
  const [stockLocationId, setStockLocationId] = useState<string>(demo.stock_location_id ?? '');
  const stockLocations = useDemoStoreStockLocationOptions();
  const stockLocationOptions = stockLocations.data?.stock_locations ?? [];
  // Sales channel + region: mismo patrón que stock location. `__detach__` es el
  // sentinel para "sin asignar" (permite distinguir del valor "" que se usa como
  // "todavía no elegí").
  const [salesChannelId, setSalesChannelId] = useState<string>(demo.sales_channel_id ?? '');
  const salesChannels = useSourceSalesChannels();
  const salesChannelOptions = salesChannels.data?.sales_channels ?? [];
  const [regionId, setRegionId] = useState<string>(demo.region_id ?? '');
  const regions = useAdminRegions();
  const regionOptions = regions.data?.regions ?? [];

  // Re-seed local state whenever the drawer (re)opens for a demo.
  useEffect(() => {
    if (open) {
      setName(demo.name);
      setTemplateCode(demo.template_code);
      setCanonicalForm((demo.canonical_form as 'host' | 'path' | undefined) ?? 'host');
      setTheme(seedTheme(demo.theme));
      setFont(demo.theme?.typography || DEFAULT_FONT);
      setContent(contentConfigToForm(demo.content_config));
      setB2bEnabled(!!demo.b2b_enabled);
      setB2bChannelId(demo.b2b_sales_channel_id || AUTO_B2B);
      setB2bPriceListId(demo.b2b_price_list_id || AUTO_B2B);
      setRecurringEnabled(!!demo.recurring_enabled);
      setTintingEnabled(!!demo.tinting_enabled);
      setStockLocationId(demo.stock_location_id ?? '');
      setSalesChannelId(demo.sales_channel_id ?? '');
      setRegionId(demo.region_id ?? '');
    }
  }, [open, demo]);

  const update = useUpdateDemoStore(demo.id);

  const setThemeField = (key: string, value: string) =>
    setTheme((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    const cleanedTheme = Object.fromEntries(
      Object.entries(theme).filter(([, v]) => v && String(v).trim())
    );
    cleanedTheme.typography = font || DEFAULT_FONT;

    const body: AdminUpdateDemoStore = {
      name: name.trim(),
      template_code: templateCode,
      canonical_form: canonicalForm,
      theme: cleanedTheme,
      // El tercer argumento NO es opcional acá: esta función reconstruye el
      // objeto desde los campos del formulario, así que sin el `content_config`
      // actual se borraban las claves que la ficha no modela (la descripción de
      // SEO, el horario de atención y todo el footer menos la descripción).
      content_config: formToContentConfig(content, templateCode, demo.content_config),
      // Saving an enabled store also completes any missing wholesale resources.
      ...(b2bEnabled
        ? {
            b2b_enabled: true,
            ...(b2bChannelId !== (demo.b2b_sales_channel_id || AUTO_B2B)
              ? { b2b_sales_channel_id: b2bChannelId === AUTO_B2B ? null : b2bChannelId }
              : {}),
            ...(b2bPriceListId !== (demo.b2b_price_list_id || AUTO_B2B)
              ? { b2b_price_list_id: b2bPriceListId === AUTO_B2B ? null : b2bPriceListId }
              : {}),
          }
        : alreadyB2B ? { b2b_enabled: false } : {}),
      // Recurring es un flag puro: se puede prender y apagar.
      ...(recurringEnabled !== !!demo.recurring_enabled
        ? { recurring_enabled: recurringEnabled }
        : {}),
      // Tintometría: también flag puro, la data maestra ya vive en el ERP.
      ...(tintingEnabled !== !!demo.tinting_enabled ? { tinting_enabled: tintingEnabled } : {}),
      // Stock location: sólo se emite si el operador cambió el select. Traducción:
      //   ""                       → sin tocar (undefined en el body, no llega al backend)
      //   SL_DETACH                → null explícito (detach)
      //   otro id                  → string, el nuevo id
      // El backend dispara `updateDemoStoreStockLocationWorkflow` sólo si la
      // clave viene presente en el body.
      ...(stockLocationId !== (demo.stock_location_id ?? '')
        ? {
            stock_location_id: stockLocationId === SL_DETACH ? null : stockLocationId || null,
          }
        : {}),
      // Sales channel: mismo criterio (misma traducción de sentinel `SL_DETACH`).
      // Dispara `updateDemoStoreSalesChannelWorkflow` en el backend, que además
      // del update de la fila re-linkea SL↔SC y publishable_api_keys↔SC.
      ...(salesChannelId !== (demo.sales_channel_id ?? '')
        ? {
            sales_channel_id: salesChannelId === SL_DETACH ? null : salesChannelId || null,
          }
        : {}),
      // Region: mismo criterio. Dispara `updateDemoStoreStockLocationWorkflow`
      // que también acepta cambio de region (comparten workflow porque el link
      // SC↔SL a reconstruir es el mismo).
      ...(regionId !== (demo.region_id ?? '')
        ? {
            region_id: regionId === SL_DETACH ? null : regionId || null,
          }
        : {}),
    };

    update.mutate(body, {
      onSuccess: () => {
        toast.success(t('EDIT_SUCCESS'));
        onOpenChange(false);
      },
      onError: (err) => toast.error(t('EDIT_ERROR', { msg: err.message })),
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content className="z-[60]">
        <Drawer.Header>
          <Drawer.Title>{t('EDIT_TITLE')}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <Tabs.List className="sticky top-0 z-10 flex flex-wrap gap-1 bg-ui-bg-base pb-3">
              <Tabs.Trigger value="general">General</Tabs.Trigger>
              <Tabs.Trigger value="catalog">Catálogo</Tabs.Trigger>
              <Tabs.Trigger value="branding">{t('STEP_BRANDING')}</Tabs.Trigger>
              <Tabs.Trigger value="content">{t('STEP_CONTENT')}</Tabs.Trigger>
              <Tabs.Trigger value="operations">{t('EDIT_TAB_OPERATIONS')}</Tabs.Trigger>
              <Tabs.Trigger value="b2b">B2B</Tabs.Trigger>
              <Tabs.Trigger value="checkout">Checkout</Tabs.Trigger>
              <Tabs.Trigger value="features">{t('EDIT_TAB_FEATURES')}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="general" className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <Label>{t('FIELD_NAME')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* La plantilla SÍ es editable en la tienda principal.
              Cambiarla da vuelta todo el chrome del storefront (header, footer, home,
              layout del catálogo), pero eso es razón para AVISAR, no para prohibir: es
              reversible y es exactamente algo que el dueño del sitio puede querer
              cambiar. La fila principal se siembra con 'supermercado' →
              tenant_template 'grocery', que es el `template` de defaultConfig. */}
          <div className="flex flex-col gap-y-2">
            <Label>{t('STEP_TEMPLATE')}</Label>
            <Select value={templateCode} onValueChange={setTemplateCode}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                {templates.map((tpl) => (
                  <Select.Item key={tpl.code} value={tpl.code}>
                    {tpl.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            {demo.is_main && templateCode !== demo.template_code && (
              <Text size="small" className="text-ui-fg-warning">
                {t('TEMPLATE_WARNING_MAIN')}
              </Text>
            )}
          </div>

          {/* Forma canónica para SEO.
              EDITABLE — a diferencia del slug. Cambiarla no rompe ninguna URL: las dos
              formas siguen resolviendo, sólo se mueve cuál indexa Google y cuál queda
              noindex. Un rename de slug, en cambio, dejaría el host viejo devolviendo
              200 con el contenido del sitio principal, y por eso está prohibido. */}
          {!demo.is_main && (
            <div className="flex flex-col gap-y-2">
              <Label>{t('FIELD_CANONICAL_FORM')}</Label>
              <Select
                value={canonicalForm}
                onValueChange={(v) => setCanonicalForm(v as 'host' | 'path')}
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content className="z-[70]">
                  <Select.Item value="host">
                    {t('CANONICAL_FORM_HOST', { slug: demo.slug })}
                  </Select.Item>
                  <Select.Item value="path">
                    {t('CANONICAL_FORM_PATH', { slug: demo.slug })}
                  </Select.Item>
                </Select.Content>
              </Select>
              <Text size="small" className="text-ui-fg-subtle">
                {t('FIELD_CANONICAL_FORM_HELP')}
              </Text>
            </div>
          )}

            </Tabs.Content>
            <Tabs.Content value="catalog">
              {open && activeTab === 'catalog' && <StoreCatalog key={demo.id} demo={demo} />}
            </Tabs.Content>
            <Tabs.Content value="branding" className="flex flex-col gap-y-4">
          <Text size="small" weight="plus" className="mt-2">
            {t('STEP_BRANDING')}
          </Text>
          <div className="grid grid-cols-3 gap-3">
            <ColorField
              label={t('FIELD_PRIMARY_COLOR')}
              value={theme.primary_color ?? ''}
              fallback="#2e7d32"
              onChange={(v) => setThemeField('primary_color', v)}
            />
            <ColorField
              label={t('FIELD_SECONDARY_COLOR')}
              value={theme.secondary_color ?? ''}
              fallback="#374151"
              onChange={(v) => setThemeField('secondary_color', v)}
            />
            <ColorField
              label={t('FIELD_ACCENT_COLOR')}
              value={theme.accent_color ?? ''}
              fallback="#6b7280"
              onChange={(v) => setThemeField('accent_color', v)}
            />
          </div>
          {/* Fondos del chrome. Vacíos = el default del template elegido. */}
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label={t('FIELD_HEADER_BACKGROUND')}
              value={theme.header_background ?? ''}
              fallback="#ffffff"
              onChange={(v) => setThemeField('header_background', v)}
            />
            <ColorField
              label={t('FIELD_FOOTER_BACKGROUND')}
              value={theme.footer_background ?? ''}
              fallback="#f9fafb"
              onChange={(v) => setThemeField('footer_background', v)}
            />
          </div>
          <Text size="xsmall" className="text-ui-fg-subtle">
            {t('FIELD_CHROME_BACKGROUND_HELP')}
          </Text>

          <div className="flex flex-col gap-y-2">
            <Label>{t('FIELD_TYPOGRAPHY')}</Label>
            <Select value={font} onValueChange={setFont}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                {GOOGLE_FONTS.map((f) => (
                  <Select.Item key={f} value={f}>
                    {f === DEFAULT_FONT ? `${f} (default)` : f}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {(
            [
              ['logo', 'FIELD_LOGO_POSITIVE'],
              ['logo_negative', 'FIELD_LOGO_NEGATIVE'],
              ['icon', 'FIELD_ICON_POSITIVE'],
              ['icon_negative', 'FIELD_ICON_NEGATIVE'],
              ['favicon', 'FIELD_FAVICON_POSITIVE'],
              ['favicon_negative', 'FIELD_FAVICON_NEGATIVE'],
            ] as const
          ).map(([key, label]) => (
            <ImageField
              key={key}
              label={t(label)}
              value={theme[key] ?? ''}
              onChange={(v) => setThemeField(key, v)}
            />
          ))}

            </Tabs.Content>
            <Tabs.Content value="content" className="flex flex-col gap-y-4">
          <Text size="small" weight="plus" className="mt-2">
            {t('STEP_CONTENT')}
          </Text>
          <ContentConfigFields value={content} onChange={setContent} templateCode={templateCode} />

            </Tabs.Content>
            <Tabs.Content value="operations" className="flex flex-col gap-y-4">
          <Text size="small" weight="plus" className="mt-2">
            Recursos operacionales
          </Text>

          {/* ── Sales channel ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
            <Label>
              Sales channel asignado
              {demo.is_main ? ' (principal)' : ''}
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              Cambiarlo tiene impacto grande: la storefront lee el catálogo desde este canal, así
              que los productos que muestra van a cambiar. El workflow re-linkea automáticamente el
              stock location y todas las publishable keys al canal nuevo (para que la storefront no
              quede leyendo un canal huérfano).
            </Text>
            <Select
              value={salesChannelId || SL_DETACH}
              onValueChange={(v) => setSalesChannelId(v === SL_DETACH ? SL_DETACH : v)}
            >
              <Select.Trigger>
                <Select.Value
                  placeholder={salesChannels.isLoading ? 'Cargando…' : 'Elegí un sales channel'}
                />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                <Select.Item value={SL_DETACH}>Sin asignar (detach)</Select.Item>
                {salesChannelOptions.map((sc) => (
                  <Select.Item key={sc.id} value={sc.id}>
                    {sc.name}
                    {sc.id === (demo.sales_channel_id ?? '') ? ' (actual)' : ''}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* ── Region ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
            <Label>
              Region asignada
              {demo.is_main ? ' (principal)' : ''}
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              En Medusa un país sólo puede pertenecer a una region a la vez — el link nuevo puede
              rechazarse si el país del demo ya está en otra region. Sin asignar = la demo no tiene
              region propia (afecta cálculo de impuestos y precios por país en el catálogo).
            </Text>
            <Select
              value={regionId || SL_DETACH}
              onValueChange={(v) => setRegionId(v === SL_DETACH ? SL_DETACH : v)}
            >
              <Select.Trigger>
                <Select.Value placeholder={regions.isLoading ? 'Cargando…' : 'Elegí una region'} />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                <Select.Item value={SL_DETACH}>Sin asignar (detach)</Select.Item>
                {regionOptions.map((r) => (
                  <Select.Item key={r.id} value={r.id}>
                    {r.name} ({r.currency_code.toUpperCase()})
                    {r.id === (demo.region_id ?? '') ? ' (actual)' : ''}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

          {/* ── Stock location ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
            <Label>
              Stock location asignado
              {demo.is_main ? ' (principal)' : ''}
            </Label>
            <Text size="small" className="text-ui-fg-subtle">
              Cambiarlo dispara un workflow que desliga el sales channel del location anterior y lo
              linkea al nuevo. Sin asignar =&nbsp;la demo no tiene un depósito propio (estado
              inicial de la principal).
            </Text>
            <Select
              value={stockLocationId || SL_DETACH}
              onValueChange={(v) => setStockLocationId(v === SL_DETACH ? SL_DETACH : v)}
            >
              <Select.Trigger>
                <Select.Value
                  placeholder={stockLocations.isLoading ? 'Cargando…' : 'Elegí un stock location'}
                />
              </Select.Trigger>
              <Select.Content className="z-[70]">
                <Select.Item value={SL_DETACH}>Sin asignar (detach)</Select.Item>
                {stockLocationOptions.map((sl) => (
                  <Select.Item key={sl.id} value={sl.id}>
                    {sl.name}
                    {sl.id === (demo.stock_location_id ?? '') ? ' (actual)' : ''}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>

            </Tabs.Content>
            <Tabs.Content value="b2b" className="flex flex-col gap-y-4">
          <Text size="small" weight="plus" className="mt-2">
            {t('B2B_SECTION_TITLE')}
          </Text>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
            <div className="flex min-w-0 flex-col">
              <Label>{t('B2B_TOGGLE')}</Label>
              <Text size="small" className="text-ui-fg-subtle">
                {t('B2B_SETUP_HELP')}
              </Text>
            </div>
            <Switch
              className="shrink-0"
              checked={b2bEnabled}
              onCheckedChange={setB2bEnabled}
            />
          </div>

          {b2bEnabled && (
            <div className="flex flex-col gap-3">
              <div>
                <Label>{t('B2B_CHANNEL_SELECT')}</Label>
                <Select value={b2bChannelId} onValueChange={setB2bChannelId}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[70]">
                    <Select.Item value={AUTO_B2B}>{t('B2B_AUTO_CHANNEL')}</Select.Item>
                    {salesChannelOptions
                      .filter((sc) => sc.id !== salesChannelId)
                      .map((sc) => (
                        <Select.Item key={sc.id} value={sc.id}>
                          {sc.name}
                        </Select.Item>
                      ))}
                  </Select.Content>
                </Select>
              </div>
              <div>
                <Label>{t('B2B_PRICE_LIST')}</Label>
                <Select value={b2bPriceListId} onValueChange={setB2bPriceListId}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content className="z-[70]">
                    <Select.Item value={AUTO_B2B}>{t('B2B_AUTO_PRICING')}</Select.Item>
                    {(b2bPriceLists.data?.price_lists ?? []).map((pl) => (
                      <Select.Item key={pl.id} value={pl.id}>
                        {pl.title}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>
          )}
            </Tabs.Content>
            <Tabs.Content value="checkout" forceMount style={{ display: activeTab === 'checkout' ? undefined : 'none' }} className="flex flex-col gap-y-4 data-[state=inactive]:hidden">
              <CheckoutConfig siteId={demo.id} open={open} />
            </Tabs.Content>
            <Tabs.Content value="features" className="flex flex-col gap-y-4">
          <Text size="small" weight="plus" className="mt-2">
            {t('RECURRING_SECTION_TITLE')}
          </Text>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
            <div className="flex min-w-0 flex-col">
              <Label>{t('RECURRING_TOGGLE')}</Label>
              <Text size="small" className="text-ui-fg-subtle">
                {t('RECURRING_TOGGLE_HELP')}
              </Text>
            </div>
            <Switch
              className="shrink-0"
              checked={recurringEnabled}
              onCheckedChange={setRecurringEnabled}
            />
          </div>

          <Text size="small" weight="plus" className="mt-2">
            {t('TINTING_SECTION_TITLE')}
          </Text>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
            <div className="flex min-w-0 flex-col">
              <Label>{t('TINTING_TOGGLE')}</Label>
              <Text size="small" className="text-ui-fg-subtle">
                {t('TINTING_TOGGLE_HELP')}
              </Text>
            </div>
            <Switch
              className="shrink-0"
              checked={tintingEnabled}
              onCheckedChange={setTintingEnabled}
            />
          </div>
            </Tabs.Content>
          </Tabs>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>
            {t('BACK')}
          </Button>
          {activeTab !== 'checkout' && activeTab !== 'catalog' && <Button size="small" isLoading={update.isPending} onClick={handleSave}>
            {t('EDIT_SAVE')}
          </Button>}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};
