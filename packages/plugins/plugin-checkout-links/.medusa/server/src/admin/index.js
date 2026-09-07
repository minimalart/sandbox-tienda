"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const ui = require("@medusajs/ui");
const react = require("react");
const reactQuery = require("@tanstack/react-query");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
const Medusa = require("@medusajs/js-sdk");
require("@medusajs/admin-shared");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Medusa__default = /* @__PURE__ */ _interopDefault(Medusa);
const BASE_URL = "/admin/checkout-links";
const CHECKOUT_LINKS_QUERY_KEY = ["checkout-links"];
const checkoutLinkQueryKey = (id) => ["checkout-links", id];
async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init == null ? void 0 : init.headers) ?? {} }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useCheckoutLinks(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;
  return reactQuery.useQuery({
    queryKey: [...CHECKOUT_LINKS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useCreateCheckoutLink() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => fetchJson(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.checkout_link),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHECKOUT_LINKS_QUERY_KEY })
  });
}
function useUpdateCheckoutLink(id) {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => fetchJson(`${BASE_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.checkout_link),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHECKOUT_LINKS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: checkoutLinkQueryKey(id) });
    }
  });
}
function useDeleteCheckoutLink() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CHECKOUT_LINKS_QUERY_KEY })
  });
}
function CheckoutLinkActionsMenu({ link, onEdit }) {
  const prompt = ui.usePrompt();
  const update = useUpdateCheckoutLink(link.id);
  const remove = useDeleteCheckoutLink();
  const isDisabled = link.status === "disabled";
  const publicUrl = link.public_url || `/${link.country_code}/c/${link.token}`;
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      ui.toast.success("URL copiada al portapapeles");
    } catch {
      ui.toast.error("No se pudo copiar la URL");
    }
  }
  function toggleDisabled() {
    update.mutate(
      { status: isDisabled ? "active" : "disabled" },
      {
        onSuccess: () => ui.toast.success(isDisabled ? "Link reactivado" : "Link deshabilitado"),
        onError: (e) => ui.toast.error(e.message)
      }
    );
  }
  async function handleDelete() {
    const confirmed = await prompt({
      title: "Eliminar link de venta",
      description: `¿Seguro que querés eliminar "${link.internal_name || link.token}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar"
    });
    if (!confirmed) return;
    remove.mutate(link.id, {
      onSuccess: () => ui.toast.success("Link eliminado"),
      onError: (e) => ui.toast.error(e.message)
    });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: onEdit, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
        "Ver / Editar"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: copyUrl, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.SquareTwoStack, { className: "text-ui-fg-subtle" }),
        "Copiar URL"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: toggleDisabled, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
        isDisabled ? "Reactivar" : "Deshabilitar"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
      /* @__PURE__ */ jsxRuntime.jsxs(
        ui.DropdownMenu.Item,
        {
          className: "gap-x-2 text-ui-fg-error",
          onClick: handleDelete,
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-error" }),
            "Eliminar"
          ]
        }
      )
    ] })
  ] });
}
const pad = (n) => String(n).padStart(2, "0");
function localInputToDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateToLocalInput(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const sdk = new Medusa__default.default({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const CUSTOMER_QUERY_KEY = "plugin-checkout-links-customer";
const useCustomers = (query, options) => {
  const { data, ...rest } = reactQuery.useQuery({
    queryFn: () => sdk.admin.customer.list(query),
    queryKey: [CUSTOMER_QUERY_KEY, "list", { query }],
    ...options
  });
  return { ...data, ...rest };
};
const STORED_ADDRESS_ID = "__stored__";
function mapAddress(addr) {
  return {
    first_name: addr.first_name ?? "",
    last_name: addr.last_name ?? "",
    address_1: addr.address_1 ?? "",
    address_2: addr.address_2 ?? "",
    company: addr.company ?? "",
    city: addr.city ?? "",
    province: addr.province ?? "",
    postal_code: addr.postal_code ?? "",
    phone: addr.phone ?? ""
  };
}
function addressLabel(addr) {
  return [addr.address_1, addr.city, addr.province, addr.postal_code].filter(Boolean).join(", ") || "Dirección sin detalle";
}
function customerLabel(c) {
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name ? `${name} · ${c.email}` : c.email;
}
const emptyAddress = {
  first_name: "",
  last_name: "",
  address_1: "",
  city: "",
  province: "",
  postal_code: "",
  phone: ""
};
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const TABS = [
  { id: "general", label: "General" },
  { id: "items", label: "Productos" },
  { id: "customer", label: "Cliente" },
  { id: "options", label: "Opciones" }
];
function CheckoutLinkFormModal({
  open,
  onOpenChange,
  checkoutLink
}) {
  var _a, _b;
  const isEdit = !!checkoutLink;
  const create = useCreateCheckoutLink();
  const update = useUpdateCheckoutLink((checkoutLink == null ? void 0 : checkoutLink.id) ?? "");
  const [activeTab, setActiveTab] = react.useState("general");
  const [internalName, setInternalName] = react.useState("");
  const [countryCode, setCountryCode] = react.useState("");
  const [regionId, setRegionId] = react.useState("");
  const [salesChannelId, setSalesChannelId] = react.useState("");
  const [items, setItems] = react.useState([]);
  const [variantLabels, setVariantLabels] = react.useState({});
  const [search, setSearch] = react.useState("");
  const [customerMode, setCustomerMode] = react.useState("existing");
  const [email, setEmail] = react.useState("");
  const [includeAddress, setIncludeAddress] = react.useState(false);
  const [address, setAddress] = react.useState({ ...emptyAddress });
  const [customerSearch, setCustomerSearch] = react.useState("");
  const [selectedCustomer, setSelectedCustomer] = react.useState(null);
  const [selectedAddressId, setSelectedAddressId] = react.useState("");
  const [promoInput, setPromoInput] = react.useState("");
  const [singleUse, setSingleUse] = react.useState(false);
  const [expiresAt, setExpiresAt] = react.useState("");
  const [createdUrl, setCreatedUrl] = react.useState(null);
  const [prefilledForId, setPrefilledForId] = react.useState(null);
  const { data: regionsData } = reactQuery.useQuery({
    queryKey: ["admin-regions-for-checkout-links"],
    queryFn: () => sdk.admin.region.list({ fields: "id,name,*countries" }),
    enabled: open
  });
  const countryOptions = react.useMemo(() => {
    const regions = (regionsData == null ? void 0 : regionsData.regions) ?? [];
    const opts = [];
    for (const region of regions) {
      for (const c of region.countries ?? []) {
        if (!(c == null ? void 0 : c.iso_2)) continue;
        opts.push({
          iso_2: c.iso_2,
          label: `${c.display_name || c.name || c.iso_2} (${region.name})`,
          region_id: region.id
        });
      }
    }
    return opts;
  }, [regionsData]);
  const { data: salesChannelsData } = reactQuery.useQuery({
    queryKey: ["admin-b2c-sales-channels"],
    queryFn: () => sdk.client.fetch(
      "/admin/sales-channels-b2c"
    ),
    enabled: open
  });
  const salesChannels = (salesChannelsData == null ? void 0 : salesChannelsData.sales_channels) ?? [];
  const { data: productsData, isFetching: searching } = reactQuery.useQuery({
    queryKey: ["admin-products-search-checkout-links", search],
    queryFn: () => sdk.admin.product.list({
      q: search,
      limit: 10,
      fields: "id,title,thumbnail,*variants"
    }),
    enabled: open && search.trim().length > 1
  });
  const products = (productsData == null ? void 0 : productsData.products) ?? [];
  const missingLabelIds = items.map((i) => i.variant_id).filter((id) => !variantLabels[id]);
  reactQuery.useQuery({
    queryKey: ["admin-variant-labels", missingLabelIds.sort().join(",")],
    queryFn: async () => {
      const { variants } = await sdk.admin.productVariant.list({
        id: missingLabelIds,
        fields: "id,title,product.title",
        limit: missingLabelIds.length
      });
      setVariantLabels((prev) => {
        var _a2;
        const next = { ...prev };
        for (const v of variants ?? []) {
          next[v.id] = `${((_a2 = v.product) == null ? void 0 : _a2.title) ?? ""}${v.title ? ` — ${v.title}` : ""}`.trim();
        }
        return next;
      });
      return variants;
    },
    enabled: open && missingLabelIds.length > 0
  });
  const { customers, isFetching: customersLoading } = useCustomers(
    {
      q: customerSearch,
      limit: 8,
      fields: "id,email,first_name,last_name,phone,*addresses"
    },
    {
      enabled: open && customerMode === "existing" && customerSearch.trim().length > 1 && !selectedCustomer
    }
  );
  react.useEffect(() => {
    if (!open) {
      setPrefilledForId(null);
      return;
    }
    const key = (checkoutLink == null ? void 0 : checkoutLink.id) ?? "__new__";
    if (prefilledForId === key) return;
    setPrefilledForId(key);
    setActiveTab("general");
    if (checkoutLink) {
      setInternalName(checkoutLink.internal_name ?? "");
      setCountryCode(checkoutLink.country_code ?? "");
      setRegionId(checkoutLink.region_id ?? "");
      setSalesChannelId(checkoutLink.sales_channel_id ?? "");
      setItems(
        (checkoutLink.items ?? []).map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity
        }))
      );
      setPromoInput((checkoutLink.promo_codes ?? []).join(", "));
      setSingleUse(!!checkoutLink.single_use);
      setExpiresAt(toLocalInput(checkoutLink.expires_at));
      const storedAddr = checkoutLink.shipping_address;
      if (checkoutLink.customer_id) {
        setCustomerMode("existing");
      } else if (checkoutLink.email || storedAddr) {
        setCustomerMode("new");
        setEmail(checkoutLink.email ?? "");
        setIncludeAddress(!!storedAddr);
        setAddress({ ...emptyAddress, ...storedAddr });
      } else {
        setCustomerMode("none");
      }
    } else {
      setInternalName("");
      setCountryCode("");
      setRegionId("");
      setSalesChannelId("");
      setItems([]);
      setPromoInput("");
      setSingleUse(false);
      setExpiresAt("");
      setCustomerMode("existing");
      setEmail("");
      setIncludeAddress(false);
      setAddress({ ...emptyAddress });
      setSelectedCustomer(null);
      setSelectedAddressId("");
      setCreatedUrl(null);
    }
    setSearch("");
    setCustomerSearch("");
  }, [open, checkoutLink, prefilledForId]);
  react.useEffect(() => {
    if (!open || !isEdit || !(checkoutLink == null ? void 0 : checkoutLink.customer_id) || selectedCustomer) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { customer } = await sdk.admin.customer.retrieve(
          checkoutLink.customer_id,
          { fields: "id,email,first_name,last_name,phone,*addresses" }
        );
        if (cancelled) return;
        const stored = checkoutLink.shipping_address;
        const addresses = [
          ...stored ? [{ id: STORED_ADDRESS_ID, ...stored }] : [],
          ...customer.addresses ?? []
        ];
        setSelectedCustomer({ ...customer, addresses });
        setSelectedAddressId(stored ? STORED_ADDRESS_ID : "");
      } catch {
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isEdit, checkoutLink, selectedCustomer]);
  react.useEffect(() => {
    const only = countryOptions[0];
    if (only && !countryCode && countryOptions.length === 1) {
      setCountryCode(only.iso_2);
      setRegionId(only.region_id);
    }
  }, [countryOptions, countryCode]);
  react.useEffect(() => {
    const only = salesChannels[0];
    if (only && !salesChannelId && salesChannels.length === 1) {
      setSalesChannelId(only.id);
    }
  }, [salesChannels, salesChannelId]);
  function addVariant(productTitle, variant) {
    setVariantLabels((prev) => ({
      ...prev,
      [variant.id]: `${productTitle}${variant.title ? ` — ${variant.title}` : ""}`
    }));
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === variant.id);
      if (existing) {
        return prev.map(
          (i) => i.variant_id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { variant_id: variant.id, quantity: 1 }];
    });
  }
  function setQty(variantId, qty) {
    setItems(
      (prev) => prev.map(
        (i) => i.variant_id === variantId ? { ...i, quantity: Math.max(1, qty) } : i
      )
    );
  }
  function removeItem(variantId) {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  }
  function selectCustomer(customer) {
    var _a2;
    setSelectedCustomer(customer);
    setCustomerSearch("");
    const def = (_a2 = customer.addresses) == null ? void 0 : _a2.find((a) => a.is_default_shipping);
    setSelectedAddressId((def == null ? void 0 : def.id) ?? "");
  }
  function clearCustomer() {
    setSelectedCustomer(null);
    setSelectedAddressId("");
  }
  function handleClose(next) {
    onOpenChange(next);
  }
  function handleSubmit() {
    var _a2;
    if (!countryCode) {
      ui.toast.error("Elegí un país");
      setActiveTab("general");
      return;
    }
    if (items.length === 0) {
      ui.toast.error("Agregá al menos un producto");
      setActiveTab("items");
      return;
    }
    const promoCodes = promoInput.split(",").map((c) => c.trim()).filter(Boolean);
    let resolvedEmail;
    let resolvedAddress;
    let resolvedCustomerId;
    if (customerMode === "existing") {
      if (!selectedCustomer) {
        ui.toast.error("Elegí un cliente o cambiá de modo");
        setActiveTab("customer");
        return;
      }
      resolvedEmail = selectedCustomer.email;
      resolvedCustomerId = selectedCustomer.id;
      const addr = (_a2 = selectedCustomer.addresses) == null ? void 0 : _a2.find(
        (a) => a.id === selectedAddressId
      );
      if (addr) {
        resolvedAddress = { ...mapAddress(addr), country_code: countryCode };
      }
    } else if (customerMode === "new") {
      resolvedEmail = email || void 0;
      resolvedAddress = includeAddress && (address.address_1 || address.city || address.postal_code) ? { ...address, country_code: countryCode } : void 0;
    }
    const basePayload = {
      internal_name: internalName || void 0,
      items,
      country_code: countryCode,
      region_id: regionId || void 0,
      sales_channel_id: salesChannelId || void 0,
      promo_codes: promoCodes,
      single_use: singleUse,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null
    };
    if (isEdit) {
      update.mutate(
        {
          ...basePayload,
          email: resolvedEmail ?? null,
          customer_id: resolvedCustomerId ?? null,
          shipping_address: resolvedAddress ?? null
        },
        {
          onSuccess: () => {
            ui.toast.success("Link actualizado");
            handleClose(false);
          },
          onError: (e) => ui.toast.error(e.message || "Error al actualizar el link")
        }
      );
      return;
    }
    create.mutate(
      {
        ...basePayload,
        email: resolvedEmail,
        customer_id: resolvedCustomerId,
        shipping_address: resolvedAddress,
        promo_codes: promoCodes.length ? promoCodes : void 0
      },
      {
        onSuccess: (link) => {
          ui.toast.success("Link creado");
          setCreatedUrl(
            link.public_url || `/${link.country_code}/c/${link.token}`
          );
        },
        onError: (e) => ui.toast.error(e.message || "Error al crear el link")
      }
    );
  }
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);
  const isLastTab = activeIndex === TABS.length - 1;
  const isPending = create.isPending || update.isPending;
  const publicUrl = (checkoutLink == null ? void 0 : checkoutLink.public_url) || (checkoutLink ? `/${checkoutLink.country_code}/c/${checkoutLink.token}` : "");
  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      ui.toast.success("URL copiada al portapapeles");
    } catch {
      ui.toast.error("No se pudo copiar la URL");
    }
  }
  return /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal, { open, onOpenChange: handleClose, children: /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Content, { children: createdUrl ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Header, { children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-end gap-x-2", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => handleClose(false), children: "Cerrar" }) }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Body, { className: "flex flex-col items-center overflow-y-auto py-12", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex w-full max-w-xl flex-col gap-y-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "large", weight: "plus", children: "¡Link de venta creado!" }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "URL pública" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: createdUrl, readOnly: true }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "primary", onClick: () => copyUrl(createdUrl), children: "Copiar" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Compartí este enlace: el cliente abrirá un carrito ya armado y avanzará directo hacia el pago." })
    ] }) })
  ] }) : /* @__PURE__ */ jsxRuntime.jsxs(
    ui.ProgressTabs,
    {
      value: activeTab,
      onValueChange: setActiveTab,
      className: "flex h-full flex-col overflow-hidden",
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Header, { className: "flex items-center gap-4", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "-my-2 w-full border-l", children: /* @__PURE__ */ jsxRuntime.jsx(ui.ProgressTabs.List, { children: TABS.map((tab, index) => /* @__PURE__ */ jsxRuntime.jsx(
          ui.ProgressTabs.Trigger,
          {
            value: tab.id,
            status: index < activeIndex ? "completed" : index === activeIndex ? "in-progress" : "not-started",
            children: tab.label
          },
          tab.id
        )) }) }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Body, { className: "flex flex-1 justify-center overflow-y-auto", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "w-full max-w-2xl px-6 py-10", children: [
          /* @__PURE__ */ jsxRuntime.jsxs(ui.ProgressTabs.Content, { value: "general", className: "flex flex-col gap-y-6", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "large", weight: "plus", children: isEdit ? "Editar link de venta" : "Nuevo link de venta" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Generá una URL pública con un carrito precargado." })
            ] }),
            isEdit && publicUrl && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2 rounded-lg border border-ui-border-base bg-ui-bg-subtle p-3", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "URL pública" }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: publicUrl, readOnly: true }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: () => copyUrl(publicUrl), children: "Copiar" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Nombre interno (opcional)" }),
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.Input,
                {
                  placeholder: "Ej. Pedido WhatsApp Juan Pérez",
                  value: internalName,
                  onChange: (e) => setInternalName(e.target.value)
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "País / región" }),
              /* @__PURE__ */ jsxRuntime.jsxs(
                ui.Select,
                {
                  value: countryCode,
                  onValueChange: (v) => {
                    setCountryCode(v);
                    const opt = countryOptions.find((o) => o.iso_2 === v);
                    setRegionId((opt == null ? void 0 : opt.region_id) ?? "");
                  },
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, { placeholder: "Elegí un país" }) }),
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: countryOptions.map((o) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: o.iso_2, children: o.label }, o.iso_2)) })
                  ]
                }
              )
            ] }),
            salesChannels.length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Canal de venta (B2C)" }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: salesChannelId, onValueChange: setSalesChannelId, children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, { placeholder: "Elegí un canal" }) }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: salesChannels.map((sc) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: sc.id, children: sc.name }, sc.id)) })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.ProgressTabs.Content, { value: "items", className: "flex flex-col gap-y-4", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Productos" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                placeholder: "Buscar producto por nombre…",
                value: search,
                onChange: (e) => setSearch(e.target.value)
              }
            ),
            search.trim().length > 1 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "max-h-56 overflow-y-auto rounded-lg border border-ui-border-base", children: searching ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "p-3 text-ui-fg-subtle", children: "Buscando…" }) : products.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "p-3 text-ui-fg-subtle", children: "Sin resultados" }) : products.map((p) => /* @__PURE__ */ jsxRuntime.jsxs(
              "div",
              {
                className: "border-ui-border-base border-b p-2 last:border-b-0",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: p.title }),
                  /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-1 flex flex-wrap gap-1", children: (p.variants ?? []).map((v) => /* @__PURE__ */ jsxRuntime.jsxs(
                    ui.Button,
                    {
                      size: "small",
                      variant: "transparent",
                      className: "border border-ui-border-base",
                      onClick: () => addVariant(p.title, v),
                      children: [
                        "+ ",
                        v.title || "Variante"
                      ]
                    },
                    v.id
                  )) })
                ]
              },
              p.id
            )) }),
            items.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-y-2 rounded-lg border border-ui-border-base p-3", children: items.map((i) => /* @__PURE__ */ jsxRuntime.jsxs(
              "div",
              {
                className: "flex items-center justify-between gap-x-2",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "flex-1 truncate", children: variantLabels[i.variant_id] || `Variante ${i.variant_id.slice(-6)}` }),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    ui.Input,
                    {
                      type: "number",
                      min: 1,
                      className: "w-20",
                      value: i.quantity,
                      onChange: (e) => setQty(i.variant_id, Number(e.target.value))
                    }
                  ),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    ui.IconButton,
                    {
                      variant: "transparent",
                      onClick: () => removeItem(i.variant_id),
                      children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, {})
                    }
                  )
                ]
              },
              i.variant_id
            )) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.ProgressTabs.Content, { value: "customer", className: "flex flex-col gap-y-3", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Cliente" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex gap-2", children: [
              ["existing", "Cliente existente"],
              ["new", "Cliente nuevo"],
              ["none", "Sin cliente"]
            ].map(([mode, label]) => /* @__PURE__ */ jsxRuntime.jsx(
              ui.Button,
              {
                size: "small",
                type: "button",
                variant: customerMode === mode ? "primary" : "secondary",
                onClick: () => setCustomerMode(mode),
                children: label
              },
              mode
            )) }),
            customerMode === "existing" && (selectedCustomer ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-3 rounded-lg border border-ui-border-base p-3", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between gap-x-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: customerLabel(selectedCustomer) }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "transparent", onClick: clearCustomer, children: "Cambiar" })
              ] }),
              (((_a = selectedCustomer.addresses) == null ? void 0 : _a.length) ?? 0) > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-1", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: "Dirección a precargar" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedAddressId(""),
                    className: `rounded-lg border p-2 text-left text-sm ${selectedAddressId === "" ? "border-ui-fg-base bg-ui-bg-subtle" : "border-ui-border-base"}`,
                    children: "No precargar dirección"
                  }
                ),
                (_b = selectedCustomer.addresses) == null ? void 0 : _b.map((a) => /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setSelectedAddressId(a.id),
                    className: `rounded-lg border p-2 text-left text-sm ${selectedAddressId === a.id ? "border-ui-fg-base bg-ui-bg-subtle" : "border-ui-border-base"}`,
                    children: a.id === STORED_ADDRESS_ID ? `${addressLabel(a)} · (actual del link)` : `${addressLabel(a)}${a.is_default_shipping ? " · (default)" : ""}`
                  },
                  a.id
                ))
              ] }) : /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Este cliente no tiene direcciones guardadas." })
            ] }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.Input,
                {
                  placeholder: "Buscar cliente por nombre o email…",
                  value: customerSearch,
                  onChange: (e) => setCustomerSearch(e.target.value)
                }
              ),
              customerSearch.trim().length > 1 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "max-h-56 overflow-y-auto rounded-lg border border-ui-border-base", children: customersLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "p-3 text-ui-fg-subtle", children: "Buscando…" }) : ((customers == null ? void 0 : customers.length) ?? 0) === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "p-3 text-ui-fg-subtle", children: "Sin resultados" }) : customers == null ? void 0 : customers.map((c) => /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  type: "button",
                  onClick: () => selectCustomer(c),
                  className: "block w-full border-ui-border-base border-b p-2 text-left last:border-b-0 hover:bg-ui-bg-subtle",
                  children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: customerLabel(c) })
                },
                c.id
              )) })
            ] })),
            customerMode === "new" && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.Input,
                {
                  type: "email",
                  placeholder: "Email del cliente (opcional)",
                  value: email,
                  onChange: (e) => setEmail(e.target.value)
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: "Precargar dirección de envío" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { checked: includeAddress, onCheckedChange: setIncludeAddress })
              ] }),
              includeAddress && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-3 rounded-lg border border-ui-border-base p-3", children: [
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    placeholder: "Nombre",
                    value: address.first_name,
                    onChange: (e) => setAddress({ ...address, first_name: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    placeholder: "Apellido",
                    value: address.last_name,
                    onChange: (e) => setAddress({ ...address, last_name: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    className: "col-span-2",
                    placeholder: "Dirección",
                    value: address.address_1,
                    onChange: (e) => setAddress({ ...address, address_1: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    placeholder: "Ciudad",
                    value: address.city,
                    onChange: (e) => setAddress({ ...address, city: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    placeholder: "Provincia",
                    value: address.province,
                    onChange: (e) => setAddress({ ...address, province: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    placeholder: "Código postal",
                    value: address.postal_code,
                    onChange: (e) => setAddress({ ...address, postal_code: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Input,
                  {
                    placeholder: "Teléfono",
                    value: address.phone,
                    onChange: (e) => setAddress({ ...address, phone: e.target.value })
                  }
                )
              ] })
            ] }),
            customerMode === "none" && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "El cliente cargará sus datos en el checkout." })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.ProgressTabs.Content, { value: "options", className: "flex flex-col gap-y-6", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Códigos de promoción (opcional)" }),
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.Input,
                {
                  placeholder: "Separá varios con comas",
                  value: promoInput,
                  onChange: (e) => setPromoInput(e.target.value)
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Vence el (opcional)" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.DatePicker,
                  {
                    granularity: "minute",
                    value: localInputToDate(expiresAt),
                    onChange: (d) => setExpiresAt(dateToLocalInput(d))
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Un solo uso" }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex h-10 items-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { checked: singleUse, onCheckedChange: setSingleUse }) })
              ] })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Footer, { children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-end gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              variant: "secondary",
              size: "small",
              onClick: () => handleClose(false),
              disabled: isPending,
              children: "Cancelar"
            }
          ),
          activeIndex > 0 && /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              variant: "secondary",
              size: "small",
              type: "button",
              onClick: () => {
                const prev = TABS[activeIndex - 1];
                if (prev) setActiveTab(prev.id);
              },
              children: "Atrás"
            }
          ),
          isLastTab || isEdit ? /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: handleSubmit, isLoading: isPending, children: isEdit ? "Guardar" : "Generar link" }) : /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              size: "small",
              type: "button",
              onClick: () => {
                const next = TABS[activeIndex + 1];
                if (next) setActiveTab(next.id);
              },
              children: "Continuar"
            }
          )
        ] }) })
      ]
    }
  ) }) });
}
const PAGE_SIZE = 20;
const columnHelper = ui.createDataTableColumnHelper();
function effectiveStatus(link) {
  if (link.status === "disabled") return { label: "Deshabilitado", color: "grey" };
  if (link.status === "used") return { label: "Usado", color: "orange" };
  if (link.expires_at && new Date(link.expires_at) <= /* @__PURE__ */ new Date()) {
    return { label: "Vencido", color: "red" };
  }
  return { label: "Activo", color: "green" };
}
const SalesLinksPage = () => {
  const [createOpen, setCreateOpen] = react.useState(false);
  const [editing, setEditing] = react.useState(null);
  const [pagination, setPagination] = react.useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isLoading } = useCheckoutLinks({ limit: pagination.pageSize, offset });
  const links = react.useMemo(() => (data == null ? void 0 : data.checkout_links) ?? [], [data == null ? void 0 : data.checkout_links]);
  const count = (data == null ? void 0 : data.count) ?? 0;
  const columns = react.useMemo(
    () => [
      columnHelper.accessor("internal_name", {
        header: "Nombre",
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: row.original.internal_name || row.original.token })
      }),
      columnHelper.accessor("country_code", {
        header: "País",
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "uppercase text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.display({
        id: "items",
        header: "Ítems",
        cell: ({ row }) => {
          var _a;
          return /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: ((_a = row.original.items) == null ? void 0 : _a.length) ?? 0 });
        }
      }),
      columnHelper.display({
        id: "flags",
        header: "Opciones",
        cell: ({ row }) => {
          var _a;
          return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-1", children: [
            row.original.email ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "blue", children: "email" }) : null,
            row.original.shipping_address ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "purple", children: "dirección" }) : null,
            ((_a = row.original.promo_codes) == null ? void 0 : _a.length) ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "green", children: "promo" }) : null,
            row.original.single_use ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "orange", children: "1 uso" }) : null
          ] });
        }
      }),
      columnHelper.accessor("used_count", {
        header: "Usos",
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: getValue() ?? 0 })
      }),
      columnHelper.display({
        id: "status",
        header: "Estado",
        cell: ({ row }) => {
          const s = effectiveStatus(row.original);
          return /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: s.color, children: s.label });
        }
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex justify-end", onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsx(
          CheckoutLinkActionsMenu,
          {
            link: row.original,
            onEdit: () => setEditing(row.original)
          }
        ) })
      })
    ],
    []
  );
  const table = ui.useDataTable({
    columns,
    data: links,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: {
      state: pagination,
      onPaginationChange: setPagination
    },
    onRowClick: (_event, row) => setEditing(row.original)
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-0", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: "Links de Venta" }),
          /* @__PURE__ */ jsxRuntime.jsx(admin.ExtensionVersion, { extension: "checkout-links" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => setCreateOpen(true), children: "Crear link" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "checkout-links" }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {}),
      /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Pagination, {})
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(
      admin.ExtensionSettingsCard,
      {
        namespace: "extension:checkout-links",
        title: "Origen de los links",
        description: "El dominio con el que se arman los links públicos sale del entorno del backend y no se puede cambiar desde el admin."
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(CheckoutLinkFormModal, { open: createOpen, onOpenChange: setCreateOpen }),
    editing && /* @__PURE__ */ jsxRuntime.jsx(
      CheckoutLinkFormModal,
      {
        open: true,
        checkoutLink: editing,
        onOpenChange: (o) => {
          if (!o) setEditing(null);
        }
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const SalesLinksIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.ShoppingCart, { style: { color: "#4B8EEF" } });
const config = adminSdk.defineRouteConfig({
  label: "Links de Venta",
  icon: SalesLinksIcon,
  rank: 35
});
const handle = {
  breadcrumb: () => "Links de Venta"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: SalesLinksPage,
      path: "/checkout-links",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/checkout-links",
      nested: void 0,
      rank: 35,
      translationNs: void 0
    }
  ]
};
const formModule = { customFields: {} };
const displayModule = {
  displays: {}
};
const i18nModule = { resources: {} };
const cellRendererModule = {};
const layoutModule = { layouts: [] };
const plugin = {
  widgetModule,
  routeModule,
  menuItemModule,
  formModule,
  displayModule,
  i18nModule,
  cellRendererModule,
  layoutModule
};
module.exports = plugin;
