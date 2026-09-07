import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  ProgressTabs,
  Select,
  Switch,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sdk } from '../../../lib/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  AdminCreateStoreLocation,
  AdminStoreLocationResponse,
  BusinessHours,
  StoreLocation,
  StoreLocationType,
  storeLocationQueryKey,
  useBranchConfig,
  useBranchDelivery,
  useCoverages,
  useStoreLocation,
} from '../../../hooks/api';
import { registerStoreLocationsTranslations } from '../../../translations/store-locations';
import { SalesChannelMultiSelect } from '../../../components/sales-channel-multiselect';
import {
  BusinessHoursEditor,
  defaultBusinessHours,
  normalizeBusinessHours,
} from './business-hours-editor';
import { LocationPicker, PickedAddress } from './location-picker';
import { ImageUploader } from './image-uploader';
import {
  BranchConfigSection,
  BranchConfigFormState,
  emptyBranchConfig,
  fromBranchConfig,
} from './branch-config-section';
import {
  CoverageSection,
  CoverageDraft,
  fromCoverageItem,
} from './coverage-section';
import {
  DeliverySection,
  DeliveryFormState,
  emptyDelivery,
  fromDelivery,
} from './delivery-section';

const STORE_TYPES: StoreLocationType[] = ['point_of_sale', 'wholesale', 'distribution_center'];

