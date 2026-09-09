import {
  Badge,
  Button,
  Checkbox,
  DatePicker,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressTabs,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { dateToLocalInput, localInputToDate } from '../../../lib/date';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Banner, BannerCreateInput } from '../../../hooks/api/banners';
import {
  useCreateBanner,
  useUpdateBanner,
} from '../../../hooks/api/banners';
import { registerBannersTranslations } from '../../../translations/banners';
import { BannerPreview } from './banner-preview';
import { getPlacementConfig, type BannerFieldId } from './placement-config';
import { sdk } from '../../../lib/client';
import { SalesChannelMultiSelect } from '@minimalart/mercatto-plugin-runtime/admin';

const STATUSES = ['draft', 'published', 'archived'];
const DEVICE_TYPES = ['all', 'desktop', 'mobile', 'tablet'];
// Iconos disponibles para el top bar. Deben existir en el iconMap del
// storefront (modules/home/components/topbar) — todos son de Heroicons,
// la librería de iconos del front.
const TOPBAR_ICONS = [
  'credit-card',
  'truck',
  'gift',
  'shield',
  'star',
  'tag',
  'sparkles',
  'fire',
  'bolt',
  'clock',
  'phone',
  'map-pin',
  'heart',
  'check-badge',
  'banknotes',
  'shopping-bag',
  'shopping-cart',
  'receipt-percent',
  'ticket',
  'megaphone',
  'bell',
  'globe',
  'rocket',
  'building-storefront',
] as const;
const THEME_COLORS = [
  { labelKey: 'COLOR_THEME_PRIMARY', value: '#2e7d32' },
  { labelKey: 'COLOR_THEME_PRIMARY_DARK', value: '#166534' },
  { labelKey: 'COLOR_THEME_PRIMARY_SOFT', value: '#e8f5e9' },
  { labelKey: 'COLOR_THEME_SURFACE', value: '#ffffff' },
  { labelKey: 'COLOR_THEME_TEXT', value: '#111827' },
  { labelKey: 'COLOR_THEME_MUTED', value: '#6b7280' },
];

export type FormState = {
  internal_name: string;
  handle: string;
  type: string;
  device_type: string;
  status: string;
  priority: string;
  content_title: string;
  content_subtitle: string;
  content_body: string;
  media_url: string;
  cta_url: string;
  cta_label: string;
  cta_target: string;
  icon: string;
  card_color: string;
  icon_color: string;
  text_color: string;
  cta_text_color: string;
  countdown_seconds: string;
  show_logo: boolean;
  splash_bg: string;
  sticky_links: Array<{ url: string; image: string }>;
  start_at: string;
  end_at: string;
  customer_group_ids: string[];
  sales_channel_ids: string[];
};

const EMPTY_FORM: FormState = {
  internal_name: '',
  handle: '',
  type: '',
  device_type: '',
  status: 'draft',
  priority: '0',
  content_title: '',
  content_subtitle: '',
  content_body: '',
  media_url: '',
  cta_url: '',
  cta_label: '',
  cta_target: '_self',
  icon: 'credit-card',
  card_color: '',
  icon_color: '',
  text_color: '',
  cta_text_color: '',
  countdown_seconds: '8',
  show_logo: false,
  splash_bg: 'color',
  sticky_links: [],
  start_at: '',
  end_at: '',
  customer_group_ids: [],
  sales_channel_ids: [],
};

function bannerToForm(banner: Banner): FormState {
  return {
    internal_name: banner.internal_name ?? '',
    handle: banner.handle ?? '',
    type: banner.type ?? '',
    device_type: banner.device_type ?? '',
    status: banner.status,
    priority: String(banner.priority ?? 0),
    content_title: banner.content?.title ?? '',
    content_subtitle: banner.content?.subtitle ?? '',
    content_body: banner.content?.body ?? '',
    media_url: banner.media?.url ?? '',
    cta_url: banner.cta?.url ?? '',
    cta_label: banner.cta?.label ?? '',
    cta_target: banner.cta?.target ?? '_self',
    icon: (banner.metadata?.icon as string | null) ?? 'credit-card',
    card_color: (banner.metadata?.card_color as string | null) ?? '',
    icon_color: (banner.metadata?.icon_color as string | null) ?? '',
    text_color: (banner.metadata?.color_font as string | null) ?? '',
    cta_text_color: (banner.metadata?.cta_color_font as string | null) ?? '',
    countdown_seconds:
      banner.metadata?.countdown_seconds != null
        ? String(banner.metadata.countdown_seconds)
        : '8',
    show_logo:
      banner.metadata?.show_logo === true ||
      banner.metadata?.show_logo === 'true',
    splash_bg:
      banner.metadata?.splash_bg === 'image' ? 'image' : 'color',
    sticky_links: Array.isArray(banner.metadata?.links)
      ? (banner.metadata.links as Array<Record<string, unknown>>).map((l) => ({
          url: String(l?.url ?? ''),
          image: String(l?.image ?? ''),
        }))
      : [],
    start_at: banner.start_at ? banner.start_at.slice(0, 16) : '',
    end_at: banner.end_at ? banner.end_at.slice(0, 16) : '',
    customer_group_ids: banner.rules?.customer_group_ids ?? [],
    sales_channel_ids: banner.rules?.sales_channel_ids ?? [],
  };
}

