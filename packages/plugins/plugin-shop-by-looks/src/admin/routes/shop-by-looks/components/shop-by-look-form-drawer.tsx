import {
  Badge,
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  toast,
} from '@medusajs/ui';
import { Trash } from '@medusajs/icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShopByLook,
  ShopByLookPlacement,
  useCreateShopByLook,
  useShopByLook,
  useUpdateShopByLook,
} from '../../../hooks/api';
import { sdk } from '../../../lib/client';
import { registerShopByLooksTranslations } from '../../../translations/shop-by-looks';

const PLACEMENTS: ShopByLookPlacement[] = [
  'top',
  'after_collections',
  'after_featured',
  'before_footer',
];

const PLACEMENT_LABEL_KEY: Record<ShopByLookPlacement, string> = {
  top: 'PLACEMENT_TOP',
  after_collections: 'PLACEMENT_AFTER_COLLECTIONS',
  after_featured: 'PLACEMENT_AFTER_FEATURED',
  before_footer: 'PLACEMENT_BEFORE_FOOTER',
};

// Centinela para "elegir variante en storefront" (Select prohíbe value="").
const VARIANT_ANY = '__any__';

type ProductRow = {
  product_id: string;
  title: string;
  thumbnail: string | null;
  variants: { id: string; title?: string }[];
  variant_id: string | null;
  pos_x: number;
  pos_y: number;
};

type ProductSearchResult = {
  id: string;
  title: string;
  handle?: string;
  thumbnail?: string | null;
  variants?: { id: string; title?: string }[];
};

const PRODUCT_FIELDS = 'id,title,handle,thumbnail,variants.id,variants.title';

interface Props {
  look: ShopByLook | null; // null = create
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShopByLookFormDrawer = ({ look, open, onOpenChange }: Props) => {
  const { t, i18n } = useTranslation('shop-by-looks');
  registerShopByLooksTranslations(i18n);

  const isEdit = !!look;

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [placement, setPlacement] = useState<ShopByLookPlacement>('after_featured');
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [salesChannelIds, setSalesChannelIds] = useState<string[]>([]);
  const [regionIds, setRegionIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(productSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [productSearch]);

  // Detalle completo del look en edición (trae products).
  const { data: lookData } = useShopByLook(look?.id ?? '', { enabled: isEdit && open });
  const fullLook = lookData?.shop_by_look;

  const { data: channelsData } = useQuery({
    queryKey: ['sbl-sales-channels'],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200, fields: 'id,name' }),
    enabled: open,
  });
  const { data: regionsData } = useQuery({
    queryKey: ['sbl-regions'],
    queryFn: () => sdk.admin.region.list({ limit: 200, fields: 'id,name' }),
    enabled: open,
  });

  const linkedIds = (fullLook?.products ?? []).map((p) => p.product_id);
  const { data: linkedProductsData } = useQuery({
    queryKey: ['sbl-linked-products', linkedIds],
    queryFn: () =>
      sdk.admin.product.list({ id: linkedIds, limit: 100, fields: PRODUCT_FIELDS }),
    enabled: open && linkedIds.length > 0,
  });

  const { data: searchData } = useQuery({
    queryKey: ['sbl-product-search', debounced],
    queryFn: () => sdk.admin.product.list({ q: debounced, limit: 8, fields: PRODUCT_FIELDS }),
    enabled: open && debounced.length >= 2,
  });

