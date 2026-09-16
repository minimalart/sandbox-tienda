import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../../../lib/http';
import { useStorefrontOrigins } from '../../../hooks/use-storefront-base';
import { buildPublicUrlFrom } from '../lib';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  FocusModal,
  Input,
  Label,
  ProgressTabs,
  Select,
  Switch,
  Text,
  toast,
} from '@medusajs/ui';
import {
  useCreateDemoStore,
  useDemoTemplates,
  useSourceSalesChannels,
  useDemoStoreStockLocationOptions,
  type AdminCreateDemoStore,
  type DemoSourceType,
} from '../../../hooks/api';
import { ColorField, DEFAULT_FONT, GOOGLE_FONTS } from './branding';
import {
  ContentConfigFields,
  emptyContentForm,
  formToContentConfig,
  type ContentConfigForm,
} from './content-config-fields';
import { CatalogSourceFields } from './catalog-source-fields';
import { currencyForCountry } from '../lib';
import { ImageField } from '../../../components/image-field';

const TABS = [
  { value: 'basics', key: 'STEP_BASICS' },
  { value: 'branding', key: 'STEP_BRANDING' },
  { value: 'template', key: 'STEP_TEMPLATE' },
  { value: 'content', key: 'STEP_CONTENT' },
  { value: 'source', key: 'STEP_SOURCE' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

export const DemoStoreCreate = ({ open, onOpenChange }: Props) => {
  const { t } = useTranslation('demo-stores');
  const { base, hostSuffix, sitesBase } = useStorefrontOrigins();
  const { data: templatesData } = useDemoTemplates();
  const templates = templatesData?.demo_templates ?? [];

  const [tab, setTab] = useState<TabValue>('basics');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  // 'host' = el subdominio indexa; 'path' = indexa /tienda/<slug>.
  const [canonicalForm, setCanonicalForm] = useState<'host' | 'path'>('host');
  const [countryCode, setCountryCode] = useState('ar');
  const [currencyCode, setCurrencyCode] = useState('ars');
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [locale, setLocale] = useState('es');
  const [theme, setTheme] = useState<Record<string, string>>({});
  const [font, setFont] = useState<string>(DEFAULT_FONT);
  const [templateCode, setTemplateCode] = useState('supermercado');
  const [content, setContent] = useState<ContentConfigForm>(emptyContentForm());
  const [sourceType, setSourceType] = useState<DemoSourceType>('woocommerce');
  const [sourceUrl, setSourceUrl] = useState('');
  /** Canal de origen cuando `sourceType === 'sales_channel'`. */
  const [sourceChannelId, setSourceChannelId] = useState('');
  const [storefrontToken, setStorefrontToken] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [b2bEnabled, setB2bEnabled] = useState(false);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [tintingEnabled, setTintingEnabled] = useState(false);
  // Arrancan en true: las secciones de "Mi cuenta" hoy se ven siempre, y una tienda
  // nueva tiene que nacer igual que las que ya existen.
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [giftCardsEnabled, setGiftCardsEnabled] = useState(true);
  // Stock location: por default se CREA uno nuevo (`Depósito Demo <nombre>`).
  // Con el toggle prendido, se elige uno existente y el backend lo linkea al SC
  // de la demo en vez de crear uno huérfano. Motivo: hasta hoy cada demo
  // acumulaba su propio depósito aunque el operador quisiera compartir el stock
  // físico de la instancia (ver `provisionDemoStore`).
  const [reuseStockLocation, setReuseStockLocation] = useState(false);
  const [reuseStockLocationId, setReuseStockLocationId] = useState('');
  const stockLocations = useDemoStoreStockLocationOptions();
  const stockLocationOptions = stockLocations.data?.stock_locations ?? [];

  const create = useCreateDemoStore();
  const isChannelSource = sourceType === 'sales_channel';
  // Solo se piden los canales cuando hacen falta (origen interno).
  const salesChannels = useSourceSalesChannels();
  const channelOptions = salesChannels.data?.sales_channels ?? [];

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const availability = useQuery({
    queryKey: ['sites', 'slug-availability', effectiveSlug],
    queryFn: () => fetchJson<{ available: boolean; message: string }>(`/admin/sites/slug-availability?slug=${encodeURIComponent(effectiveSlug)}`),
    enabled: open && Boolean(effectiveSlug), staleTime: 0, retry: false,
  });
  const tabIndex = TABS.findIndex((s) => s.value === tab);
  const isLast = tabIndex === TABS.length - 1;

  const canSubmit = useMemo(
    () =>
      name.trim() &&
      effectiveSlug &&
      countryCode &&
      currencyCode &&
      // El origen interno se identifica con el canal, no con una URL.
      (isChannelSource ? Boolean(sourceChannelId) : Boolean(sourceUrl.trim())),
    [name, effectiveSlug, countryCode, currencyCode, isChannelSource, sourceChannelId, sourceUrl],
  );

  const statusFor = (i: number): 'completed' | 'in-progress' | 'not-started' =>
    i < tabIndex ? 'completed' : i === tabIndex ? 'in-progress' : 'not-started';

  const reset = () => {
    setTab('basics');
    setName('');
    setSlug('');
    setSlugTouched(false);
    setCurrencyTouched(false);
    setTheme({});
    setFont(DEFAULT_FONT);
    setContent(emptyContentForm());
    setSourceUrl('');
    setSourceChannelId('');
    setStorefrontToken('');
    setAdminToken('');
    setTargetCount('');
    setB2bEnabled(false);
  };

  const close = () => {
    onOpenChange(false);
    reset();
  };

  const setThemeField = (key: string, value: string) =>
    setTheme((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    const source_config: Record<string, unknown> = {};
    if (sourceType === 'shopify') {
      if (storefrontToken) source_config.storefront_access_token = storefrontToken;
      if (adminToken) source_config.admin_access_token = adminToken;
    }
    const cleanedTheme = Object.fromEntries(
      Object.entries(theme).filter(([, v]) => v && v.trim()),
    );
    // Default to Inter when no explicit font is chosen.
    cleanedTheme.typography = font || DEFAULT_FONT;

    const body: AdminCreateDemoStore = {
      name: name.trim(),
      slug: effectiveSlug,
      canonical_form: canonicalForm,
      template_code: templateCode,
      country_code: countryCode.trim().toLowerCase(),
      currency_code: currencyCode.trim().toLowerCase(),
      locale,
      source_type: sourceType,
      // Con origen interno, `source_url` transporta el ID del canal de origen
      // (el backend lo lee de ahí; ver el modelo DemoStore).
      source_url: isChannelSource ? sourceChannelId : sourceUrl.trim(),
      source_config: Object.keys(source_config).length ? source_config : null,
      theme: cleanedTheme,
      content_config: formToContentConfig(content, templateCode),
      b2b_enabled: b2bEnabled,
      recurring_enabled: recurringEnabled,
      tinting_enabled: tintingEnabled,
      loyalty_enabled: loyaltyEnabled,
      gift_cards_enabled: giftCardsEnabled,
    };
    // El toggle envía el ID sólo cuando está prendido Y hay un ID elegido.
    // Con el toggle apagado (o el select vacío) se omite y el backend cae al
    // comportamiento default (crear stock location nuevo).
    if (reuseStockLocation && reuseStockLocationId) {
      body.reuse_stock_location_id = reuseStockLocationId;
    }
    const parsedTargetCount = Number.parseInt(targetCount, 10);
    // El origen interno no recorta nada: la demo adopta el canal con todo su catálogo.
    if (!isChannelSource && Number.isFinite(parsedTargetCount) && parsedTargetCount > 0) {
      body.target_count = parsedTargetCount;
    }

    create.mutate(body, {
      onSuccess: () => {
        toast.success(t('CREATE_SUCCESS'));
        close();
      },
      onError: (err) => toast.error(t('CREATE_ERROR', { msg: err.message })),
    });
  };

  return (
    <FocusModal open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <FocusModal.Content>
        <ProgressTabs
          value={tab}
          onValueChange={(v) => setTab(v as TabValue)}
          className="flex h-full flex-col overflow-hidden"
        >
          <FocusModal.Header className="flex items-center gap-4">
            <div className="-my-2 w-full border-l">
              <ProgressTabs.List>
                {TABS.map((s, i) => (
                  <ProgressTabs.Trigger key={s.value} value={s.value} status={statusFor(i)}>
                    {t(s.key)}
                  </ProgressTabs.Trigger>
                ))}
              </ProgressTabs.List>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-1 justify-center overflow-y-auto">
            <div className="flex w-full max-w-2xl flex-col gap-y-6 px-6 py-10">
              {/* Step 1 — Basics */}
              <ProgressTabs.Content value="basics">
                <div className="flex flex-col gap-y-4">
                  <div className="flex flex-col gap-y-2">
                    <Label>{t('FIELD_NAME')}</Label>
                    <Input
                      value={name}
                      placeholder={t('FIELD_NAME_PLACEHOLDER')}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-y-2">
                    <Label>{t('FIELD_SLUG')}</Label>
                    <Input
                      value={effectiveSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(slugify(e.target.value));
                      }}
                    />
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('FIELD_SLUG_HELP')}<br />
                      {availability.isFetching ? 'Verificando disponibilidad…' : availability.isError ? 'No se pudo verificar la disponibilidad. Volvé a intentar.' : availability.data?.message}
                    </Text>
                    {/* El slug NO se puede cambiar después. Vale gastar una línea en
                        avisarlo acá: es el único momento en que se decide. */}
                    <Text size="small" className="text-ui-fg-warning">
                      {t('FIELD_SLUG_WARNING')}
                    </Text>
                  </div>

                  {/* Forma canónica. Las DOS URLs resuelven siempre — esto sólo decide
                      cuál indexa Google y cuál queda noindex. */}
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
                          {t('CANONICAL_FORM_HOST', { slug: effectiveSlug || 'tienda' })}
                        </Select.Item>
                        <Select.Item value="path">
                          {t('CANONICAL_FORM_PATH', { slug: effectiveSlug || 'tienda' })}
                        </Select.Item>
                      </Select.Content>
                    </Select>
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('FIELD_CANONICAL_FORM_HELP')}<br />
                  <span className="break-all font-medium">{buildPublicUrlFrom({ slug: effectiveSlug || 'tienda', canonical_form: canonicalForm }, { baseUrl: base, hostSuffix, sitesBaseUrl: sitesBase })}</span>
                    </Text>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-y-2">
                      <Label>{t('FIELD_COUNTRY')}</Label>
                      <Input
                        value={countryCode}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCountryCode(v);
                          // Default the currency from the country until the user
                          // edits it manually.
                          if (!currencyTouched) {
                            const cur = currencyForCountry(v);
                            if (cur) setCurrencyCode(cur);
                          }
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label>{t('FIELD_CURRENCY')}</Label>
                      <Input
                        value={currencyCode}
                        onChange={(e) => {
                          setCurrencyTouched(true);
                          setCurrencyCode(e.target.value);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label>{t('FIELD_LOCALE')}</Label>
                      <Select value={locale} onValueChange={setLocale}>
                        <Select.Trigger>
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="es">Español</Select.Item>
                          <Select.Item value="en">English</Select.Item>
                          <Select.Item value="pt">Português</Select.Item>
                        </Select.Content>
                      </Select>
                    </div>
                  </div>
                </div>
              </ProgressTabs.Content>

              {/* Step 2 — Branding */}
              <ProgressTabs.Content value="branding">
                <div className="flex flex-col gap-y-4">
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
                  {/* Boton "Promociones" del header. Vacio = el color primario. */}
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField
                      label={t('FIELD_PROMO_BUTTON_COLOR')}
                      value={theme.promo_button_color ?? ''}
                      fallback={theme.primary_color || '#2e7d32'}
                      onChange={(v) => setThemeField('promo_button_color', v)}
                    />
                  </div>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('FIELD_PROMO_BUTTON_COLOR_HELP')}
                  </Text>
                  <div className="flex flex-col gap-y-2">
                    <Label>{t('FIELD_TYPOGRAPHY')}</Label>
                    <Select value={font} onValueChange={setFont}>
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
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
                </div>
              </ProgressTabs.Content>

              {/* Step 3 — Template */}
              <ProgressTabs.Content value="template">
                <div className="grid grid-cols-2 gap-3">
                  {templates.map((tpl) => (
                    <button
                      type="button"
                      key={tpl.code}
                      onClick={() => setTemplateCode(tpl.code)}
                      className={`flex flex-col gap-2 rounded-lg border p-3 text-left ${
                        templateCode === tpl.code ? 'border-ui-fg-base' : 'border-ui-border-base'
                      }`}
                    >
                      {tpl.preview_image ? (
                        <img
                          src={tpl.preview_image}
                          alt={tpl.name}
                          className="aspect-video w-full rounded object-cover"
                        />
                      ) : (
                        <div className="aspect-video w-full rounded bg-ui-bg-subtle" />
                      )}
                      <Text size="small" className="font-medium">
                        {tpl.name}
                      </Text>
                    </button>
                  ))}
                </div>
              </ProgressTabs.Content>

              {/* Step 4 — Content */}
              <ProgressTabs.Content value="content">
                <ContentConfigFields
                  value={content}
                  onChange={setContent}
                  templateCode={templateCode}
                />
              </ProgressTabs.Content>

              {/* Step 5 — Source */}
              <ProgressTabs.Content value="source">
                <div className="flex flex-col gap-y-4">
                  <CatalogSourceFields
                    sourceType={sourceType} sourceUrl={sourceUrl} targetCount={targetCount}
                    onSourceTypeChange={setSourceType} onSourceUrlChange={setSourceUrl}
                    onTargetCountChange={setTargetCount} channels={channelOptions}
                    channelId={sourceChannelId} onChannelChange={setSourceChannelId}
                    channelsLoading={salesChannels.isLoading}
                  />
                  {sourceType === 'shopify' && (
                    <div className="flex flex-col gap-y-4 rounded-lg border border-ui-border-base p-3">
                      <Text size="small" className="font-medium">
                        {t('FIELD_ADVANCED')}
                      </Text>
                      <div className="flex flex-col gap-y-2">
                        <Label>{t('FIELD_SHOPIFY_STOREFRONT_TOKEN')}</Label>
                        <Input
                          value={storefrontToken}
                          onChange={(e) => setStorefrontToken(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-y-2">
                        <Label>{t('FIELD_SHOPIFY_ADMIN_TOKEN')}</Label>
                        <Input value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {/* Stock location: crear nuevo (default) vs reusar uno existente. */}
                  <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-col">
                        <Label>Reusar stock location existente</Label>
                        <Text size="small" className="text-ui-fg-subtle">
                          Con el toggle apagado, la demo crea su propio depósito
                          (<code>Depósito Demo {name || '<nombre>'}</code>). Prendido,
                          adopta un stock location existente y lo linkea al sales
                          channel de la demo.
                        </Text>
                      </div>
                      <Switch
                        className="shrink-0"
                        checked={reuseStockLocation}
                        onCheckedChange={(v) => {
                          setReuseStockLocation(v);
                          if (!v) setReuseStockLocationId('');
                        }}
                      />
                    </div>
                    {reuseStockLocation && (
                      <div className="flex flex-col gap-y-2">
                        <Label>Stock location a reusar</Label>
                        <Select
                          value={reuseStockLocationId}
                          onValueChange={setReuseStockLocationId}
                        >
                          <Select.Trigger>
                            <Select.Value
                              placeholder={
                                stockLocations.isLoading
                                  ? 'Cargando…'
                                  : 'Elegí un stock location existente'
                              }
                            />
                          </Select.Trigger>
                          <Select.Content className="z-[70]">
                            {stockLocationOptions.map((sl) => (
                              <Select.Item key={sl.id} value={sl.id}>
                                {sl.name}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
                    <div className="flex min-w-0 flex-col">
                      <Label>{t('B2B_TOGGLE')}</Label>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('B2B_TOGGLE_HELP')}
                      </Text>
                    </div>
                    <Switch className="shrink-0" checked={b2bEnabled} onCheckedChange={setB2bEnabled} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
                    <div className="flex min-w-0 flex-col">
                      <Label>{t('RECURRING_TOGGLE')}</Label>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('RECURRING_TOGGLE_HELP')}
                      </Text>
                    </div>
                    <Switch className="shrink-0" checked={recurringEnabled} onCheckedChange={setRecurringEnabled} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
                    <div className="flex min-w-0 flex-col">
                      <Label>{t('TINTING_TOGGLE')}</Label>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('TINTING_TOGGLE_HELP')}
                      </Text>
                    </div>
                    <Switch className="shrink-0" checked={tintingEnabled} onCheckedChange={setTintingEnabled} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
                    <div className="flex min-w-0 flex-col">
                      <Label>{t('LOYALTY_TOGGLE')}</Label>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('LOYALTY_TOGGLE_HELP')}
                      </Text>
                    </div>
                    <Switch className="shrink-0" checked={loyaltyEnabled} onCheckedChange={setLoyaltyEnabled} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-ui-border-base p-3">
                    <div className="flex min-w-0 flex-col">
                      <Label>{t('GIFT_CARDS_TOGGLE')}</Label>
                      <Text size="small" className="text-ui-fg-subtle">
                        {t('GIFT_CARDS_TOGGLE_HELP')}
                      </Text>
                    </div>
                    <Switch className="shrink-0" checked={giftCardsEnabled} onCheckedChange={setGiftCardsEnabled} />
                  </div>
                </div>
              </ProgressTabs.Content>
            </div>
          </FocusModal.Body>
          <FocusModal.Footer>
            <div className="flex w-full items-center justify-between">
              <Button
                variant="secondary"
                size="small"
                disabled={tabIndex === 0}
                onClick={() => setTab(TABS[Math.max(0, tabIndex - 1)]!.value)}
              >
                {t('BACK')}
              </Button>
              {isLast ? (
                <Button
                  size="small"
                  disabled={!canSubmit || availability.data?.available !== true || availability.isFetching}
                  isLoading={create.isPending}
                  onClick={handleSubmit}
                >
                  {t('SUBMIT')}
                </Button>
              ) : (
                <Button
                  size="small"
                  onClick={() => setTab(TABS[Math.min(TABS.length - 1, tabIndex + 1)]!.value)}
                >
                  {t('NEXT')}
                </Button>
              )}
            </div>
          </FocusModal.Footer>
        </ProgressTabs>
      </FocusModal.Content>
    </FocusModal>
  );
};