function formToInput(
  form: FormState,
  placement: string,
  existingRules?: Banner['rules'],
): BannerCreateInput {
  const isTopBar = placement === 'top_bar';
  // Preserve any rules set elsewhere (sales channel, locale, etc.) and only
  // override the customer-group targeting that this form manages.
  const rules: NonNullable<Banner['rules']> = { ...(existingRules ?? {}) };
  if (form.customer_group_ids.length > 0) {
    rules.customer_group_ids = form.customer_group_ids;
  } else {
    delete rules.customer_group_ids;
  }
  if (form.sales_channel_ids.length > 0) {
    rules.sales_channel_ids = form.sales_channel_ids;
  } else {
    delete rules.sales_channel_ids;
  }
  const isSplash = placement === 'welcome_splash';
  const isSticky = placement === 'sticky_footer';
  const metadata: Record<string, unknown> = {};
  if (form.card_color) metadata.card_color = form.card_color;
  if (isTopBar && form.icon) metadata.icon = form.icon;
  if (isTopBar && form.icon_color) metadata.icon_color = form.icon_color;
  // Text colors del banner. `color_font` gobierna titulo/subtitulo, que van
  // sobre la imagen (fondo oscuro/reservado). `cta_color_font` gobierna SOLO
  // el texto del boton CTA, que va sobre `card_color` (posiblemente claro).
  // Antes eran un unico campo y quedaban acoplados: seteabas oscuro para
  // arreglar el CTA sobre bg blanco y el titulo se hacia invisible sobre la
  // imagen. Ahora son independientes; ambos con fallback white en el consumer.
  if (form.text_color) {
    metadata.color_font = form.text_color;
  }
  if (form.cta_text_color) {
    metadata.cta_color_font = form.cta_text_color;
  }
  if (isSplash && form.countdown_seconds) {
    metadata.countdown_seconds = form.countdown_seconds;
  }
  if (isSplash) {
    metadata.show_logo = form.show_logo ? 'true' : 'false';
    metadata.splash_bg = form.splash_bg === 'image' ? 'image' : 'color';
  }
  if (isSticky) {
    metadata.links = form.sticky_links.filter((l) => l.url || l.image);
  }

  return {
    internal_name: form.internal_name || undefined,
    handle: form.handle || undefined,
    type: form.type || undefined,
    // El splash es siempre mobile (sin selector de dispositivo en el form).
    device_type: isSplash ? 'mobile' : form.device_type || undefined,
    placement,
    status: form.status,
    priority: Number(form.priority) || 0,
    content:
      form.content_title || form.content_subtitle || form.content_body
        ? {
            title: form.content_title || undefined,
            subtitle: form.content_subtitle || undefined,
            body: form.content_body || undefined,
          }
        : null,
    media: !isTopBar && form.media_url ? { url: form.media_url } : null,
    cta: !isTopBar && form.cta_url
      ? {
          url: form.cta_url,
          label: form.cta_label || undefined,
          target: form.cta_target || '_self',
        }
      : null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    rules: Object.keys(rules).length > 0 ? rules : null,
    start_at: form.start_at ? form.start_at : null,
    end_at: form.end_at ? form.end_at : null,
  };
}

