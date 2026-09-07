import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Gift } from "@medusajs/icons";
import { Container, Text, Heading, Button, Select, Input, StatusBadge, Badge, Drawer, Label, toast, Switch, Textarea } from "@medusajs/ui";
import { useMemo, useState, useEffect } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Medusa from "@medusajs/js-sdk";
import { SingleColumnLayout, HelpDrawer, ExtensionSettingsCard } from "@minimalart/mercatto-plugin-runtime/admin";
import "@medusajs/admin-shared";
const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const giftCardKeys = { all: ["gift-card-experience"] };
function useGiftCardPermissions() {
  return useQuery({
    queryKey: [...giftCardKeys.all, "permissions"],
    queryFn: () => sdk.client.fetch("/admin/gift-card-experience/permissions"),
    staleTime: 6e4
  });
}
function useGiftCardDeliveries(filters = {}, enabled = true) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value))).toString();
  return useQuery({ queryKey: [...giftCardKeys.all, "deliveries", filters], enabled, queryFn: () => sdk.client.fetch(`/admin/gift-card-experience/deliveries${query ? `?${query}` : ""}`) });
}
function useGiftCardDelivery(id, enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, "delivery", id], enabled: enabled && Boolean(id), queryFn: () => sdk.client.fetch(`/admin/gift-card-experience/deliveries/${id}`) });
}
function useGiftCardDesigns(enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, "designs"], enabled, queryFn: () => sdk.client.fetch("/admin/gift-card-experience/designs") });
}
function useGiftCardSettings(enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, "settings"], enabled, queryFn: () => sdk.client.fetch("/admin/gift-card-experience/settings") });
}
function useGiftCardAnalytics(enabled = true) {
  return useQuery({ queryKey: [...giftCardKeys.all, "analytics"], enabled, queryFn: () => sdk.client.fetch("/admin/gift-card-experience/analytics") });
}
function useGiftCardAction() {
  const query = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method = "POST" }) => sdk.client.fetch(path, { method, ...body ? { body } : {} }),
    onSuccess: () => query.invalidateQueries({ queryKey: giftCardKeys.all })
  });
}
const errorMessage = (error) => error instanceof Error ? error.message : "No se pudo completar la operación.";
const money = (value, currency = "ARS") => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: currency.toUpperCase(),
  maximumFractionDigits: 0
}).format(Number(value) || 0);
const dateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const statusColor = (status) => ["sent", "delivered", "issued"].includes(status ?? "") ? "green" : ["failed", "dead_letter"].includes(status ?? "") ? "red" : ["pending", "processing", "scheduled", "awaiting_payment"].includes(status ?? "") ? "orange" : "grey";
const FALLBACK_PREVIEW = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1580 1000"><rect width="1580" height="1000" rx="72" fill="#e4e4e7"/><text x="790" y="530" fill="#71717a" font-family="Arial,sans-serif" font-size="64" font-weight="700" text-anchor="middle">Sin imagen</text></svg>')}`;
const safeImageUrl = (value) => {
  if (!value) return FALLBACK_PREVIEW;
  if (/^\/(?!\/)/.test(value) && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : FALLBACK_PREVIEW;
  } catch {
    return FALLBACK_PREVIEW;
  }
};
function DeliveryDrawer({ id, canOperate, onClose }) {
  var _a, _b, _c, _d, _e;
  const detail = useGiftCardDelivery(id, Boolean(id));
  const action = useGiftCardAction();
  const delivery = (_a = detail.data) == null ? void 0 : _a.delivery;
  const [email, setEmail] = useState("");
  const [secureLink, setSecureLink] = useState("");
  useEffect(() => {
    setEmail((delivery == null ? void 0 : delivery.recipient_email) ?? "");
    setSecureLink("");
  }, [delivery == null ? void 0 : delivery.id, delivery == null ? void 0 : delivery.recipient_email]);
  const mutate = (path, body) => action.mutate({ path, body }, {
    onSuccess: () => toast.success("Operación completada"),
    onError: (error) => toast.error(errorMessage(error))
  });
  const obtainLink = () => id && action.mutate({ path: `/admin/gift-card-experience/deliveries/${id}/secure-link` }, {
    onSuccess: async (result) => {
      setSecureLink(String(result.url));
      try {
        await navigator.clipboard.writeText(String(result.url));
        toast.success("Enlace auditado y copiado");
      } catch {
        toast.info("Enlace generado. Podés copiarlo desde el campo.");
      }
    },
    onError: (error) => toast.error(errorMessage(error))
  });
  return /* @__PURE__ */ jsx(Drawer, { open: Boolean(id), onOpenChange: (open) => !open && onClose(), children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Drawer.Title, { children: "Detalle de entrega" }) }),
    /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-col gap-6 overflow-y-auto", children: [
      detail.isLoading && /* @__PURE__ */ jsx(Text, { children: "Cargando…" }),
      delivery && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Orden" }),
            /* @__PURE__ */ jsxs(Text, { children: [
              "#",
              delivery.order_display_id ?? delivery.order_id
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Unidad" }),
            /* @__PURE__ */ jsx(Text, { children: Number(delivery.unit_index) + 1 })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Valor" }),
            /* @__PURE__ */ jsx(Text, { children: money(delivery.face_value, delivery.currency_code) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Pagado" }),
            /* @__PURE__ */ jsx(Text, { children: money(delivery.paid_amount, delivery.currency_code) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Emisión" }),
            /* @__PURE__ */ jsx(StatusBadge, { color: statusColor(delivery.issuance_status), children: delivery.issuance_status })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Entrega" }),
            /* @__PURE__ */ jsx(StatusBadge, { color: statusColor(delivery.delivery_status), children: delivery.delivery_status })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Programada" }),
            /* @__PURE__ */ jsx(Text, { children: dateTime(delivery.scheduled_at) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Vencimiento" }),
            /* @__PURE__ */ jsx(Text, { children: dateTime(delivery.expires_at) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Primer uso" }),
            /* @__PURE__ */ jsx(Text, { children: dateTime(delivery.first_used_at) })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Saldo agotado" }),
            /* @__PURE__ */ jsx(Text, { children: dateTime(delivery.exhausted_at) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx(Heading, { level: "h3", children: "Destinatario" }),
          /* @__PURE__ */ jsxs(Text, { children: [
            delivery.recipient_name || "Sin nombre",
            " · ",
            delivery.recipient_email || delivery.buyer_email
          ] }),
          delivery.sender_name && /* @__PURE__ */ jsxs(Text, { size: "small", children: [
            "De: ",
            delivery.anonymous ? "Anónimo" : delivery.sender_name
          ] }),
          delivery.message && /* @__PURE__ */ jsx(Text, { size: "small", className: "rounded-lg bg-ui-bg-subtle p-3", children: delivery.message })
        ] }),
        canOperate && delivery.delivery_mode === "recipient" && !["sent", "delivered", "canceled"].includes(delivery.delivery_status) && /* @__PURE__ */ jsxs("form", { className: "space-y-2", onSubmit: (event) => {
          event.preventDefault();
          mutate(`/admin/gift-card-experience/deliveries/${id}`, { recipient_email: email });
        }, children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "delivery-recipient-email", children: "Cambiar email antes del envío" }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx(Input, { id: "delivery-recipient-email", type: "email", required: true, value: email, onChange: (event) => setEmail(event.target.value) }),
            /* @__PURE__ */ jsx(Button, { type: "submit", variant: "secondary", isLoading: action.isPending, children: "Guardar" })
          ] })
        ] }),
        canOperate && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          ["failed", "dead_letter", "sent"].includes(delivery.delivery_status) && /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => mutate(`/admin/gift-card-experience/deliveries/${id}/retry`), children: "Reenviar" }),
          delivery.delivery_status === "scheduled" && /* @__PURE__ */ jsx(Button, { variant: "danger", onClick: () => mutate(`/admin/gift-card-experience/deliveries/${id}/cancel`), children: "Cancelar notificación" }),
          delivery.token_available !== false && /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: obtainLink, children: "Obtener enlace seguro" })
        ] }),
        secureLink && /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "secure-link", children: "Enlace sensible generado" }),
          /* @__PURE__ */ jsx(Input, { id: "secure-link", readOnly: true, value: secureLink, onFocus: (event) => event.currentTarget.select() }),
          /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "La obtención quedó registrada en el historial administrativo." })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Heading, { level: "h3", children: "Intentos de entrega" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-2 space-y-2", children: [
            (((_b = detail.data) == null ? void 0 : _b.attempts) ?? []).map((attempt) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border p-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ jsxs(Text, { weight: "plus", children: [
                  "Intento ",
                  attempt.attempt_no
                ] }),
                /* @__PURE__ */ jsx(StatusBadge, { color: statusColor(attempt.status), children: attempt.status })
              ] }),
              /* @__PURE__ */ jsxs(Text, { size: "xsmall", children: [
                dateTime(attempt.attempted_at),
                " · ",
                attempt.channel
              ] }),
              attempt.error && /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-error", children: attempt.error })
            ] }, attempt.id)),
            !((_d = (_c = detail.data) == null ? void 0 : _c.attempts) == null ? void 0 : _d.length) && /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: "Sin intentos registrados." })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Heading, { level: "h3", children: "Historial" }),
          /* @__PURE__ */ jsx("div", { className: "mt-2 space-y-2", children: (((_e = detail.data) == null ? void 0 : _e.events) ?? []).map((event) => /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3 border-b py-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { weight: "plus", children: String(event.event).replaceAll("_", " ") }),
              /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: event.actor_id ? `Admin: ${event.actor_id}` : "Sistema" })
            ] }),
            /* @__PURE__ */ jsx(Text, { size: "xsmall", children: dateTime(event.occurred_at ?? event.created_at) })
          ] }, event.id)) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Drawer.Footer, { children: /* @__PURE__ */ jsx(Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "secondary", children: "Cerrar" }) }) })
  ] }) });
}
function DesignDrawer({ design, onClose }) {
  const action = useGiftCardAction();
  const current = design === "new" ? void 0 : design ?? void 0;
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const mobile = String(form.get("mobile_image_url") ?? "").trim();
    const body = {
      name: String(form.get("name") ?? "").trim(),
      occasion: String(form.get("occasion")),
      desktop_image_url: String(form.get("desktop_image_url") ?? "").trim(),
      text_color: String(form.get("text_color")),
      content_position: String(form.get("content_position")),
      sort_order: Number(form.get("sort_order")),
      active: form.get("active") === "on",
      ...mobile ? { mobile_image_url: mobile } : { mobile_image_url: null },
      ...!current ? { public_id: String(form.get("public_id") ?? "").trim() } : {}
    };
    action.mutate({ path: current ? `/admin/gift-card-experience/designs/${current.id}` : "/admin/gift-card-experience/designs", body }, {
      onSuccess: () => {
        toast.success(current ? "Diseño actualizado" : "Diseño creado");
        onClose();
      },
      onError: (error) => toast.error(errorMessage(error))
    });
  };
  return /* @__PURE__ */ jsx(Drawer, { open: Boolean(design), onOpenChange: (open) => !open && onClose(), children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Drawer.Title, { children: current ? "Editar diseño" : "Nuevo diseño" }) }),
    /* @__PURE__ */ jsxs("form", { className: "contents", onSubmit: submit, children: [
      /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
        !current && /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "design-public-id", children: "ID público" }),
          /* @__PURE__ */ jsx(Input, { id: "design-public-id", name: "public_id", required: true, pattern: "[a-z0-9][a-z0-9-]{1,119}", placeholder: "birthday-01" })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "design-name", children: "Nombre" }),
          /* @__PURE__ */ jsx(Input, { id: "design-name", name: "name", required: true, maxLength: 120, defaultValue: current == null ? void 0 : current.name })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "design-occasion", children: "Ocasión" }),
          /* @__PURE__ */ jsxs(Select, { name: "occasion", defaultValue: (current == null ? void 0 : current.occasion) ?? "general", children: [
            /* @__PURE__ */ jsx(Select.Trigger, { id: "design-occasion", children: /* @__PURE__ */ jsx(Select.Value, {}) }),
            /* @__PURE__ */ jsx(Select.Content, { children: ["general", "birthday", "thanks", "congratulations", "holidays", "brand"].map((item) => /* @__PURE__ */ jsx(Select.Item, { value: item, children: item }, item)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "design-desktop", children: "Imagen desktop" }),
          /* @__PURE__ */ jsx(Input, { id: "design-desktop", name: "desktop_image_url", required: true, defaultValue: current == null ? void 0 : current.desktop_image_url, placeholder: "/uploads/gift-cards/design.webp" })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "design-mobile", children: "Imagen mobile" }),
          /* @__PURE__ */ jsx(Input, { id: "design-mobile", name: "mobile_image_url", defaultValue: (current == null ? void 0 : current.mobile_image_url) ?? "", placeholder: "Opcional; usa desktop si queda vacío" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "design-color", children: "Color de texto" }),
            /* @__PURE__ */ jsx(Input, { id: "design-color", name: "text_color", required: true, pattern: "#[0-9A-Fa-f]{6}", defaultValue: (current == null ? void 0 : current.text_color) ?? "#FFFFFF" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "design-order", children: "Orden" }),
            /* @__PURE__ */ jsx(Input, { id: "design-order", name: "sort_order", type: "number", min: 0, max: 1e4, defaultValue: (current == null ? void 0 : current.sort_order) ?? 0 })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "design-position", children: "Posición del contenido" }),
          /* @__PURE__ */ jsxs(Select, { name: "content_position", defaultValue: (current == null ? void 0 : current.content_position) ?? "center", children: [
            /* @__PURE__ */ jsx(Select.Trigger, { id: "design-position", children: /* @__PURE__ */ jsx(Select.Value, {}) }),
            /* @__PURE__ */ jsx(Select.Content, { children: ["top_left", "top_center", "top_right", "center_left", "center", "center_right", "bottom_left", "bottom_center", "bottom_right"].map((item) => /* @__PURE__ */ jsx(Select.Item, { value: item, children: item.replaceAll("_", " ") }, item)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", name: "active", defaultChecked: (current == null ? void 0 : current.active) ?? true }),
          /* @__PURE__ */ jsx(Text, { children: "Diseño activo" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Drawer.Footer, { children: [
        /* @__PURE__ */ jsx(Button, { type: "button", variant: "secondary", onClick: onClose, children: "Cancelar" }),
        /* @__PURE__ */ jsx(Button, { type: "submit", isLoading: action.isPending, children: "Guardar" })
      ] })
    ] }, (current == null ? void 0 : current.id) ?? "new")
  ] }) });
}
function DeliveriesTab({ canOperate }) {
  var _a, _b, _c, _d;
  const [filters, setFilters] = useState({ delivery_status: "", issuance_status: "", order_id: "" });
  const [selectedId, setSelectedId] = useState();
  const deliveries = useGiftCardDeliveries(filters);
  return /* @__PURE__ */ jsxs(Container, { children: [
    /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Entregas" }),
      /* @__PURE__ */ jsxs(Text, { className: "text-ui-fg-subtle", children: [
        ((_a = deliveries.data) == null ? void 0 : _a.count) ?? 0,
        " unidades registradas"
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-3 md:grid-cols-3", children: [
      /* @__PURE__ */ jsxs(Select, { value: filters.delivery_status || "__all__", onValueChange: (value) => setFilters((current) => ({ ...current, delivery_status: value === "__all__" ? "" : value })), children: [
        /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Estado de entrega" }) }),
        /* @__PURE__ */ jsxs(Select.Content, { children: [
          /* @__PURE__ */ jsx(Select.Item, { value: "__all__", children: "Todas las entregas" }),
          ["scheduled", "pending", "processing", "sent", "delivered", "failed", "dead_letter", "canceled"].map((item) => /* @__PURE__ */ jsx(Select.Item, { value: item, children: item }, item))
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Select, { value: filters.issuance_status || "__all__", onValueChange: (value) => setFilters((current) => ({ ...current, issuance_status: value === "__all__" ? "" : value })), children: [
        /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Estado de emisión" }) }),
        /* @__PURE__ */ jsxs(Select.Content, { children: [
          /* @__PURE__ */ jsx(Select.Item, { value: "__all__", children: "Todas las emisiones" }),
          ["awaiting_payment", "processing", "issued", "failed", "canceled"].map((item) => /* @__PURE__ */ jsx(Select.Item, { value: item, children: item }, item))
        ] })
      ] }),
      /* @__PURE__ */ jsx(Input, { "aria-label": "Filtrar por ID de orden", value: filters.order_id, onChange: (event) => setFilters((current) => ({ ...current, order_id: event.target.value.trim() })), placeholder: "ID exacto de orden" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 overflow-x-auto", children: [
      /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm", children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b", children: [
          /* @__PURE__ */ jsx("th", { className: "py-3", children: "Destinatario" }),
          /* @__PURE__ */ jsx("th", { children: "Orden" }),
          /* @__PURE__ */ jsx("th", { children: "Importe" }),
          /* @__PURE__ */ jsx("th", { children: "Entrega" }),
          /* @__PURE__ */ jsx("th", { children: "Emisión" }),
          /* @__PURE__ */ jsx("th", { children: "Fecha" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: (((_b = deliveries.data) == null ? void 0 : _b.deliveries) ?? []).map((delivery) => /* @__PURE__ */ jsxs("tr", { className: "cursor-pointer border-b last:border-0 hover:bg-ui-bg-subtle", onClick: () => setSelectedId(delivery.id), children: [
          /* @__PURE__ */ jsx("td", { className: "py-3", children: delivery.recipient_email ?? delivery.buyer_email }),
          /* @__PURE__ */ jsxs("td", { children: [
            "#",
            delivery.order_display_id ?? delivery.order_id
          ] }),
          /* @__PURE__ */ jsx("td", { children: money(delivery.face_value, delivery.currency_code) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx(StatusBadge, { color: statusColor(delivery.delivery_status), children: delivery.delivery_status }) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx(Badge, { children: delivery.issuance_status }) }),
          /* @__PURE__ */ jsx("td", { children: dateTime(delivery.scheduled_at ?? delivery.created_at) })
        ] }, delivery.id)) })
      ] }),
      !deliveries.isLoading && !((_d = (_c = deliveries.data) == null ? void 0 : _c.deliveries) == null ? void 0 : _d.length) && /* @__PURE__ */ jsx(Text, { className: "py-8 text-center text-ui-fg-muted", children: "No hay entregas para estos filtros." })
    ] }),
    /* @__PURE__ */ jsx(DeliveryDrawer, { id: selectedId, canOperate, onClose: () => setSelectedId(void 0) })
  ] });
}
function DesignsTab({ canEdit }) {
  var _a;
  const designs = useGiftCardDesigns();
  const action = useGiftCardAction();
  const [editor, setEditor] = useState(null);
  const archive = (design) => action.mutate({ path: `/admin/gift-card-experience/designs/${design.id}`, method: "DELETE" }, { onSuccess: () => toast.success("Diseño archivado"), onError: (error) => toast.error(errorMessage(error)) });
  return /* @__PURE__ */ jsxs(Container, { children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Diseños" }),
        /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Las compras conservan una copia congelada del diseño." })
      ] }),
      canEdit && /* @__PURE__ */ jsx(Button, { onClick: () => setEditor("new"), children: "Nuevo diseño" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-4 md:grid-cols-3", children: (((_a = designs.data) == null ? void 0 : _a.designs) ?? []).map((design) => /* @__PURE__ */ jsxs("article", { className: "overflow-hidden rounded-lg border", children: [
      /* @__PURE__ */ jsx("img", { alt: `Vista previa de ${design.name}`, className: "aspect-[1.58/1] w-full object-cover", src: safeImageUrl(design.desktop_image_url), onError: (event) => {
        const img = event.currentTarget;
        if (img.src !== FALLBACK_PREVIEW) img.src = FALLBACK_PREVIEW;
      } }),
      /* @__PURE__ */ jsxs("div", { className: "space-y-3 p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { weight: "plus", children: design.name }),
            /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-muted", children: [
              design.public_id,
              " · ",
              design.occasion
            ] })
          ] }),
          /* @__PURE__ */ jsx(StatusBadge, { color: design.active ? "green" : "grey", children: design.active ? "Activo" : "Archivado" })
        ] }),
        canEdit && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => setEditor(design), children: "Editar" }),
          design.active && /* @__PURE__ */ jsx(Button, { size: "small", variant: "danger", onClick: () => archive(design), children: "Archivar" })
        ] })
      ] })
    ] }, design.id)) }),
    /* @__PURE__ */ jsx(DesignDrawer, { design: editor, onClose: () => setEditor(null) })
  ] });
}
function AnalyticsTab() {
  var _a;
  const analytics = useGiftCardAnalytics();
  const data = (_a = analytics.data) == null ? void 0 : _a.analytics;
  const cards = [["Vendidas", data == null ? void 0 : data.sold_count], ["Reclamadas", data == null ? void 0 : data.claimed_count], ["Entregadas", data == null ? void 0 : data.delivered_count], ["Primer uso", data == null ? void 0 : data.first_use_count], ["Saldo agotado", data == null ? void 0 : data.exhausted_count], ["Días al claim", (Number((data == null ? void 0 : data.average_seconds_to_claim) ?? 0) / 86400).toFixed(1)], ["Días al primer uso", (Number((data == null ? void 0 : data.average_seconds_to_first_use) ?? 0) / 86400).toFixed(1)]];
  return /* @__PURE__ */ jsxs(Container, { children: [
    /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Analytics" }),
    /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Eventos operativos sin códigos ni PII." }),
    /* @__PURE__ */ jsx("div", { className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: cards.map(([label, value]) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border p-4", children: [
      /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: label }),
      /* @__PURE__ */ jsx(Text, { size: "large", weight: "plus", children: value ?? 0 })
    ] }, String(label))) }),
    /* @__PURE__ */ jsx(Heading, { className: "mt-8", level: "h3", children: "Importes por moneda" }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 grid gap-3 md:grid-cols-2", children: ((data == null ? void 0 : data.per_currency) ?? []).map((row) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border p-4", children: [
      /* @__PURE__ */ jsx(Text, { weight: "plus", children: String(row.currency_code).toUpperCase() }),
      /* @__PURE__ */ jsxs(Text, { size: "small", children: [
        "Ticket promedio: ",
        money(row.average_paid_amount, row.currency_code)
      ] }),
      /* @__PURE__ */ jsxs(Text, { size: "small", children: [
        "Valor emitido: ",
        money(row.face_value_total, row.currency_code)
      ] }),
      /* @__PURE__ */ jsxs(Text, { size: "small", children: [
        "Pagado: ",
        money(row.paid_total, row.currency_code)
      ] }),
      /* @__PURE__ */ jsxs(Text, { size: "small", children: [
        "Bonificación de campañas: ",
        money(row.campaign_bonus_total, row.currency_code)
      ] }),
      /* @__PURE__ */ jsxs(Text, { size: "small", children: [
        "Saldo atribuido no utilizado: ",
        money(row.unused_attributed_balance ?? row.unclaimed_face_value, row.currency_code)
      ] })
    ] }, row.currency_code)) }),
    /* @__PURE__ */ jsx(Heading, { className: "mt-8", level: "h3", children: "Conversión por diseño" }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left text-sm", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b", children: [
        /* @__PURE__ */ jsx("th", { className: "py-2", children: "Diseño" }),
        /* @__PURE__ */ jsx("th", { children: "Compras" }),
        /* @__PURE__ */ jsx("th", { children: "Claims" }),
        /* @__PURE__ */ jsx("th", { children: "Conversión" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: ((data == null ? void 0 : data.by_design) ?? []).map((row) => /* @__PURE__ */ jsxs("tr", { className: "border-b", children: [
        /* @__PURE__ */ jsx("td", { className: "py-2", children: row.design_id }),
        /* @__PURE__ */ jsx("td", { children: row.sold_count }),
        /* @__PURE__ */ jsx("td", { children: row.claimed_count }),
        /* @__PURE__ */ jsxs("td", { children: [
          Number(row.claim_rate ?? 0).toFixed(1),
          "%"
        ] })
      ] }, row.design_id)) })
    ] }) })
  ] });
}
const GiftCardExperiencePage = () => {
  var _a;
  const navigate = useNavigate();
  const access = useGiftCardPermissions();
  const permissions = ((_a = access.data) == null ? void 0 : _a.permissions) ?? [];
  const has = (permission) => permissions.includes(permission);
  const tabs = useMemo(() => [
    ...has("gift_cards.read") ? [{ id: "deliveries", label: "Entregas" }, { id: "designs", label: "Diseños" }] : [],
    ...has("gift_cards.metrics") ? [{ id: "analytics", label: "Analytics" }] : []
  ], [permissions.join("|")]);
  const [tab, setTab] = useState("deliveries");
  useEffect(() => {
    if (tabs.length && !tabs.some((item) => item.id === tab)) setTab(tabs[0].id);
  }, [tabs, tab]);
  if (access.isLoading) return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { children: "Verificando permisos…" }) });
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-4", children: [
    /* @__PURE__ */ jsxs(Container, { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Heading, { level: "h1", children: "Gift Card Experience" }),
          /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Diseño, entrega y métricas. El valor monetario permanece en el plugin oficial." })
        ] }),
        /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: () => navigate("/gift-cards"), children: "Tarjetas oficiales" })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-5 flex flex-wrap gap-2", children: tabs.map((item) => /* @__PURE__ */ jsx(Button, { onClick: () => setTab(item.id), variant: tab === item.id ? "primary" : "secondary", children: item.label }, item.id)) })
    ] }),
    tab === "deliveries" && has("gift_cards.read") && /* @__PURE__ */ jsx(DeliveriesTab, { canOperate: has("gift_cards.deliveries") }),
    tab === "designs" && has("gift_cards.read") && /* @__PURE__ */ jsx(DesignsTab, { canEdit: has("gift_cards.designs") }),
    tab === "analytics" && has("gift_cards.metrics") && /* @__PURE__ */ jsx(AnalyticsTab, {})
  ] });
};
const config$2 = defineRouteConfig({ label: "Gift Card Experience", icon: Gift });
const handle$2 = {
  breadcrumb: () => "Gift Card Experience"
};
const CredentialsPage = () => /* @__PURE__ */ jsx(Navigate, { to: "/settings/site-credentials#gift-cards", replace: true });
const config$1 = defineRouteConfig({ label: "Credenciales", rank: 99 });
const handle$1 = { breadcrumb: () => "Credenciales" };
const GiftCardSettingsPage = () => {
  var _a, _b, _c, _d, _e;
  const access = useGiftCardPermissions();
  const permissions = ((_a = access.data) == null ? void 0 : _a.permissions) ?? [];
  const allowed = permissions.includes("gift_cards.settings");
  const settings = useGiftCardSettings(allowed);
  const designs = useGiftCardDesigns(allowed);
  const action = useGiftCardAction();
  const [enabled, setEnabled] = useState(false);
  const [fallback, setFallback] = useState(true);
  useEffect(() => {
    var _a2;
    if ((_a2 = settings.data) == null ? void 0 : _a2.settings) {
      setEnabled(Boolean(settings.data.settings.enabled));
      setFallback(Boolean(settings.data.settings.fallback_to_buyer));
    }
  }, [(_b = settings.data) == null ? void 0 : _b.settings]);
  if (access.isLoading) return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { children: "Verificando permisos…" }) });
  if (!allowed) return /* @__PURE__ */ jsxs(Container, { children: [
    /* @__PURE__ */ jsx(Heading, { level: "h1", children: "Configuración" }),
    /* @__PURE__ */ jsxs(Text, { className: "text-ui-fg-subtle", children: [
      "No tenés el permiso ",
      /* @__PURE__ */ jsx("code", { children: "gift_cards.settings" }),
      "."
    ] })
  ] });
  if (!((_c = settings.data) == null ? void 0 : _c.settings)) return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { children: "Cargando configuración…" }) });
  const current = settings.data.settings;
  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const retries = String(form.get("retry_delays") ?? "").split(",").map((value) => Number(value.trim()));
    if (retries.length !== 5 || retries.some((value) => !Number.isInteger(value) || value < 1)) {
      toast.error("Los reintentos deben contener exactamente cinco minutos enteros positivos.");
      return;
    }
    const nullableNumber = (name) => String(form.get(name) ?? "").trim() ? Number(form.get(name)) : null;
    const nullableText = (name) => String(form.get(name) ?? "").trim() || null;
    action.mutate({ path: "/admin/gift-card-experience/settings", body: {
      enabled,
      fallback_to_buyer: fallback,
      timezone: String(form.get("timezone")),
      morning_time: String(form.get("morning_time")),
      afternoon_time: String(form.get("afternoon_time")),
      evening_time: String(form.get("evening_time")),
      schedule_horizon_days: Number(form.get("schedule_horizon_days")),
      default_expiry_days: nullableNumber("default_expiry_days"),
      default_design_id: String(form.get("default_design_id")),
      retry_delays_minutes: retries,
      balance_reminder_days: nullableNumber("balance_reminder_days"),
      expiring_notice_days: nullableNumber("expiring_notice_days"),
      legal_text: nullableText("legal_text"),
      terms_url: nullableText("terms_url"),
      merchandising_url: nullableText("merchandising_url")
    } }, { onSuccess: () => toast.success("Configuración guardada"), onError: (error) => toast.error(errorMessage(error)) });
  };
  const retryValues = Array.isArray((_d = current.retry_delays_minutes) == null ? void 0 : _d.delays) ? current.retry_delays_minutes.delays.join(", ") : "1, 5, 30, 120, 720";
  return /* @__PURE__ */ jsxs(SingleColumnLayout, { children: [
    /* @__PURE__ */ jsxs(Container, { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx(Heading, { level: "h1", children: "Configuración" }),
        /* @__PURE__ */ jsx(HelpDrawer, { slug: "gift-cards" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "mt-4 grid max-w-3xl gap-5", onSubmit: submit, children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border p-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { weight: "plus", children: "Extensión operativa" }),
            /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: "Controla emisión propia, jobs y experiencia." })
          ] }),
          /* @__PURE__ */ jsx(Switch, { checked: enabled, onCheckedChange: setEnabled })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-timezone", children: "Zona horaria" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-timezone", name: "timezone", defaultValue: current.timezone })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-design", children: "Diseño predeterminado" }),
            /* @__PURE__ */ jsxs(Select, { name: "default_design_id", defaultValue: current.default_design_id, children: [
              /* @__PURE__ */ jsx(Select.Trigger, { id: "settings-design", children: /* @__PURE__ */ jsx(Select.Value, {}) }),
              /* @__PURE__ */ jsx(Select.Content, { children: (((_e = designs.data) == null ? void 0 : _e.designs) ?? []).map((design) => /* @__PURE__ */ jsx(Select.Item, { value: design.public_id, children: design.name }, design.public_id)) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "grid gap-4 md:grid-cols-3", children: [["morning_time", "Mañana"], ["afternoon_time", "Tarde"], ["evening_time", "Noche"]].map(([name, label]) => /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: `settings-${name}`, children: label }),
          /* @__PURE__ */ jsx(Input, { id: `settings-${name}`, name, type: "time", defaultValue: current[name] })
        ] }, name)) }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-horizon", children: "Programación máxima (días)" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-horizon", name: "schedule_horizon_days", type: "number", min: 1, max: 365, defaultValue: current.schedule_horizon_days })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-expiry", children: "Vigencia predeterminada (días)" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-expiry", name: "default_expiry_days", type: "number", min: 1, max: 3650, defaultValue: current.default_expiry_days ?? "", placeholder: "Sin vencimiento" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "settings-retries", children: "Reintentos en minutos" }),
          /* @__PURE__ */ jsx(Input, { id: "settings-retries", name: "retry_delays", defaultValue: retryValues }),
          /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Exactamente cinco valores separados por coma." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-reminder", children: "Recordar saldo después de (días)" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-reminder", name: "balance_reminder_days", type: "number", min: 1, max: 3650, defaultValue: current.balance_reminder_days ?? "", placeholder: "Desactivado" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-expiring", children: "Avisar vencimiento con anticipación (días)" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-expiring", name: "expiring_notice_days", type: "number", min: 1, max: 365, defaultValue: current.expiring_notice_days ?? "", placeholder: "Desactivado" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border p-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Text, { weight: "plus", children: "Avisar al comprador si falla la entrega" }),
            /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: "Se envía una única notificación al pasar a dead letter." })
          ] }),
          /* @__PURE__ */ jsx(Switch, { checked: fallback, onCheckedChange: setFallback })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "settings-legal", children: "Texto legal" }),
          /* @__PURE__ */ jsx(Textarea, { id: "settings-legal", name: "legal_text", maxLength: 5e3, defaultValue: current.legal_text ?? "" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-terms", children: "URL de términos" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-terms", name: "terms_url", defaultValue: current.terms_url ?? "", placeholder: "https://…" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx(Label, { htmlFor: "settings-merchandising", children: "Destino de merchandising" }),
            /* @__PURE__ */ jsx(Input, { id: "settings-merchandising", name: "merchandising_url", defaultValue: current.merchandising_url ?? "", placeholder: "/collections/regalos" })
          ] })
        ] }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-fit", isLoading: action.isPending, children: "Guardar configuración" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      ExtensionSettingsCard,
      {
        namespace: "extension:gift-cards",
        title: "Entorno y credenciales",
        description: "Interruptor general de la extensión y clave del webhook de SendGrid."
      }
    )
  ] });
};
const config = defineRouteConfig({
  label: "Configuración"
});
const handle = {
  breadcrumb: () => "Configuración"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: GiftCardExperiencePage,
      path: "/gift-card-experience",
      handle: { label: config$2.label, translationNs: config$2.translationNs, ...handle$2 }
    },
    {
      Component: CredentialsPage,
      path: "/gift-card-experience/credenciales",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$1 }
    },
    {
      Component: GiftCardSettingsPage,
      path: "/gift-card-experience/settings",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$2.label,
      icon: config$2.icon,
      path: "/gift-card-experience",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$1.label,
      icon: void 0,
      path: "/gift-card-experience/credenciales",
      nested: void 0,
      rank: 99,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: void 0,
      path: "/gift-card-experience/settings",
      nested: void 0,
      rank: void 0,
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
export {
  plugin as default
};
