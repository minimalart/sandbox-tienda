import {
  Button,
  DatePicker,
  FocusModal,
  IconButton,
  Input,
  Label,
  ProgressTabs,
  Select,
  Switch,
  Text,
  toast,
} from '@medusajs/ui';
import { Trash } from '@medusajs/icons';
import { dateToLocalInput, localInputToDate } from '../../../lib/date';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { sdk } from '../../../lib/client';
import {
  type CheckoutLink,
  useCreateCheckoutLink,
  useUpdateCheckoutLink,
} from '../../../hooks/api/checkout-links';
import { useCustomers } from '../../../hooks/api/customers';

type LineItem = { variant_id: string; quantity: number };

type CountryOption = {
  iso_2: string;
  label: string;
  region_id: string;
};

type SalesChannelOption = { id: string; name: string };

type CustomerMode = 'existing' | 'new' | 'none';

type CustomerAddress = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  company?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
  is_default_shipping?: boolean;
};

type CustomerResult = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  addresses?: CustomerAddress[];
};

const STORED_ADDRESS_ID = '__stored__';

/** Maps a Medusa customer address to the checkout-link address payload. */
function mapAddress(addr: CustomerAddress) {
  return {
    first_name: addr.first_name ?? '',
    last_name: addr.last_name ?? '',
    address_1: addr.address_1 ?? '',
    address_2: addr.address_2 ?? '',
    company: addr.company ?? '',
    city: addr.city ?? '',
    province: addr.province ?? '',
    postal_code: addr.postal_code ?? '',
    phone: addr.phone ?? '',
  };
}

function addressLabel(addr: CustomerAddress): string {
  return (
    [addr.address_1, addr.city, addr.province, addr.postal_code]
      .filter(Boolean)
      .join(', ') || 'Dirección sin detalle'
  );
}

function customerLabel(c: CustomerResult): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name ? `${name} · ${c.email}` : c.email;
}

const emptyAddress = {
  first_name: '',
  last_name: '',
  address_1: '',
  city: '',
  province: '',
  postal_code: '',
  phone: '',
};

/** ISO string → value for <input type="datetime-local"> (local time, no seconds). */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'items', label: 'Productos' },
  { id: 'customer', label: 'Cliente' },
  { id: 'options', label: 'Opciones' },
] as const;