/** Sub-groups (A-F per spec) rendered as boxes inside each tab. */
const FIELD_GROUPS: Array<{ titleKey: string; fields: BannerFieldId[] }> = [
  {
    titleKey: 'SECTION_BASIC',
    fields: ['internal_name', 'status', 'device_type', 'type', 'priority'],
  },
  { titleKey: 'SECTION_CONTENT', fields: ['content_title', 'content_subtitle', 'content_body'] },
  { titleKey: 'SECTION_MEDIA', fields: ['splash_bg', 'media_url'] },
  { titleKey: 'SECTION_CTA', fields: ['cta_url', 'cta_label', 'cta_target'] },
  {
    titleKey: 'SECTION_STYLE',
    fields: [
      'icon',
      'card_color',
      'icon_color',
      'text_color',
      'cta_text_color',
      'show_logo',
      'countdown_seconds',
    ],
  },
  { titleKey: 'SECTION_LINKS', fields: ['sticky_links'] },
  { titleKey: 'SECTION_SCHEDULE', fields: ['start_at', 'end_at'] },
  { titleKey: 'SECTION_TARGETING', fields: ['customer_group_ids'] },
];

/** Progress tabs: each tab hosts one or more field groups. */
const TAB_DEFS: Array<{ id: string; labelKey: string; groupKeys: string[] }> = [
  { id: 'basic', labelKey: 'SECTION_BASIC', groupKeys: ['SECTION_BASIC'] },
  { id: 'content', labelKey: 'SECTION_CONTENT', groupKeys: ['SECTION_CONTENT'] },
  { id: 'media', labelKey: 'TAB_MEDIA_CTA', groupKeys: ['SECTION_MEDIA', 'SECTION_LINKS', 'SECTION_CTA', 'SECTION_STYLE'] },
  { id: 'schedule', labelKey: 'SECTION_SCHEDULE', groupKeys: ['SECTION_SCHEDULE'] },
  { id: 'targeting', labelKey: 'SECTION_TARGETING', groupKeys: ['SECTION_TARGETING'] },
];

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** The container being edited — items never change placement from this form. */
  placement: string;
  banner?: Banner | null;
  /**
   * Valores iniciales para un banner NUEVO (ej: el "slide" generado con IA).
   * Se ignora al editar (`banner` manda). Se mergea sobre EMPTY_FORM al abrir.
   */
  initialForm?: Partial<FormState> | null;
};