  const resetForm = () => {
    setTitle('');
    setSubtitle('');
    setCtaLabel('');
    setImageUrl('');
    setImageAlt('');
    setPlacement('after_featured');
    setIsActive(true);
    setSortOrder(0);
    setSalesChannelIds([]);
    setRegionIds([]);
    setRows([]);
    setProductSearch('');
    setPlacingId(null);
  };

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      resetForm();
      return;
    }
    const source = fullLook ?? look;
    if (!source) return;
    setTitle(source.title ?? '');
    setSubtitle(source.subtitle ?? '');
    setCtaLabel(source.cta_label ?? '');
    setImageUrl(source.image_url ?? '');
    setImageAlt(source.image_alt ?? '');
    setPlacement((source.placement as ShopByLookPlacement) ?? 'after_featured');
    setIsActive(source.is_active ?? true);
    setSortOrder(source.sort_order ?? 0);
    setSalesChannelIds(source.sales_channel_ids ?? []);
    setRegionIds(source.region_ids ?? []);
  }, [open, isEdit, fullLook]);

  useEffect(() => {
    if (!isEdit || !fullLook?.products) return;
    const products = (linkedProductsData?.products ?? []) as ProductSearchResult[];
    const byId = new Map(products.map((p) => [p.id, p]));
    const built: ProductRow[] = [...fullLook.products]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => {
        const detail = byId.get(p.product_id);
        return {
          product_id: p.product_id,
          title: detail?.title ?? p.product_id,
          thumbnail: detail?.thumbnail ?? null,
          variants: detail?.variants ?? [],
          variant_id: p.variant_id,
          pos_x: p.pos_x,
          pos_y: p.pos_y,
        };
      });
    setRows(built);
    setPlacingId((cur) => cur ?? built[0]?.product_id ?? null);
  }, [fullLook?.id, linkedProductsData]);

  const createMutation = useCreateShopByLook({
    onSuccess: () => {
      toast.success(t('CREATE_SUCCESS'));
      onOpenChange(false);
      resetForm();
    },
    onError: (e) => toast.error(t('CREATE_ERROR', { msg: e.message })),
  });
  const updateMutation = useUpdateShopByLook(look?.id ?? '', {
    onSuccess: () => {
      toast.success(t('UPDATE_SUCCESS'));
      onOpenChange(false);
    },
    onError: (e) => toast.error(t('UPDATE_ERROR', { msg: e.message })),
  });
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const uploaded = res.files?.[0];
      if (uploaded?.url) setImageUrl(uploaded.url);
    } catch (error) {
      toast.error(t('UPDATE_ERROR', { msg: (error as Error).message }));
    } finally {
      setIsUploading(false);
    }
  };

  const addProduct = (p: ProductSearchResult) => {
    if (rows.some((r) => r.product_id === p.id)) return;
    setRows((prev) => [
      ...prev,
      {
        product_id: p.id,
        title: p.title,
        thumbnail: p.thumbnail ?? null,
        variants: p.variants ?? [],
        variant_id: null,
        pos_x: 50,
        pos_y: 50,
      },
    ]);
    setPlacingId(p.id);
    setProductSearch('');
    setDebounced('');
  };

  const updateRow = (productId: string, patch: Partial<ProductRow>) =>
    setRows((prev) =>
      prev.map((r) => (r.product_id === productId ? { ...r, ...patch } : r))
    );

  const removeRow = (productId: string) => {
    setRows((prev) => prev.filter((r) => r.product_id !== productId));
    setPlacingId((cur) => (cur === productId ? null : cur));
  };

  const toggleId = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  // ── Posicionamiento de hotspots por click/drag sobre la imagen ──────────────
  const posFromEvent = (e: { clientX: number; clientY: number }) => {
    const el = imageWrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(100, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))),
      y: Math.min(100, Math.max(0, Math.round(((e.clientY - rect.top) / rect.height) * 100))),
    };
  };

  const handleImageClick = (e: React.MouseEvent) => {
    if (!placingId) return;
    const p = posFromEvent(e);
    if (p) updateRow(placingId, { pos_x: p.x, pos_y: p.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId) return;
    const p = posFromEvent(e);
    if (p) updateRow(draggingId, { pos_x: p.x, pos_y: p.y });
  };

  const handleSubmit = async () => {
    if (!title || !imageUrl) {
      toast.error(t('VALIDATION_REQUIRED'));
      return;
    }
    const payload = {
      title,
      subtitle: subtitle || null,
      cta_label: ctaLabel || null,
      image_url: imageUrl,
      image_alt: imageAlt || null,
      placement,
      is_active: isActive,
      sort_order: sortOrder,
      sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
      region_ids: regionIds.length ? regionIds : null,
      products: rows.map((r, i) => ({
        product_id: r.product_id,
        variant_id: r.variant_id,
        pos_x: r.pos_x,
        pos_y: r.pos_y,
        sort_order: i,
      })),
    };
    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const channels = (channelsData?.sales_channels ?? []) as { id: string; name: string }[];
  const regions = (regionsData?.regions ?? []) as { id: string; name: string }[];
  const searchResults = ((searchData?.products ?? []) as ProductSearchResult[]).filter(
    (p) => !rows.some((r) => r.product_id === p.id)
  );

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <span className="sr-only">{isEdit ? t('EDIT_TITLE') : t('CREATE_TITLE')}</span>
          </FocusModal.Title>
          <div className="flex w-full items-center justify-end gap-x-2">
            <Button variant="secondary" size="small" onClick={() => onOpenChange(false)}>
              {t('CANCEL')}
            </Button>
            <Button size="small" onClick={handleSubmit} isLoading={isPending}>
              {isEdit ? t('SAVE_CHANGES') : t('CREATE_SUBMIT')}
            </Button>
          </div>
        </FocusModal.Header>

        <FocusModal.Body className="flex flex-1 overflow-hidden">
          {/* Izquierda: formulario */}
          <div className="flex-1 overflow-y-auto px-8 py-10">
            <div className="mx-auto flex w-full max-w-[640px] flex-col gap-8">
              <Heading>{isEdit ? t('EDIT_TITLE') : t('CREATE_TITLE')}</Heading>

              {/* Básicos */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_TITLE_LABEL')}</Label>
                  <Input
                    placeholder={t('FIELD_TITLE_PLACEHOLDER')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_SUBTITLE_LABEL')}</Label>
                  <Input
                    placeholder={t('FIELD_SUBTITLE_PLACEHOLDER')}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_CTA_LABEL')}</Label>
                  <Input
                    placeholder={t('FIELD_CTA_PLACEHOLDER')}
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                  />
                </div>
              </div>

              {/* Imagen principal */}
              <div className="flex flex-col gap-2 border-t pt-6">
                <Label size="xsmall">{t('FIELD_IMAGE_LABEL')}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageFile}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="small"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={isUploading}
                  >
                    {t('UPLOAD_IMAGE')}
                  </Button>
                  {imageUrl && (
                    <Button
                      type="button"
                      size="small"
                      variant="transparent"
                      onClick={() => setImageUrl('')}
                    >
                      {t('CLEAR_IMAGE')}
                    </Button>
                  )}
                </div>
                <Input
                  placeholder={t('IMAGE_URL_PLACEHOLDER')}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Input
                  placeholder={t('FIELD_IMAGE_ALT_PLACEHOLDER')}
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                />
              </div>

              {/* Productos */}
              <div className="flex flex-col gap-3 border-t pt-6">
                <div>
                  <Heading level="h3">{t('PRODUCTS_TITLE')}</Heading>
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('PRODUCTS_CLICK_HELP')}
                  </Text>
                </div>

                {/* Buscador con miniaturas (estilo blog) */}
                <div className="relative">
                  <Input
                    placeholder={t('SEARCH_PRODUCTS_PLACEHOLDER')}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {debounced.length >= 2 && searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
                      {searchResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addProduct(p)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover"
                        >
                          <Thumb src={p.thumbnail} />
                          <Text size="small">{p.title}</Text>
                        </button>
                      ))}
                    </div>
                  )}
                  {debounced.length >= 2 && searchResults.length === 0 && (
                    <Text size="xsmall" className="mt-1 text-ui-fg-muted">
                      {t('NO_PRODUCTS_FOUND', { query: debounced })}
                    </Text>
                  )}
                </div>

                {rows.length === 0 ? (
                  <Text size="small" className="text-ui-fg-subtle">
                    {t('NO_PRODUCTS')}
                  </Text>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {rows.map((row, i) => {
                      const active = placingId === row.product_id;
                      const showVariant = row.variants.length > 1;
                      return (
                        <li
                          key={row.product_id}
                          onClick={() => setPlacingId(row.product_id)}
                          className={`flex cursor-pointer flex-col gap-2 rounded-lg border p-3 ${
                            active
                              ? 'border-ui-fg-interactive bg-ui-bg-base-hover'
                              : 'border-ui-border-base'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-bg-component text-xs font-semibold">
                              {i + 1}
                            </span>
                            <Thumb src={row.thumbnail} />
                            <Text size="small" className="flex-1 truncate">
                              {row.title}
                            </Text>
                            {active && (
                              <Badge size="2xsmall" color="blue">
                                {t('PLACING_BADGE')}
                              </Badge>
                            )}
                            <Button
                              type="button"
                              variant="transparent"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeRow(row.product_id);
                              }}
                              title={t('REMOVE')}
                            >
                              <Trash className="text-ui-fg-muted" />
                            </Button>
                          </div>
                          {showVariant && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={row.variant_id ?? VARIANT_ANY}
                                onValueChange={(v) =>
                                  updateRow(row.product_id, {
                                    variant_id: v === VARIANT_ANY ? null : v,
                                  })
                                }
                              >
                                <Select.Trigger>
                                  <Select.Value placeholder={t('VARIANT_ANY')} />
                                </Select.Trigger>
                                <Select.Content>
                                  <Select.Item value={VARIANT_ANY}>
                                    {t('VARIANT_ANY')}
                                  </Select.Item>
                                  {row.variants.map((v) => (
                                    <Select.Item key={v.id} value={v.id}>
                                      {v.title || v.id}
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Ubicación + estado + orden */}
              <div className="flex flex-col gap-4 border-t pt-6">
                <div className="flex flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_PLACEMENT_LABEL')}</Label>
                  <Select
                    value={placement}
                    onValueChange={(v) => setPlacement(v as ShopByLookPlacement)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {PLACEMENTS.map((p) => (
                        <Select.Item key={p} value={p}>
                          {t(PLACEMENT_LABEL_KEY[p])}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label size="xsmall">{t('FIELD_ACTIVE_LABEL')}</Label>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('FIELD_ACTIVE_HELP')}
                    </Text>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="flex flex-col gap-1">
                  <Label size="xsmall">{t('FIELD_SORT_ORDER_LABEL')}</Label>
                  <Input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

              {/* Segmentación */}
              <div className="flex flex-col gap-4 border-t pt-6">
                <div className="flex flex-col gap-2">
                  <Label size="xsmall">{t('FIELD_SALES_CHANNELS_LABEL')}</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('FIELD_SALES_CHANNELS_HELP')}
                  </Text>
                  <div className="flex flex-col gap-2">
                    {channels.map((c) => (
                      <label key={c.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={salesChannelIds.includes(c.id)}
                          onCheckedChange={() =>
                            setSalesChannelIds((prev) => toggleId(prev, c.id))
                          }
                        />
                        <Text size="small">{c.name}</Text>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label size="xsmall">{t('FIELD_REGIONS_LABEL')}</Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('FIELD_REGIONS_HELP')}
                  </Text>
                  <div className="flex flex-col gap-2">
                    {regions.map((r) => (
                      <label key={r.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={regionIds.includes(r.id)}
                          onCheckedChange={() => setRegionIds((prev) => toggleId(prev, r.id))}
                        />
                        <Text size="small">{r.name}</Text>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Derecha: preview con hotspots clickeables */}
          <aside className="hidden w-[460px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-ui-border-base bg-ui-bg-subtle px-6 py-6 lg:flex">
            <div className="flex flex-col gap-1">
              <Label className="font-semibold text-ui-fg-base">{t('PREVIEW_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {placingId ? t('PLACE_HINT') : t('PLACE_HINT_SELECT')}
              </Text>
            </div>
            {imageUrl ? (
              <div
                ref={imageWrapRef}
                onClick={handleImageClick}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDraggingId(null)}
                onPointerLeave={() => setDraggingId(null)}
                className="relative w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-base"
              >
                <img
                  src={imageUrl}
                  alt={imageAlt || title}
                  className="block w-full select-none"
                  draggable={false}
                />
                {rows.map((row, i) => {
                  const active = placingId === row.product_id;
                  return (
                    <button
                      key={row.product_id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlacingId(row.product_id);
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setPlacingId(row.product_id);
                        setDraggingId(row.product_id);
                      }}
                      style={{ left: `${row.pos_x}%`, top: `${row.pos_y}%` }}
                      className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full text-xs font-semibold shadow-md ring-2 transition-transform ${
                        active
                          ? 'scale-110 bg-ui-fg-interactive text-ui-fg-on-color ring-ui-fg-on-color'
                          : 'bg-white text-gray-900 ring-gray-900/70'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-ui-border-base">
                <Text size="small" className="text-ui-fg-muted">
                  {t('PREVIEW_EMPTY')}
                </Text>
              </div>
            )}
          </aside>
        </FocusModal.Body>
      </FocusModal.Content>
    </FocusModal>
  );
};

function Thumb({ src }: { src?: string | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}