export function CheckoutLinkFormModal({
  open,
  onOpenChange,
  checkoutLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkoutLink?: CheckoutLink | null;
}) {
  const isEdit = !!checkoutLink;
  const create = useCreateCheckoutLink();
  const update = useUpdateCheckoutLink(checkoutLink?.id ?? '');

  const [activeTab, setActiveTab] = useState<string>('general');
  const [internalName, setInternalName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [regionId, setRegionId] = useState('');
  const [salesChannelId, setSalesChannelId] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [variantLabels, setVariantLabels] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  // Manual ("new" customer) fields
  const [email, setEmail] = useState('');
  const [includeAddress, setIncludeAddress] = useState(false);
  const [address, setAddress] = useState({ ...emptyAddress });
  // Existing customer selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerResult | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [singleUse, setSingleUse] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [prefilledForId, setPrefilledForId] = useState<string | null>(null);

  // ── Reference data ─────────────────────────────────────────────────────────
  const { data: regionsData } = useQuery({
    queryKey: ['admin-regions-for-checkout-links'],
    queryFn: () => sdk.admin.region.list({ fields: 'id,name,*countries' }),
    enabled: open,
  });

  const countryOptions = useMemo<CountryOption[]>(() => {
    const regions = (regionsData as any)?.regions ?? [];
    const opts: CountryOption[] = [];
    for (const region of regions) {
      for (const c of region.countries ?? []) {
        if (!c?.iso_2) continue;
        opts.push({
          iso_2: c.iso_2,
          label: `${c.display_name || c.name || c.iso_2} (${region.name})`,
          region_id: region.id,
        });
      }
    }
    return opts;
  }, [regionsData]);

  const { data: salesChannelsData } = useQuery({
    queryKey: ['admin-b2c-sales-channels'],
    queryFn: () =>
      sdk.client.fetch<{ sales_channels: SalesChannelOption[] }>(
        '/admin/sales-channels-b2c',
      ),
    enabled: open,
  });
  const salesChannels = salesChannelsData?.sales_channels ?? [];

  // Product search
  const { data: productsData, isFetching: searching } = useQuery({
    queryKey: ['admin-products-search-checkout-links', search],
    queryFn: () =>
      sdk.admin.product.list({
        q: search,
        limit: 10,
        fields: 'id,title,thumbnail,*variants',
      }),
    enabled: open && search.trim().length > 1,
  });
  const products = (productsData as any)?.products ?? [];

  // Resolve labels for items loaded in edit mode (variant titles).
  const missingLabelIds = items
    .map((i) => i.variant_id)
    .filter((id) => !variantLabels[id]);
  useQuery({
    queryKey: ['admin-variant-labels', missingLabelIds.sort().join(',')],
    queryFn: async () => {
      const { variants } = (await sdk.admin.productVariant.list({
        id: missingLabelIds,
        fields: 'id,title,product.title',
        limit: missingLabelIds.length,
      })) as any;
      setVariantLabels((prev) => {
        const next = { ...prev };
        for (const v of variants ?? []) {
          next[v.id] = `${v.product?.title ?? ''}${v.title ? ` — ${v.title}` : ''}`.trim();
        }
        return next;
      });
      return variants;
    },
    enabled: open && missingLabelIds.length > 0,
  });

  // Customer search (existing-customer mode)
  const { customers, isFetching: customersLoading } = useCustomers(
    {
      q: customerSearch,
      limit: 8,
      fields: 'id,email,first_name,last_name,phone,*addresses',
    },
    {
      enabled:
        open &&
        customerMode === 'existing' &&
        customerSearch.trim().length > 1 &&
        !selectedCustomer,
    },
  ) as { customers?: CustomerResult[]; isFetching: boolean };

  // ── Prefill on open ──────────────────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: prefill only on open/record change
  useEffect(() => {
    if (!open) {
      setPrefilledForId(null);
      return;
    }
    const key = checkoutLink?.id ?? '__new__';
    if (prefilledForId === key) return;
    setPrefilledForId(key);
    setActiveTab('general');

    if (checkoutLink) {
      setInternalName(checkoutLink.internal_name ?? '');
      setCountryCode(checkoutLink.country_code ?? '');
      setRegionId(checkoutLink.region_id ?? '');
      setSalesChannelId(checkoutLink.sales_channel_id ?? '');
      setItems(
        (checkoutLink.items ?? []).map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
        })),
      );
      setPromoInput((checkoutLink.promo_codes ?? []).join(', '));
      setSingleUse(!!checkoutLink.single_use);
      setExpiresAt(toLocalInput(checkoutLink.expires_at));
      const storedAddr = checkoutLink.shipping_address;
      if (checkoutLink.customer_id) {
        setCustomerMode('existing');
        // selectedCustomer is loaded by the retrieve query below.
      } else if (checkoutLink.email || storedAddr) {
        setCustomerMode('new');
        setEmail(checkoutLink.email ?? '');
        setIncludeAddress(!!storedAddr);
        setAddress({ ...emptyAddress, ...(storedAddr as any) });
      } else {
        setCustomerMode('none');
      }
    } else {
      // Create: clean slate
      setInternalName('');
      setCountryCode('');
      setRegionId('');
      setSalesChannelId('');
      setItems([]);
      setPromoInput('');
      setSingleUse(false);
      setExpiresAt('');
      setCustomerMode('existing');
      setEmail('');
      setIncludeAddress(false);
      setAddress({ ...emptyAddress });
      setSelectedCustomer(null);
      setSelectedAddressId('');
      setCreatedUrl(null);
    }
    setSearch('');
    setCustomerSearch('');
  }, [open, checkoutLink, prefilledForId]);

  // Load the linked customer when editing an existing-customer link.
  useEffect(() => {
    if (!open || !isEdit || !checkoutLink?.customer_id || selectedCustomer) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { customer } = (await sdk.admin.customer.retrieve(
          checkoutLink.customer_id as string,
          { fields: 'id,email,first_name,last_name,phone,*addresses' },
        )) as { customer: CustomerResult };
        if (cancelled) return;
        const stored = checkoutLink.shipping_address;
        const addresses: CustomerAddress[] = [
          ...(stored
            ? [{ id: STORED_ADDRESS_ID, ...(stored as any) } as CustomerAddress]
            : []),
          ...(customer.addresses ?? []),
        ];
        setSelectedCustomer({ ...customer, addresses });
        setSelectedAddressId(stored ? STORED_ADDRESS_ID : '');
      } catch {
        // ignore — operator can re-pick the customer
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, checkoutLink, selectedCustomer]);

  // Preselect when there is a single option (país / sales channel).
  useEffect(() => {
    const only = countryOptions[0];
    if (only && !countryCode && countryOptions.length === 1) {
      setCountryCode(only.iso_2);
      setRegionId(only.region_id);
    }
  }, [countryOptions, countryCode]);

  useEffect(() => {
    const only = salesChannels[0];
    if (only && !salesChannelId && salesChannels.length === 1) {
      setSalesChannelId(only.id);
    }
  }, [salesChannels, salesChannelId]);

  // ── Item helpers ───────────────────────────────────────────────────────────
  function addVariant(productTitle: string, variant: any) {
    setVariantLabels((prev) => ({
      ...prev,
      [variant.id]: `${productTitle}${variant.title ? ` — ${variant.title}` : ''}`,
    }));
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variant_id === variant.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { variant_id: variant.id, quantity: 1 }];
    });
  }

  function setQty(variantId: string, qty: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.variant_id === variantId ? { ...i, quantity: Math.max(1, qty) } : i,
      ),
    );
  }

  function removeItem(variantId: string) {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  }

  function selectCustomer(customer: CustomerResult) {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    const def = customer.addresses?.find((a) => a.is_default_shipping);
    setSelectedAddressId(def?.id ?? '');
  }

  function clearCustomer() {
    setSelectedCustomer(null);
    setSelectedAddressId('');
  }

  function handleClose(next: boolean) {
    onOpenChange(next);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!countryCode) {
      toast.error('Elegí un país');
      setActiveTab('general');
      return;
    }
    if (items.length === 0) {
      toast.error('Agregá al menos un producto');
      setActiveTab('items');
      return;
    }

    const promoCodes = promoInput
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    let resolvedEmail: string | undefined;
    let resolvedAddress: Record<string, unknown> | undefined;
    let resolvedCustomerId: string | undefined;

    if (customerMode === 'existing') {
      if (!selectedCustomer) {
        toast.error('Elegí un cliente o cambiá de modo');
        setActiveTab('customer');
        return;
      }
      resolvedEmail = selectedCustomer.email;
      resolvedCustomerId = selectedCustomer.id;
      const addr = selectedCustomer.addresses?.find(
        (a) => a.id === selectedAddressId,
      );
      if (addr) {
        resolvedAddress = { ...mapAddress(addr), country_code: countryCode };
      }
    } else if (customerMode === 'new') {
      resolvedEmail = email || undefined;
      resolvedAddress =
        includeAddress &&
        (address.address_1 || address.city || address.postal_code)
          ? { ...address, country_code: countryCode }
          : undefined;
    }
    // 'none' → everything undefined.

    const basePayload = {
      internal_name: internalName || undefined,
      items,
      country_code: countryCode,
      region_id: regionId || undefined,
      sales_channel_id: salesChannelId || undefined,
      promo_codes: promoCodes,
      single_use: singleUse,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (isEdit) {
      // On update, send null to actively clear customer fields when omitted.
      update.mutate(
        {
          ...basePayload,
          email: (resolvedEmail ?? null) as any,
          customer_id: (resolvedCustomerId ?? null) as any,
          shipping_address: (resolvedAddress ?? null) as any,
        },
        {
          onSuccess: () => {
            toast.success('Link actualizado');
            handleClose(false);
          },
          onError: (e: any) =>
            toast.error(e.message || 'Error al actualizar el link'),
        },
      );
      return;
    }

    create.mutate(
      {
        ...basePayload,
        email: resolvedEmail,
        customer_id: resolvedCustomerId,
        shipping_address: resolvedAddress as any,
        promo_codes: promoCodes.length ? promoCodes : undefined,
      },
      {
        onSuccess: (link: CheckoutLink) => {
          toast.success('Link creado');
          setCreatedUrl(
            link.public_url || `/${link.country_code}/c/${link.token}`,
          );
        },
        onError: (e: any) => toast.error(e.message || 'Error al crear el link'),
      },
    );
  }

  const activeIndex = TABS.findIndex((t) => t.id === activeTab);
  const isLastTab = activeIndex === TABS.length - 1;
  const isPending = create.isPending || update.isPending;
  const publicUrl =
    checkoutLink?.public_url ||
    (checkoutLink ? `/${checkoutLink.country_code}/c/${checkoutLink.token}` : '');

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('URL copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar la URL');
    }
  }

  return (
    <FocusModal open={open} onOpenChange={handleClose}>
      <FocusModal.Content>
        {createdUrl ? (
          <>
            <FocusModal.Header>
              <div className="flex items-center justify-end gap-x-2">
                <Button size="small" variant="secondary" onClick={() => handleClose(false)}>
                  Cerrar
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="flex flex-col items-center overflow-y-auto py-12">
              <div className="flex w-full max-w-xl flex-col gap-y-4">
                <Text size="large" weight="plus">
                  ¡Link de venta creado!
                </Text>
                <Label>URL pública</Label>
                <div className="flex items-center gap-x-2">
                  <Input value={createdUrl} readOnly />
                  <Button variant="primary" onClick={() => copyUrl(createdUrl)}>
                    Copiar
                  </Button>
                </div>
                <Text size="small" className="text-ui-fg-subtle">
                  Compartí este enlace: el cliente abrirá un carrito ya armado y
                  avanzará directo hacia el pago.
                </Text>
              </div>
            </FocusModal.Body>
          </>
        ) : (
          <ProgressTabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full flex-col overflow-hidden"
          >
            <FocusModal.Header className="flex items-center gap-4">
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
                      {tab.label}
                    </ProgressTabs.Trigger>
                  ))}
                </ProgressTabs.List>
              </div>
            </FocusModal.Header>

            <FocusModal.Body className="flex flex-1 justify-center overflow-y-auto">
              <div className="w-full max-w-2xl px-6 py-10">
                {/* ── General ── */}
                <ProgressTabs.Content value="general" className="flex flex-col gap-y-6">
                  <div>
                    <Text size="large" weight="plus">
                      {isEdit ? 'Editar link de venta' : 'Nuevo link de venta'}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      Generá una URL pública con un carrito precargado.
                    </Text>
                  </div>

                  {isEdit && publicUrl && (
                    <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3">
                      <Label>URL pública</Label>
                      <div className="flex items-center gap-x-2">
                        <Input value={publicUrl} readOnly />
                        <Button variant="secondary" onClick={() => copyUrl(publicUrl)}>
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-y-2">
                    <Label>Nombre interno (opcional)</Label>
                    <Input
                      placeholder="Ej. Pedido WhatsApp Juan Pérez"
                      value={internalName}
                      onChange={(e) => setInternalName(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label>País / región</Label>
                    <Select
                      value={countryCode}
                      onValueChange={(v) => {
                        setCountryCode(v);
                        const opt = countryOptions.find((o) => o.iso_2 === v);
                        setRegionId(opt?.region_id ?? '');
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value placeholder="Elegí un país" />
                      </Select.Trigger>
                      <Select.Content>
                        {countryOptions.map((o) => (
                          <Select.Item key={o.iso_2} value={o.iso_2}>
                            {o.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>

                  {salesChannels.length > 0 && (
                    <div className="flex flex-col gap-y-2">
                      <Label>Canal de venta (B2C)</Label>
                      <Select value={salesChannelId} onValueChange={setSalesChannelId}>
                        <Select.Trigger>
                          <Select.Value placeholder="Elegí un canal" />
                        </Select.Trigger>
                        <Select.Content>
                          {salesChannels.map((sc) => (
                            <Select.Item key={sc.id} value={sc.id}>
                              {sc.name}
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                  )}
                </ProgressTabs.Content>

                {/* ── Productos ── */}
                <ProgressTabs.Content value="items" className="flex flex-col gap-y-4">
                  <Label>Productos</Label>
                  <Input
                    placeholder="Buscar producto por nombre…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search.trim().length > 1 && (
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-ui-border-base">
                      {searching ? (
                        <Text size="small" className="p-3 text-ui-fg-subtle">
                          Buscando…
                        </Text>
                      ) : products.length === 0 ? (
                        <Text size="small" className="p-3 text-ui-fg-subtle">
                          Sin resultados
                        </Text>
                      ) : (
                        products.map((p: any) => (
                          <div
                            key={p.id}
                            className="border-ui-border-base border-b p-2 last:border-b-0"
                          >
                            <Text size="small" weight="plus">
                              {p.title}
                            </Text>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {(p.variants ?? []).map((v: any) => (
                                <Button
                                  key={v.id}
                                  size="small"
                                  variant="transparent"
                                  className="border border-ui-border-base"
                                  onClick={() => addVariant(p.title, v)}
                                >
                                  + {v.title || 'Variante'}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {items.length > 0 && (
                    <div className="flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3">
                      {items.map((i) => (
                        <div
                          key={i.variant_id}
                          className="flex items-center justify-between gap-x-2"
                        >
                          <Text size="small" className="flex-1 truncate">
                            {variantLabels[i.variant_id] ||
                              `Variante ${i.variant_id.slice(-6)}`}
                          </Text>
                          <Input
                            type="number"
                            min={1}
                            className="w-20"
                            value={i.quantity}
                            onChange={(e) =>
                              setQty(i.variant_id, Number(e.target.value))
                            }
                          />
                          <IconButton
                            variant="transparent"
                            onClick={() => removeItem(i.variant_id)}
                          >
                            <Trash />
                          </IconButton>
                        </div>
                      ))}
                    </div>
                  )}
                </ProgressTabs.Content>

                {/* ── Cliente ── */}
                <ProgressTabs.Content value="customer" className="flex flex-col gap-y-3">
                  <Label>Cliente</Label>
                  <div className="flex gap-2">
                    {(
                      [
                        ['existing', 'Cliente existente'],
                        ['new', 'Cliente nuevo'],
                        ['none', 'Sin cliente'],
                      ] as [CustomerMode, string][]
                    ).map(([mode, label]) => (
                      <Button
                        key={mode}
                        size="small"
                        type="button"
                        variant={customerMode === mode ? 'primary' : 'secondary'}
                        onClick={() => setCustomerMode(mode)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  {customerMode === 'existing' &&
                    (selectedCustomer ? (
                      <div className="flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3">
                        <div className="flex items-center justify-between gap-x-2">
                          <Text size="small" weight="plus">
                            {customerLabel(selectedCustomer)}
                          </Text>
                          <Button size="small" variant="transparent" onClick={clearCustomer}>
                            Cambiar
                          </Button>
                        </div>
                        {(selectedCustomer.addresses?.length ?? 0) > 0 ? (
                          <div className="flex flex-col gap-y-1">
                            <Text size="xsmall" className="text-ui-fg-subtle">
                              Dirección a precargar
                            </Text>
                            <button
                              type="button"
                              onClick={() => setSelectedAddressId('')}
                              className={`rounded-lg border p-2 text-left text-sm ${selectedAddressId === '' ? 'border-ui-fg-base bg-ui-bg-subtle' : 'border-ui-border-base'}`}
                            >
                              No precargar dirección
                            </button>
                            {selectedCustomer.addresses?.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => setSelectedAddressId(a.id)}
                                className={`rounded-lg border p-2 text-left text-sm ${selectedAddressId === a.id ? 'border-ui-fg-base bg-ui-bg-subtle' : 'border-ui-border-base'}`}
                              >
                                {a.id === STORED_ADDRESS_ID
                                  ? `${addressLabel(a)} · (actual del link)`
                                  : `${addressLabel(a)}${a.is_default_shipping ? ' · (default)' : ''}`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Text size="small" className="text-ui-fg-subtle">
                            Este cliente no tiene direcciones guardadas.
                          </Text>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-y-2">
                        <Input
                          placeholder="Buscar cliente por nombre o email…"
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                        />
                        {customerSearch.trim().length > 1 && (
                          <div className="max-h-56 overflow-y-auto rounded-lg border border-ui-border-base">
                            {customersLoading ? (
                              <Text size="small" className="p-3 text-ui-fg-subtle">
                                Buscando…
                              </Text>
                            ) : (customers?.length ?? 0) === 0 ? (
                              <Text size="small" className="p-3 text-ui-fg-subtle">
                                Sin resultados
                              </Text>
                            ) : (
                              customers?.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => selectCustomer(c)}
                                  className="block w-full border-ui-border-base border-b p-2 text-left last:border-b-0 hover:bg-ui-bg-subtle"
                                >
                                  <Text size="small" weight="plus">
                                    {customerLabel(c)}
                                  </Text>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                  {customerMode === 'new' && (
                    <>
                      <Input
                        type="email"
                        placeholder="Email del cliente (opcional)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <div className="flex items-center justify-between">
                        <Text size="small">Precargar dirección de envío</Text>
                        <Switch checked={includeAddress} onCheckedChange={setIncludeAddress} />
                      </div>
                      {includeAddress && (
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-ui-border-base p-3">
                          <Input
                            placeholder="Nombre"
                            value={address.first_name}
                            onChange={(e) => setAddress({ ...address, first_name: e.target.value })}
                          />
                          <Input
                            placeholder="Apellido"
                            value={address.last_name}
                            onChange={(e) => setAddress({ ...address, last_name: e.target.value })}
                          />
                          <Input
                            className="col-span-2"
                            placeholder="Dirección"
                            value={address.address_1}
                            onChange={(e) => setAddress({ ...address, address_1: e.target.value })}
                          />
                          <Input
                            placeholder="Ciudad"
                            value={address.city}
                            onChange={(e) => setAddress({ ...address, city: e.target.value })}
                          />
                          <Input
                            placeholder="Provincia"
                            value={address.province}
                            onChange={(e) => setAddress({ ...address, province: e.target.value })}
                          />
                          <Input
                            placeholder="Código postal"
                            value={address.postal_code}
                            onChange={(e) => setAddress({ ...address, postal_code: e.target.value })}
                          />
                          <Input
                            placeholder="Teléfono"
                            value={address.phone}
                            onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {customerMode === 'none' && (
                    <Text size="small" className="text-ui-fg-subtle">
                      El cliente cargará sus datos en el checkout.
                    </Text>
                  )}
                </ProgressTabs.Content>

                {/* ── Opciones ── */}
                <ProgressTabs.Content value="options" className="flex flex-col gap-y-6">
                  <div className="flex flex-col gap-y-2">
                    <Label>Códigos de promoción (opcional)</Label>
                    <Input
                      placeholder="Separá varios con comas"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-y-2">
                      <Label>Vence el (opcional)</Label>
                      <DatePicker
                        granularity="minute"
                        value={localInputToDate(expiresAt)}
                        onChange={(d) => setExpiresAt(dateToLocalInput(d))}
                      />
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label>Un solo uso</Label>
                      <div className="flex h-10 items-center">
                        <Switch checked={singleUse} onCheckedChange={setSingleUse} />
                      </div>
                    </div>
                  </div>
                </ProgressTabs.Content>
              </div>
            </FocusModal.Body>

            <FocusModal.Footer>
              <div className="flex items-center justify-end gap-x-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handleClose(false)}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
                {activeIndex > 0 && (
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={() => {
                      const prev = TABS[activeIndex - 1];
                      if (prev) setActiveTab(prev.id);
                    }}
                  >
                    Atrás
                  </Button>
                )}
                {isLastTab || isEdit ? (
                  <Button size="small" onClick={handleSubmit} isLoading={isPending}>
                    {isEdit ? 'Guardar' : 'Generar link'}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    type="button"
                    onClick={() => {
                      const next = TABS[activeIndex + 1];
                      if (next) setActiveTab(next.id);
                    }}
                  >
                    Continuar
                  </Button>
                )}
              </div>
            </FocusModal.Footer>
          </ProgressTabs>
        )}
      </FocusModal.Content>
    </FocusModal>
  );
}