export function BannerFormDrawer({ open, onClose, placement, banner, initialForm }: Props) {
  const { t, i18n } = useTranslation('banners');
  registerBannersTranslations(i18n);

  const config = getPlacementConfig(placement);
  const isEditing = !!banner;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('basic');
  const [nameError, setNameError] = useState<string | null>(null);

  const { mutateAsync: createBanner, isPending: isCreating } = useCreateBanner();
  const { mutateAsync: updateBanner, isPending: isUpdating } = useUpdateBanner(banner?.id ?? '');
  const isPending = isCreating || isUpdating;

  useEffect(() => {
    if (open) {
      setForm(
        banner
          ? bannerToForm(banner)
          : { ...EMPTY_FORM, ...(initialForm ?? {}) },
      );
      setActiveTab('basic');
      setNameError(null);
    }
  }, [open, banner, initialForm]);

  // `customer_group_ids` (audience targeting) is not placement-specific, so it
  // is always available regardless of the placement's visibleFields config.
  const visible = useMemo(
    () => new Set<BannerFieldId>([...config.visibleFields, 'customer_group_ids']),
    [config],
  );

  const { data: customerGroupsData } = useQuery({
    queryKey: ['admin', 'customer-groups', 'all'],
    queryFn: () =>
      sdk.admin.customerGroup.list({ limit: 200, fields: 'id,name' }),
    staleTime: 60_000,
  });
  const customerGroups = customerGroupsData?.customer_groups ?? [];

  const toggleCustomerGroup = (id: string) => {
    setForm((prev) => ({
      ...prev,
      customer_group_ids: prev.customer_group_ids.includes(id)
        ? prev.customer_group_ids.filter((g) => g !== id)
        : [...prev.customer_group_ids, id],
    }));
  };

  /** Tabs that have at least one visible field. Hidden fields are intentionally omitted. */
  const tabs = useMemo(() => {
    const groupByKey = new Map(FIELD_GROUPS.map((g) => [g.titleKey, g]));
    return TAB_DEFS.map((tab) => ({
      ...tab,
      groups: tab.groupKeys
        .map((key) => {
          const group = groupByKey.get(key)!;
          return { ...group, fields: group.fields.filter((f) => visible.has(f)) };
        })
        .filter((group) => group.fields.length > 0),
    })).filter((tab) => tab.groups.length > 0);
  }, [visible]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );
  const isLastTab = activeIndex === tabs.length - 1;
  const [uploadingMedia, setUploadingMedia] = useState(false);

  async function handleMediaUpload(file: File) {
    setUploadingMedia(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = res.files?.[0]?.url;
      if (url) {
        set('media_url', url);
        toast.success(t('MEDIA_UPLOAD_SUCCESS'));
      }
    } catch (error: any) {
      toast.error(t('MEDIA_UPLOAD_FAILED', { msg: error?.message ?? '' }));
    } finally {
      setUploadingMedia(false);
    }
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'internal_name' && value.trim().length >= 2) {
      setNameError(null);
    }
  }

  const setStickyLinks = (links: Array<{ url: string; image: string }>) =>
    setForm((prev) => ({ ...prev, sticky_links: links }));

  const renderColorField = (
    field: 'card_color' | 'icon_color' | 'text_color' | 'cta_text_color',
    labelKey: string,
    placeholderKey: string,
  ) => {
    const value = form[field];
    const pickerValue = isHexColor(value) ? value : '#ffffff';

    return (
      <div key={field} className="flex flex-col gap-2">
        <Label size="xsmall">{t(labelKey)}</Label>
        <div className="flex flex-wrap gap-2">
          {THEME_COLORS.map((color) => (
            <button
              key={`${field}-${color.value}`}
              type="button"
              className={`h-7 w-7 rounded-md border ${
                value.toLowerCase() === color.value.toLowerCase()
                  ? 'border-ui-fg-base shadow-borders-focus'
                  : 'border-ui-border-base'
              }`}
              style={{ backgroundColor: color.value }}
              aria-label={t(color.labelKey)}
              title={t(color.labelKey)}
              onClick={() => set(field, color.value)}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => set(field, e.target.value)}
            className="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-ui-border-base bg-ui-bg-field p-0.5"
            aria-label={t(labelKey)}
          />
          <Input
            className="flex-1"
            value={value}
            onChange={(e) => set(field, e.target.value)}
            placeholder={t(placeholderKey)}
          />
        </div>
      </div>
    );
  };

  function validateName(): boolean {
    if (form.internal_name.trim().length < 2) {
      setNameError(t('ERROR_INTERNAL_NAME'));
      setActiveTab(tabs[0]?.id ?? 'basic');
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateName()) return;
    // Footer sticky: si no hay enlaces (logos), el botón (CTA) es obligatorio.
    if (placement === 'sticky_footer') {
      const links = form.sticky_links.filter((l) => l.url || l.image);
      if (links.length === 0 && (!form.cta_url.trim() || !form.cta_label.trim())) {
        toast.error(t('ERROR_STICKY_REQUIRES_CTA'));
        setActiveTab('media');
        return;
      }
    }
    const input = formToInput(form, placement, banner?.rules);
    try {
      if (isEditing) {
        await updateBanner(input);
        toast.success(t('TOAST_UPDATED'));
      } else {
        await createBanner(input);
        toast.success(t('TOAST_CREATED'));
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('TOAST_SAVE_FAILED'));
    }
  }

  const renderField = (field: BannerFieldId) => {
    switch (field) {
      case 'internal_name':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_INTERNAL_NAME')}</Label>
            <Input
              value={form.internal_name}
              onChange={(e) => set('internal_name', e.target.value)}
              placeholder={t('PLACEHOLDER_INTERNAL_NAME')}
              aria-invalid={!!nameError}
            />
            {nameError ? (
              <Text size="xsmall" className="text-ui-fg-error">
                {nameError}
              </Text>
            ) : null}
          </div>
        );
      case 'status':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_STATUS')}</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v)}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                {STATUSES.map((s) => (
                  <Select.Item key={s} value={s}>
                    {t(`STATUS_${s.toUpperCase()}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        );
      case 'device_type':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_DEVICE')}</Label>
            <Select value={form.device_type} onValueChange={(v) => set('device_type', v)}>
              <Select.Trigger>
                <Select.Value placeholder={t('PLACEHOLDER_DEVICE')} />
              </Select.Trigger>
              <Select.Content>
                {DEVICE_TYPES.map((d) => (
                  <Select.Item key={d} value={d}>
                    {t(`DEVICE_${d.toUpperCase()}`)}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        );
      case 'type':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_TYPE')}</Label>
            <Input
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              placeholder={t('PLACEHOLDER_TYPE')}
            />
          </div>
        );
      case 'priority':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_PRIORITY')}</Label>
            <Input
              type="number"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
            />
          </div>
        );
      case 'splash_bg':
        return (
          <div key={field} className="flex flex-col gap-2">
            <Label size="xsmall">{t('FIELD_SPLASH_BG')}</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('HELP_SPLASH_BG')}
            </Text>
            <div className="flex gap-2">
              {(['color', 'image'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => set('splash_bg', mode)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-left txt-compact-small transition ${
                    (form.splash_bg || 'color') === mode
                      ? 'border-ui-fg-base bg-ui-bg-base shadow-borders-focus'
                      : 'border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base-hover'
                  }`}
                >
                  <span className="block font-medium text-ui-fg-base">
                    {t(mode === 'color' ? 'SPLASH_BG_COLOR' : 'SPLASH_BG_IMAGE')}
                  </span>
                  <span className="block text-ui-fg-subtle txt-compact-xsmall">
                    {t(
                      mode === 'color'
                        ? 'SPLASH_BG_COLOR_HELP'
                        : 'SPLASH_BG_IMAGE_HELP',
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'show_logo':
        return (
          <div key={field} className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <Label size="xsmall">{t('FIELD_SHOW_LOGO')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('HELP_SHOW_LOGO')}
              </Text>
            </div>
            <Switch
              checked={form.show_logo}
              onCheckedChange={(v) => set('show_logo', v)}
            />
          </div>
        );
      case 'sticky_links':
        return (
          <div key={field} className="flex flex-col gap-2">
            <Label size="xsmall">{t('FIELD_STICKY_LINKS')}</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('HELP_STICKY_LINKS')}
            </Text>
            {form.sticky_links.map((row, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-ui-border-base p-2"
              >
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_STICKY_LINK_IMAGE')}</Label>
                  <Input
                    value={row.image}
                    placeholder="https://…/logo.png"
                    onChange={(e) =>
                      setStickyLinks(
                        form.sticky_links.map((r, idx) =>
                          idx === i ? { ...r, image: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </div>
                <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_STICKY_LINK_URL')}</Label>
                  <Input
                    value={row.url}
                    placeholder="/store?brand=…"
                    onChange={(e) =>
                      setStickyLinks(
                        form.sticky_links.map((r, idx) =>
                          idx === i ? { ...r, url: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  variant="transparent"
                  size="small"
                  type="button"
                  onClick={() =>
                    setStickyLinks(form.sticky_links.filter((_, idx) => idx !== i))
                  }
                >
                  Quitar
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="small"
              type="button"
              disabled={form.sticky_links.length >= 4}
              onClick={() =>
                setStickyLinks([...form.sticky_links, { url: '', image: '' }])
              }
            >
              {t('ADD_STICKY_LINK')}
            </Button>
          </div>
        );
      case 'countdown_seconds':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_COUNTDOWN_SECONDS')}</Label>
            <Input
              type="number"
              min="0"
              max="120"
              value={form.countdown_seconds}
              onChange={(e) => set('countdown_seconds', e.target.value)}
              placeholder="8"
            />
            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('HELP_COUNTDOWN_SECONDS')}
            </Text>
          </div>
        );
      case 'content_title':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_CONTENT_TITLE')}</Label>
            <Input
              value={form.content_title}
              onChange={(e) => set('content_title', e.target.value)}
            />
          </div>
        );
      case 'content_subtitle':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_CONTENT_SUBTITLE')}</Label>
            <Input
              value={form.content_subtitle}
              onChange={(e) => set('content_subtitle', e.target.value)}
            />
          </div>
        );
      case 'content_body':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_CONTENT_BODY')}</Label>
            <Textarea
              value={form.content_body}
              onChange={(e) => set('content_body', e.target.value)}
              rows={3}
            />
          </div>
        );
      case 'media_url':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_MEDIA_URL')}</Label>
            <Input
              value={form.media_url}
              onChange={(e) => set('media_url', e.target.value)}
              placeholder="https://..."
            />
            <div className="mt-1 flex items-center gap-2">
              <label
                className={`inline-flex w-fit items-center gap-2 rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-1.5 text-ui-fg-base shadow-borders-base txt-compact-small-plus ${
                  uploadingMedia
                    ? 'cursor-not-allowed opacity-60'
                    : 'cursor-pointer hover:bg-ui-bg-base-hover'
                }`}
              >
                {uploadingMedia ? t('MEDIA_UPLOADING') : t('MEDIA_UPLOAD_BUTTON')}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  disabled={uploadingMedia}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleMediaUpload(file);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('MEDIA_UPLOAD_HINT')}
              </Text>
            </div>
          </div>
        );
      case 'cta_url':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_CTA_URL')}</Label>
            <Input
              value={form.cta_url}
              onChange={(e) => set('cta_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
        );
      case 'cta_label':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_CTA_LABEL')}</Label>
            <Input
              value={form.cta_label}
              onChange={(e) => set('cta_label', e.target.value)}
              placeholder={t('PLACEHOLDER_CTA_LABEL')}
            />
          </div>
        );
      case 'cta_target':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_CTA_TARGET')}</Label>
            <Select value={form.cta_target} onValueChange={(v) => set('cta_target', v)}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="_self">{t('TARGET_SELF')}</Select.Item>
                <Select.Item value="_blank">{t('TARGET_BLANK')}</Select.Item>
              </Select.Content>
            </Select>
          </div>
        );
      case 'icon':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_ICON')}</Label>
            <Select value={form.icon} onValueChange={(v) => set('icon', v)}>
              <Select.Trigger>
                <Select.Value placeholder={t('PLACEHOLDER_ICON')} />
              </Select.Trigger>
              <Select.Content>
                {TOPBAR_ICONS.map((icon) => (
                  <Select.Item key={icon} value={icon}>
                    {t(`ICON_${icon.replace(/-/g, '_').toUpperCase()}`, {
                      defaultValue: icon
                        .replace(/-/g, ' ')
                        .replace(/^./, (c) => c.toUpperCase()),
                    })}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        );
      case 'card_color':
        return renderColorField('card_color', 'FIELD_BACKGROUND_COLOR', 'PLACEHOLDER_CARD_COLOR');
      case 'icon_color':
        return renderColorField('icon_color', 'FIELD_ICON_COLOR', 'PLACEHOLDER_ICON_COLOR');
      case 'text_color':
        return renderColorField('text_color', 'FIELD_TEXT_COLOR', 'PLACEHOLDER_TEXT_COLOR');
      case 'cta_text_color':
        return renderColorField('cta_text_color', 'FIELD_CTA_TEXT_COLOR', 'PLACEHOLDER_CTA_TEXT_COLOR');
      case 'start_at':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_START_AT')}</Label>
            <DatePicker
              granularity="minute"
              value={localInputToDate(form.start_at)}
              onChange={(d) => set('start_at', dateToLocalInput(d))}
            />
          </div>
        );
      case 'end_at':
        return (
          <div key={field} className="flex flex-col gap-1">
            <Label size="xsmall">{t('FIELD_END_AT')}</Label>
            <DatePicker
              granularity="minute"
              value={localInputToDate(form.end_at)}
              onChange={(d) => set('end_at', dateToLocalInput(d))}
            />
          </div>
        );
      case 'customer_group_ids':
        return (
          <div key={field} className="flex flex-col gap-2">
            <Label size="xsmall">{t('FIELD_CUSTOMER_GROUPS')}</Label>
            <Text size="xsmall" className="text-ui-fg-subtle">
              {form.customer_group_ids.length === 0
                ? t('TARGETING_ALL_HINT')
                : t('TARGETING_SELECTED_HINT')}
            </Text>
            {customerGroups.length === 0 ? (
              <Text size="small" className="text-ui-fg-muted">
                {t('TARGETING_NO_GROUPS')}
              </Text>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
                {customerGroups.map((group: { id: string; name?: string }) => (
                  <label
                    key={group.id}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      checked={form.customer_group_ids.includes(group.id)}
                      onCheckedChange={() => toggleCustomerGroup(group.id)}
                    />
                    <Text size="small">{group.name ?? group.id}</Text>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FocusModal open={open} onOpenChange={(v) => !v && onClose()}>
      <FocusModal.Content>
        <ProgressTabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex h-full flex-col overflow-hidden"
        >
          <FocusModal.Header className="flex items-center gap-4">
            <FocusModal.Title asChild>
              <span className="sr-only">
                {isEditing
                  ? t('FORM_EDIT_ITEM_TITLE', { item: t(config.itemLabelKey) })
                  : t('FORM_CREATE_ITEM_TITLE', { item: t(config.itemLabelKey) })}
              </span>
            </FocusModal.Title>
            <div className="-my-2 w-full border-l">
              <ProgressTabs.List>
                {tabs.map((tab, index) => (
                  <ProgressTabs.Trigger
                    key={tab.id}
                    value={tab.id}
                    status={
                      index < activeIndex
                        ? 'completed'
                        : index === activeIndex
                          ? 'in-progress'
                          : 'not-started'
                    }
                  >
                    {t(tab.labelKey)}
                  </ProgressTabs.Trigger>
                ))}
              </ProgressTabs.List>
            </div>
          </FocusModal.Header>

          <FocusModal.Body className="flex flex-1 overflow-hidden">
            <form id="banner-form" onSubmit={handleSubmit} className="flex w-full">
              {/* Left: active tab fields (promotions-creator style: plain sections) */}
              <div className="flex-1 overflow-y-auto px-8 py-12">
                <div className="mx-auto flex w-full max-w-[640px] flex-col">
                  {tabs.map((tab) => (
                    <ProgressTabs.Content
                      key={tab.id}
                      value={tab.id}
                      className="flex flex-col gap-8"
                    >
                      <div className="flex items-center gap-2">
                        <Heading>{t(tab.labelKey)}</Heading>
                        <Badge size="2xsmall">{t(config.labelKey)}</Badge>
                      </div>
                      {tab.groups.map((group) => (
                        <div key={group.titleKey} className="flex flex-col gap-4">
                          {tab.groups.length > 1 ? (
                            <Text size="small" weight="plus" className="text-ui-fg-base">
                              {t(group.titleKey)}
                            </Text>
                          ) : null}
                          {group.fields.map(renderField)}
                        </div>
                      ))}
                      {/* Segmentación por sales channel (no es placement-specific,
                          se maneja aparte de las FIELD_GROUPS). */}
                      {tab.id === 'targeting' ? (
                        <SalesChannelMultiSelect
                          value={form.sales_channel_ids}
                          onChange={(ids) =>
                            setForm((prev) => ({ ...prev, sales_channel_ids: ids }))
                          }
                          label={t('FIELD_SALES_CHANNELS', {
                            defaultValue: 'Canales de venta',
                          })}
                          help={t('SALES_CHANNELS_HELP', {
                            defaultValue: 'Vacío = visible en todos los canales.',
                          })}
                        />
                      ) : null}
                    </ProgressTabs.Content>
                  ))}
                </div>
              </div>

              {/* Right: live preview, persistent across tabs */}
              <aside className="hidden w-[400px] shrink-0 overflow-y-auto border-l border-ui-border-base bg-ui-bg-subtle px-6 py-6 lg:block">
                <div className="flex flex-col gap-2">
                  <Label className="font-semibold text-ui-fg-base">{t('PREVIEW_TITLE')}</Label>
                  <BannerPreview
                    kind={config.preview}
                    data={{
                      title: form.content_title || undefined,
                      subtitle: form.content_subtitle || undefined,
                      body: form.content_body || undefined,
                      mediaUrl: form.media_url || undefined,
                      ctaUrl: form.cta_url || undefined,
                      ctaLabel: form.cta_label || undefined,
                      icon: form.icon || undefined,
                      cardColor: form.card_color || undefined,
                      iconColor: form.icon_color || undefined,
                      textColor: form.text_color || undefined,
                      showLogo: form.show_logo,
                      splashBg: form.splash_bg === 'image' ? 'image' : 'color',
                      links: form.sticky_links.filter((l) => l.url || l.image),
                    }}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('PREVIEW_HINT')}
                  </Text>
                </div>
              </aside>
            </form>
          </FocusModal.Body>

          <FocusModal.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Button variant="secondary" size="small" onClick={onClose} disabled={isPending}>
                {t('BTN_CANCEL')}
              </Button>
              {isEditing || isLastTab ? (
                <Button type="submit" size="small" form="banner-form" isLoading={isPending}>
                  {isEditing ? t('BTN_SAVE') : t('CREATE_BUTTON')}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="small"
                  onClick={() => {
                    if (activeIndex === 0 && !validateName()) return;
                    const next = tabs[activeIndex + 1];
                    if (next) setActiveTab(next.id);
                  }}
                >
                  {t('BTN_CONTINUE')}
                </Button>
              )}
            </div>
          </FocusModal.Footer>
        </ProgressTabs>
      </FocusModal.Content>
    </FocusModal>
  );
}