export const STORE_TYPE_LABEL_KEY: Record<StoreLocationType, string> = {
  point_of_sale: 'TYPE_POINT_OF_SALE',
  wholesale: 'TYPE_WHOLESALE',
  distribution_center: 'TYPE_DISTRIBUTION_CENTER',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

interface FormState {
  name: string;
  store_type: StoreLocationType;
  code: string;
  is_visible: boolean;
  /** Storefront visibility scope; empty = every channel. */
  sales_channel_ids: string[];
  active: boolean;
  province: string;
  city: string;
  street: string;
  lat: string;
  lng: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  linkedin: string;
  images: [string, string, string];
  delivers_kits: boolean;
  delivery_pin: string;
  business_hours: BusinessHours;
}

const emptyForm = (): FormState => ({
  name: '',
  store_type: 'point_of_sale',
  code: '',
  is_visible: false,
  sales_channel_ids: [],
  active: true,
  province: '',
  city: '',
  street: '',
  lat: '',
  lng: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  linkedin: '',
  images: ['', '', ''],
  delivers_kits: false,
  delivery_pin: '',
  business_hours: defaultBusinessHours(),
});

const fromLocation = (location: StoreLocation): FormState => {
  const images = Array.isArray(location.images) ? location.images : [];
  return {
    name: location.name ?? '',
    store_type: location.store_type ?? 'point_of_sale',
    code: location.code ?? '',
    is_visible: !!location.is_visible,
    sales_channel_ids: Array.isArray(location.sales_channel_ids)
      ? location.sales_channel_ids
      : [],
    active: location.active ?? true,
    province: location.province ?? '',
    city: location.city ?? '',
    street: location.street ?? '',
    lat: location.lat ?? '',
    lng: location.lng ?? '',
    phone: location.phone ?? '',
    whatsapp: location.whatsapp ?? '',
    email: location.email ?? '',
    website: location.website ?? '',
    instagram: location.instagram ?? '',
    facebook: location.facebook ?? '',
    tiktok: location.tiktok ?? '',
    linkedin: location.linkedin ?? '',
    images: [images[0] ?? '', images[1] ?? '', images[2] ?? ''],
    delivers_kits: !!location.delivers_kits,
    delivery_pin: location.delivery_pin ? String(location.delivery_pin) : '',
    business_hours: normalizeBusinessHours(location.business_hours),
  };
};

/** All tabs are shown in both create and edit; everything saves together. */
const TABS = [
  { id: 'general', labelKey: 'TAB_GENERAL' },
  { id: 'location', labelKey: 'TAB_LOCATION' },
  { id: 'hours', labelKey: 'SECTION_HOURS' },
  { id: 'contact', labelKey: 'TAB_CONTACT' },
  { id: 'media', labelKey: 'TAB_MEDIA' },
  { id: 'commercial', labelKey: 'SECTION_BRANCH' },
  { id: 'coverage', labelKey: 'SECTION_COVERAGE' },
  { id: 'delivery', labelKey: 'SECTION_DELIVERY' },
] as const;

interface StoreLocationFormProps {
  /** When set, the modal edits this location; otherwise it creates a new one. */
  location?: StoreLocation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Render the trigger button (create mode). */
  withTrigger?: boolean;
}

/**
 * Create/edit a store location (branch) in a FocusModal with ProgressTabs.
 *
 * All tabs (General, Location, Hours, Contact, Images, Commercial, Coverage,
 * Delivery) are available in both create and edit, and persist together via a
 * single "Save" action: the branch is created/updated first, then its delivery,
 * commercial wiring and coverage polygons are saved against its id.
 *
 * In edit mode the location and its sections are re-fetched by id so the form
 * always shows fresh, complete data regardless of what the table row carried.
 */
export const StoreLocationForm = ({
  location,
  open,
  onOpenChange,
  withTrigger = false,
}: StoreLocationFormProps) => {
  const { t, i18n } = useTranslation('storeLocations');
  registerStoreLocationsTranslations(i18n);
  const queryClient = useQueryClient();
  const isEdit = !!location;
  const locationId = location?.id ?? '';

  const [form, setForm] = useState<FormState>(emptyForm());
  const [delivery, setDelivery] = useState<DeliveryFormState>(emptyDelivery());
  const [coverages, setCoverages] = useState<CoverageDraft[]>([]);
  const [branchCfg, setBranchCfg] = useState<BranchConfigFormState>(emptyBranchConfig());
  const [activeTab, setActiveTab] = useState<string>('general');
  const [saving, setSaving] = useState(false);

  // Edit-mode: fetch fresh location + sections by id (don't trust the row).
  const { data: freshData } = useStoreLocation(locationId, { enabled: isEdit && open });
  const { data: covData } = useCoverages(locationId, { enabled: isEdit && open });
  const { data: delData } = useBranchDelivery(locationId, { enabled: isEdit && open });
  const { data: cfgData } = useBranchConfig(locationId, { enabled: isEdit && open });

  // Reset everything when the modal (re)opens; seed core from the row immediately.
  const seeded = useRef({ core: false, cov: false, del: false, cfg: false });
  useEffect(() => {
    if (!open) return;
    seeded.current = { core: false, cov: false, del: false, cfg: false };
    setForm(location ? fromLocation(location) : emptyForm());
    setDelivery(emptyDelivery());
    setCoverages([]);
    setBranchCfg(emptyBranchConfig());
    setActiveTab('general');
  }, [open, location]);

  // Seed each slice once its fresh data arrives (edit mode).
  useEffect(() => {
    if (freshData?.store_location && !seeded.current.core) {
      setForm(fromLocation(freshData.store_location));
      seeded.current.core = true;
    }
  }, [freshData]);
  useEffect(() => {
    if (covData?.coverages && !seeded.current.cov) {
      setCoverages(covData.coverages.map(fromCoverageItem));
      seeded.current.cov = true;
    }
  }, [covData]);
  useEffect(() => {
    if (delData && !seeded.current.del) {
      setDelivery(fromDelivery(delData.delivery));
      seeded.current.del = true;
    }
  }, [delData]);
  useEffect(() => {
    if (cfgData?.branch_config && !seeded.current.cfg) {
      setBranchCfg(fromBranchConfig(cfgData.branch_config));
      seeded.current.cfg = true;
    }
  }, [cfgData]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setImage = (index: number, value: string) =>
    setForm((prev) => {
      const images = [...prev.images] as FormState['images'];
      images[index] = value;
      return { ...prev, images };
    });

  const generatePin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000);
    set('delivery_pin', String(pin));
  };

  const center = useMemo(
    () =>
      form.lat && form.lng && Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng))
        ? { lat: Number(form.lat), lng: Number(form.lng) }
        : null,
    [form.lat, form.lng],
  );

  const buildPayload = (): AdminCreateStoreLocation | null => {
    if (!form.name || !form.store_type || !form.province || !form.city || !form.street) {
      toast.error(t('VALIDATION_REQUIRED'));
      setActiveTab(!form.name || !form.store_type ? 'general' : 'location');
      return null;
    }
    if (form.email && !EMAIL_RE.test(form.email)) {
      toast.error(t('VALIDATION_EMAIL'));
      setActiveTab('contact');
      return null;
    }
    let deliveryPin: number | null = null;
    if (form.delivery_pin.trim()) {
      deliveryPin = Number(form.delivery_pin.trim());
      if (!Number.isInteger(deliveryPin) || deliveryPin < 100000 || deliveryPin > 999999) {
        toast.error(t('VALIDATION_PIN'));
        setActiveTab('media');
        return null;
      }
    }
    const images = form.images.map((url) => url.trim()).filter(Boolean);
    return {
      name: form.name.trim(),
      store_type: form.store_type,
      province: form.province.trim(),
      city: form.city.trim(),
      street: form.street.trim(),
      code: form.code.trim() || null,
      is_visible: form.is_visible,
      // Always send the key so clearing every channel really clears the scope
      // (the update route only touches the field when it's present).
      sales_channel_ids: form.sales_channel_ids.length ? form.sales_channel_ids : null,
      active: form.active,
      lat: form.lat.trim() || null,
      lng: form.lng.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      instagram: form.instagram.trim() || null,
      facebook: form.facebook.trim() || null,
      tiktok: form.tiktok.trim() || null,
      linkedin: form.linkedin.trim() || null,
      images: images.length ? images : null,
      delivers_kits: form.delivers_kits,
      delivery_pin: deliveryPin,
      business_hours: form.business_hours,
    };
  };

  /** Persist delivery, commercial config and coverages against the branch id. */
  const saveSections = async (id: string): Promise<string[]> => {
    const errors: string[] = [];

    // Delivery (always upsert — informational, has sensible defaults).
    try {
      const parsed = delivery.lead_time_hours.trim()
        ? Number.parseInt(delivery.lead_time_hours.trim(), 10)
        : null;
      await sdk.client.fetch(`/admin/store-locations/${id}/delivery`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: {
          active: delivery.active,
          timezone: delivery.timezone.trim() || null,
          lead_time_hours: parsed != null && Number.isFinite(parsed) ? parsed : null,
          schedules: delivery.schedules,
        },
      });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'delivery');
    }

    // Commercial config — only when there's something to wire.
    if (branchCfg.stock_location_id || branchCfg.channels.length) {
      try {
        await sdk.client.fetch(`/admin/store-locations/${id}/branch-config`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: {
            active: form.active,
            stock_location_id: branchCfg.stock_location_id || null,
            sales_channels: branchCfg.channels,
          },
        });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'branch-config');
      }
    }

    // Coverages — create new, update changed, delete removed.
    for (const c of coverages) {
      try {
        if (c._deleted) {
          if (c.id) {
            await sdk.client.fetch(`/admin/store-locations/${id}/coverage/${c.id}`, {
              method: 'DELETE',
            });
          }
          continue;
        }
        const body = {
          name: c.name,
          polygon: c.polygon,
          priority: Number.parseInt(c.priority, 10) || 0,
          active: c.active,
        };
        if (!c.id) {
          await sdk.client.fetch(`/admin/store-locations/${id}/coverage`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body,
          });
        } else if (c._dirty) {
          await sdk.client.fetch(`/admin/store-locations/${id}/coverage/${c.id}`, {
            method: 'POST',
            headers: JSON_HEADERS,
            body,
          });
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : 'coverage');
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const payload = buildPayload();
    if (!payload) return;

    setSaving(true);
    try {
      let id = location?.id;
      if (isEdit && id) {
        await sdk.client.fetch(`/admin/store-locations/${id}`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: payload,
        });
      } else {
        const res = await sdk.client.fetch<AdminStoreLocationResponse>('/admin/store-locations', {
          method: 'POST',
          headers: JSON_HEADERS,
          body: payload,
        });
        id = res?.store_location?.id;
      }
      if (!id) throw new Error('missing store location id');

      const sectionErrors = await saveSections(id);

      queryClient.invalidateQueries({ queryKey: storeLocationQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: storeLocationQueryKey.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['store-location', id, 'coverage'] });
      queryClient.invalidateQueries({ queryKey: ['store-location', id, 'delivery'] });
      queryClient.invalidateQueries({ queryKey: ['store-location', id, 'branch-config'] });

      if (sectionErrors.length) {
        toast.error(t('UPDATE_ERROR', { msg: sectionErrors.join('; ') }));
      } else {
        toast.success(isEdit ? t('UPDATE_SUCCESS') : t('CREATE_SUCCESS'));
        onOpenChange(false);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'error';
      toast.error(t(isEdit ? 'UPDATE_ERROR' : 'CREATE_ERROR', { msg }));
    } finally {
      setSaving(false);
    }
  };

  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.id === activeTab));

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      {withTrigger && (
        <FocusModal.Trigger asChild>
          <Button variant="secondary" size="small">
            {t('CREATE_BUTTON')}
          </Button>
        </FocusModal.Trigger>
      )}
      <FocusModal.Content>
        <ProgressTabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex h-full flex-col overflow-hidden"
        >
          <FocusModal.Header className="flex items-center gap-4">
            <FocusModal.Title asChild>
              <span className="sr-only">{isEdit ? t('EDIT_TITLE') : t('CREATE_TITLE')}</span>
            </FocusModal.Title>
            <div className="-my-2 w-full border-l">
              <ProgressTabs.List>
                {TABS.map((tab, index) => (
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
            <form id="store-location-form" onSubmit={handleSubmit} className="flex w-full">
              <div className="flex-1 overflow-y-auto px-8 py-10">
                <div className="mx-auto flex w-full max-w-[640px] flex-col">
                  {/* General */}
                  <ProgressTabs.Content value="general" className="flex flex-col gap-4">
                    <Heading>{t('TAB_GENERAL')}</Heading>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-name">{t('FIELD_NAME_LABEL')}</Label>
                      <Input
                        id="sl-name"
                        placeholder={t('FIELD_NAME_PLACEHOLDER')}
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-type">{t('FIELD_TYPE_LABEL')}</Label>
                      <Select
                        value={form.store_type}
                        onValueChange={(v) => set('store_type', v as StoreLocationType)}
                      >
                        <Select.Trigger id="sl-type">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          {STORE_TYPES.map((type) => (
                            <Select.Item key={type} value={type}>
                              {t(STORE_TYPE_LABEL_KEY[type])}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-code">{t('FIELD_CODE_LABEL')}</Label>
                      <Input
                        id="sl-code"
                        placeholder={t('FIELD_CODE_PLACEHOLDER')}
                        value={form.code}
                        onChange={(e) => set('code', e.target.value)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="sl-visible">{t('FIELD_VISIBLE_LABEL')}</Label>
                        <Text size="small" className="text-ui-fg-subtle">
                          {t('FIELD_VISIBLE_HELP')}
                        </Text>
                      </div>
                      <Switch
                        id="sl-visible"
                        checked={form.is_visible}
                        onCheckedChange={(v) => set('is_visible', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="sl-active">{t('BRANCH_ACTIVE_LABEL')}</Label>
                        <Text size="small" className="text-ui-fg-subtle">
                          {t('BRANCH_ACTIVE_HELP')}
                        </Text>
                      </div>
                      <Switch
                        id="sl-active"
                        checked={form.active}
                        onCheckedChange={(v) => set('active', v)}
                      />
                    </div>
                    {/*
                      Storefront visibility scope — sibling of `is_visible`, and
                      deliberately NOT in the Commercial tab: that one wires the
                      operational channel→branch ownership (other endpoint,
                      other cardinality) and two channel pickers side by side
                      would read as the same thing.
                    */}
                    <div className="border-t pt-4">
                      <SalesChannelMultiSelect
                        value={form.sales_channel_ids}
                        onChange={(ids) => set('sales_channel_ids', ids)}
                        label={t('FIELD_CHANNELS_LABEL')}
                        help={t('FIELD_CHANNELS_HELP')}
                      />
                    </div>
                  </ProgressTabs.Content>

                  {/* Ubicación */}
                  <ProgressTabs.Content value="location" className="flex flex-col gap-4">
                    <Heading>{t('TAB_LOCATION')}</Heading>
                    <LocationPicker
                      lat={form.lat}
                      lng={form.lng}
                      onPick={(picked: Partial<PickedAddress>) =>
                        setForm((prev) => ({ ...prev, ...picked }))
                      }
                    />
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-province">{t('FIELD_PROVINCE_LABEL')}</Label>
                      <Input
                        id="sl-province"
                        placeholder={t('FIELD_PROVINCE_PLACEHOLDER')}
                        value={form.province}
                        onChange={(e) => set('province', e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-city">{t('FIELD_CITY_LABEL')}</Label>
                      <Input
                        id="sl-city"
                        placeholder={t('FIELD_CITY_PLACEHOLDER')}
                        value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-street">{t('FIELD_STREET_LABEL')}</Label>
                      <Input
                        id="sl-street"
                        placeholder={t('FIELD_STREET_PLACEHOLDER')}
                        value={form.street}
                        onChange={(e) => set('street', e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sl-lat">{t('FIELD_LAT_LABEL')}</Label>
                        <Input
                          id="sl-lat"
                          placeholder={t('FIELD_LAT_PLACEHOLDER')}
                          value={form.lat}
                          onChange={(e) => set('lat', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="sl-lng">{t('FIELD_LNG_LABEL')}</Label>
                        <Input
                          id="sl-lng"
                          placeholder={t('FIELD_LNG_PLACEHOLDER')}
                          value={form.lng}
                          onChange={(e) => set('lng', e.target.value)}
                        />
                      </div>
                    </div>
                  </ProgressTabs.Content>

                  {/* Horarios */}
                  <ProgressTabs.Content value="hours" className="flex flex-col gap-4">
                    <Heading>{t('SECTION_HOURS')}</Heading>
                    <BusinessHoursEditor
                      value={form.business_hours}
                      onChange={(value) => set('business_hours', value)}
                    />
                  </ProgressTabs.Content>

                  {/* Contacto + Redes */}
                  <ProgressTabs.Content value="contact" className="flex flex-col gap-4">
                    <Heading>{t('TAB_CONTACT')}</Heading>
                    {(
                      [
                        ['phone', 'FIELD_PHONE_LABEL', 'FIELD_PHONE_PLACEHOLDER'],
                        ['whatsapp', 'FIELD_WHATSAPP_LABEL', 'FIELD_WHATSAPP_PLACEHOLDER'],
                        ['email', 'FIELD_EMAIL_LABEL', 'FIELD_EMAIL_PLACEHOLDER'],
                        ['website', 'FIELD_WEBSITE_LABEL', 'FIELD_WEBSITE_PLACEHOLDER'],
                        ['instagram', 'FIELD_INSTAGRAM_LABEL', 'FIELD_INSTAGRAM_PLACEHOLDER'],
                        ['facebook', 'FIELD_FACEBOOK_LABEL', 'FIELD_FACEBOOK_PLACEHOLDER'],
                        ['tiktok', 'FIELD_TIKTOK_LABEL', 'FIELD_TIKTOK_PLACEHOLDER'],
                        ['linkedin', 'FIELD_LINKEDIN_LABEL', 'FIELD_LINKEDIN_PLACEHOLDER'],
                      ] as const
                    ).map(([field, labelKey, placeholderKey]) => (
                      <div key={field} className="flex flex-col gap-2">
                        <Label htmlFor={`sl-${field}`}>{t(labelKey)}</Label>
                        <Input
                          id={`sl-${field}`}
                          type={field === 'email' ? 'email' : 'text'}
                          placeholder={t(placeholderKey)}
                          value={form[field]}
                          onChange={(e) => set(field, e.target.value)}
                        />
                      </div>
                    ))}
                  </ProgressTabs.Content>

                  {/* Imágenes + Opciones */}
                  <ProgressTabs.Content value="media" className="flex flex-col gap-4">
                    <Heading>{t('TAB_MEDIA')}</Heading>
                    <Text size="small" className="text-ui-fg-subtle">
                      {t('FIELD_IMAGES_HELP')}
                    </Text>
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex flex-col gap-2">
                        <Label>{t('FIELD_IMAGE_LABEL', { n: index + 1 })}</Label>
                        <ImageUploader
                          value={form.images[index]}
                          onChange={(url) => setImage(index, url)}
                        />
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="sl-delivers-kits">{t('FIELD_DELIVERS_KITS_LABEL')}</Label>
                        <Text size="small" className="text-ui-fg-subtle">
                          {t('FIELD_DELIVERS_KITS_HELP')}
                        </Text>
                      </div>
                      <Switch
                        id="sl-delivers-kits"
                        checked={form.delivers_kits}
                        onCheckedChange={(v) => set('delivers_kits', v)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="sl-delivery-pin">{t('FIELD_DELIVERY_PIN_LABEL')}</Label>
                      <div className="flex gap-2">
                        <Input
                          id="sl-delivery-pin"
                          placeholder={t('FIELD_DELIVERY_PIN_PLACEHOLDER')}
                          value={form.delivery_pin}
                          onChange={(e) => set('delivery_pin', e.target.value.replace(/\D/g, ''))}
                          maxLength={6}
                        />
                        <Button type="button" variant="secondary" onClick={generatePin}>
                          {t('FIELD_DELIVERY_PIN_GENERATE')}
                        </Button>
                      </div>
                    </div>
                  </ProgressTabs.Content>

                  {/* Comercial */}
                  <ProgressTabs.Content value="commercial">
                    <BranchConfigSection value={branchCfg} onChange={setBranchCfg} />
                  </ProgressTabs.Content>

                  {/* Cobertura */}
                  <ProgressTabs.Content value="coverage">
                    {/* `storeLocationId` habilita la importación en lote contra
                        la API (con progreso y reporte). Vacío en alta: ahí las
                        zonas importadas quedan como borradores. */}
                    <CoverageSection
                      value={coverages}
                      onChange={setCoverages}
                      center={center}
                      storeLocationId={isEdit ? locationId : null}
                    />
                  </ProgressTabs.Content>

                  {/* Entrega */}
                  <ProgressTabs.Content value="delivery">
                    <DeliverySection value={delivery} onChange={setDelivery} />
                  </ProgressTabs.Content>
                </div>
              </div>
            </form>
          </FocusModal.Body>

          <FocusModal.Footer>
            <div className="flex items-center justify-end gap-x-2">
              <Button
                variant="secondary"
                size="small"
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                {t('CANCEL')}
              </Button>
              <Button type="submit" size="small" form="store-location-form" isLoading={saving}>
                {isEdit ? t('EDIT_SUBMIT') : t('CREATE_SUBMIT')}
              </Button>
            </div>
          </FocusModal.Footer>
        </ProgressTabs>
      </FocusModal.Content>
    </FocusModal>
  );
};
