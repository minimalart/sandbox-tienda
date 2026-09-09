"use client";

import { addCompanyAddress, type CompanyAddress } from "@lib/data/company";
import type { CreditAccountSummary } from "@lib/data/company-credit";
import { isCuentaCorriente, paymentInfoMap } from "@lib/constants";
import { convertToLocale } from "@lib/util/money";
import { goToCheckoutStep } from "@lib/util/checkout-step";
import { useDemoHref } from "@lib/site-config/context";
import { cn } from "@/lib/utils";
import CartTotals from "@modules/common/components/cart-totals";
import CheckoutStep from "@modules/checkout/components/checkout-step";
import AddressFormWithMap, {
  type AddressFormData,
} from "@modules/common/components/address-form-with-map";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import type { HttpTypes } from "@medusajs/types";
import {
  Building2,
  CreditCard,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Tag,
  Truck,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCheckoutPolicy, checkoutRequest } from '@lib/hooks/use-checkout-policy';
import Recipients from '@modules/checkout/components/recipients';

type ShippingOption = { id: string; name: string; amount?: number };
type Provider = { id: string; is_enabled?: boolean };

type Props = {
  cart: HttpTypes.StoreCart;
  email: string;
  userName: string;
  companyName: string;
  addresses: CompanyAddress[];
  countryCode: string;
  googleMapsApiKey: string;
  credit: CreditAccountSummary | null;
};

const STEP_ORDER = ["personal", "address", "delivery", "benefits", "payment"] as const;

/** Acciones del carrito/checkout B2B vía route handler /api (no server action). */
async function cartAction(body: Record<string, unknown>): Promise<any> {
  try {
    const res = await fetch("/api/b2b/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

type SelectedAddr =
  | { source: "company"; a: CompanyAddress }
  | { source: "new"; data: AddressFormData };

/**
 * Payload de dirección para el carrito B2B. La UI no pide nombre/apellido (son
 * datos de la empresa): se completan por detrás con el nombre de la empresa o
 * el contacto de la dirección guardada.
 */
function buildAddressPayload(
  sel: SelectedAddr,
  companyName: string,
  countryCode: string,
) {
  if (sel.source === "company") {
    const a = sel.a;
    const [firstName, ...rest] = (a.contact_name || companyName).trim().split(" ");
    return {
      first_name: firstName || companyName,
      last_name: rest.join(" ") || "-",
      company: companyName,
      address_1: a.address_line_1,
      address_2: a.address_line_2 || undefined,
      city: a.city,
      province: a.province || undefined,
      postal_code: a.postal_code,
      country_code: countryCode,
      phone: a.phone || undefined,
    };
  }
  const d = sel.data;
  return {
    first_name: d.firstName || companyName,
    last_name: d.lastName || "-",
    company: companyName,
    address_1: d.address1,
    address_2: d.address2 || undefined,
    city: d.city,
    province: d.province || undefined,
    postal_code: d.postalCode,
    country_code: d.countryCode || countryCode,
    phone: d.phone || undefined,
  };
}

export default function B2BCheckoutFlow({
  cart,
  email,
  userName,
  companyName,
  addresses,
  countryCode,
  googleMapsApiKey,
  credit,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoHref = useDemoHref();
  const checkout = useCheckoutPolicy(cart);

  const items = cart.items ?? [];
  const currencyCode = cart.currency_code ?? "ars";
  const fmt = (n?: number | null) =>
    "$ " +
    convertToLocale({
      amount: Number(n ?? 0),
      currency_code: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      locale: "es-AR",
    });

  // ── Estado de completitud, derivado del carrito ────────────────────────────
  const addressComplete = (checkout.state?.configured && !checkout.state.flow.address_required) || !!cart.shipping_address?.address_1;
  const deliveryComplete = checkout.state?.configured ? !!checkout.state.flow.blocks.find(b => b.id === 'delivery')?.complete : (cart.shipping_methods?.length ?? 0) > 0;
  const paymentSessions =
    (cart.payment_collection as { payment_sessions?: Array<{ status?: string; provider_id?: string }> } | null)
      ?.payment_sessions ?? [];
  const activeSession = paymentSessions.find((s) => s.status === "pending");
  const paymentComplete = !!activeSession;

  const recipientsComplete = !checkout.state?.configured || checkout.state.recipients_complete;
  const allStepsComplete = !checkout.loading && !checkout.error && (!checkout.state?.configured || checkout.state.flow.ready) && addressComplete && deliveryComplete && recipientsComplete && (paymentComplete || Number(cart.total) === 0);

  // ── Navegación por pasos (?step=) ──────────────────────────────────────────
  const stepAllowed = (s: string): boolean => {
    if (s === "personal" || s === "address") return true;
    if (s === "delivery") return addressComplete;
    if (s === 'payment' && !recipientsComplete) return false;
    return deliveryComplete; // benefits + payment
  };
  const defaultStep = !addressComplete
    ? "address"
    : !deliveryComplete
      ? "delivery"
      : !recipientsComplete ? 'recipients' : "payment";
  const rawStep = (searchParams.get("step") ?? "").replace(/^edit-/, "");
  const visible = (id: string) => !checkout.state?.configured || (id === 'payment' ? Number(cart.total) !== 0 : !!checkout.state.flow.blocks.find(b => b.id === id)?.visible) || searchParams.get('step') === 'edit-' + id;
  const visibleOrder = checkout.state?.configured ? checkout.state.flow.blocks.filter(b => visible(b.id)).map(b => b.id) : [...STEP_ORDER];
  const firstIncomplete = checkout.state?.configured ? checkout.state.flow.blocks.find(b => b.applicable && !b.complete && b.id !== 'payment') : null;
  const currentStep = firstIncomplete && (!rawStep || checkout.state!.flow.blocks.findIndex(b => b.id === firstIncomplete.id) < checkout.state!.flow.blocks.findIndex(b => b.id === rawStep))
    ? firstIncomplete.id
    : rawStep && visibleOrder.includes(rawStep) && stepAllowed(rawStep)
      ? rawStep
      : firstIncomplete?.id ?? (visibleOrder.includes(defaultStep) ? defaultStep : visibleOrder.at(-1) ?? 'personal');
  const goToStep = (s: string) => goToCheckoutStep(s);
  useEffect(() => { if (checkout.state?.cart_changed) router.refresh(); }, [checkout.state, router]);

  // ── Estado local de UI ─────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dirección — se elige entre las direcciones de la empresa o se agrega una
  // nueva vía modal (mismo patrón que el checkout B2C). Sin campos de nombre.
  const [selectedAddr, setSelectedAddr] = useState<SelectedAddr | null>(
    addresses[0] ? { source: "company", a: addresses[0] } : null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  // Envío
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[] | null>(null);

  // Pago
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    activeSession?.provider_id ?? null,
  );

  // Cargar opciones de envío al entrar al paso (o cuando ya hay dirección).
  useEffect(() => {
    if (currentStep === "delivery" && addressComplete && shippingOptions === null) {
      (async () => {
        setBusy(true);
        const opts = ((await cartAction({ action: "shipping-options" })).options ?? []) as ShippingOption[];
        setShippingOptions(opts);
        setBusy(false);
      })();
    }
  }, [currentStep, addressComplete, shippingOptions]);

  // Cargar métodos de pago al entrar al paso.
  useEffect(() => {
    if (currentStep === "payment" && deliveryComplete && providers === null) {
      (async () => {
        setBusy(true);
        const list = ((await cartAction({ action: "payment-providers" })).providers ?? []) as Provider[];
        setProviders(list);
        setBusy(false);
      })();
    }
  }, [currentStep, deliveryComplete, providers]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  // Al confirmar en el modal: guardamos la nueva dirección como seleccionada
  // (todavía no se commitea al carrito; eso pasa en "Continuar con el envío").
  const onModalSubmit = async (data: AddressFormData) => {
    setSelectedAddr({ source: "new", data });
    setModalOpen(false);
  };

  const continueWithAddress = async () => {
    if (!selectedAddr) {
      setError("Seleccioná o agregá una dirección de envío.");
      return;
    }
    setBusy(true);
    setError(null);
    const r = await cartAction({
      action: "address",
      address: buildAddressPayload(selectedAddr, companyName, countryCode),
      email,
    });
    if (!r.ok) {
      setError(r.error);
      setBusy(false);
      return;
    }
    // Si es una dirección nueva (tipeada en el mapa), guardarla también como
    // dirección de la empresa para que quede disponible a futuro y se vea en
    // "Mi empresa" / backoffice. Best-effort: si el usuario no es owner/admin
    // (o falla), no bloquea el checkout.
    if (selectedAddr.source === "new") {
      const d = selectedAddr.data;
      void addCompanyAddress({
        label: d.addressName || d.address1,
        contact_name: [d.firstName, d.lastName].filter(Boolean).join(" ").trim() || undefined,
        address_line_1: d.address1,
        address_line_2: d.address2 || undefined,
        city: d.city,
        province: d.province,
        postal_code: d.postalCode,
        phone: d.phone || undefined,
        lat: d.latitude != null ? String(d.latitude) : undefined,
        lng: d.longitude != null ? String(d.longitude) : undefined,
      });
    }
    // Recalcular envíos para la dirección elegida.
    const opts = ((await cartAction({ action: "shipping-options" })).options ?? []) as ShippingOption[];
    setShippingOptions(opts);
    setBusy(false);
    router.refresh();
    goToStep("delivery");
  };

  const pickShipping = async (id: string) => {
    setBusy(true);
    setError(null);
    const r = await cartAction({ action: "set-shipping", optionId: id });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  };

  const pickProvider = async (id: string) => {
    if (!recipientsComplete) { goToStep('recipients'); return; }
    setSelectedProvider(id);
    setBusy(true);
    setError(null);
    const r = await cartAction({ action: "init-payment", providerId: id });
    setBusy(false);
    if (!r.ok) {
      setError(r.error || "No se pudo seleccionar el medio de pago.");
      return;
    }
    router.refresh();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (checkout.state?.configured) await checkoutRequest({ action: 'prepare', revision: checkout.state.revision });
      const r = await cartAction({ action: "place-order" });
      if (!r.ok) {
        setError(r.error || "No se pudo finalizar la compra.");
        setBusy(false);
        return;
      }
      window.location.assign(demoHref("/b2b/pedidos?ok=1"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo finalizar la compra.");
      setBusy(false);
    }
  };

  // ── Cuenta corriente: saldo + gate ──────────────────────────────────────────
  const total = cart.total ?? 0;
  const creditActive = credit?.status === "active";
  const availableCredit = credit?.available_credit ?? 0;
  const creditSufficient = creditActive && total <= availableCredit;
  const selectedIsCredit = isCuentaCorriente(selectedProvider ?? undefined);
  const creditGateOk = !selectedIsCredit || creditSufficient;

  const promotions =
    (cart as HttpTypes.StoreCart & { promotions?: HttpTypes.StorePromotion[] }).promotions ?? [];

  const stepIndex = (s: string) => Math.max(1, visibleOrder.indexOf(s) + 1);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-3">
        {checkout.error && <p role="alert" className="text-sm text-red-700">{checkout.error}<button type="button" onClick={() => checkout.refresh()}>Volver a intentar</button></p>}
        {/* 1 — Datos personales (solo lectura) */}
        {visible("personal") && <CheckoutStep
          stepNumber={stepIndex("personal")}
          title="Datos personales"
          icon={<User />}
          isOpen={currentStep === "personal"}
          isCompleted
          completedSummary={`${companyName} · ${email}`}
          onEdit={() => goToStep("personal")}
        >
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="font-medium text-foreground">{companyName || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Usuario</p>
                <p className="font-medium text-foreground">{userName || email || "—"}</p>
                {userName && email ? <p className="text-xs text-muted-foreground">{email}</p> : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              La compra se registra a nombre de la empresa. Estos datos no son editables acá.
            </p>
            <button
              type="button"
              onClick={() => goToStep(addressComplete ? "delivery" : "address")}
              className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-[--primary-color] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Continuar
            </button>
          </div>
        </CheckoutStep>}

        {/* 2 — Datos de envío */}
        {visible("address") && <CheckoutStep
          stepNumber={stepIndex("address")}
          title="Datos de envío"
          icon={<MapPin />}
          isOpen={currentStep === "address"}
          isCompleted={addressComplete}
          completedSummary={
            cart.shipping_address
              ? `${cart.shipping_address.address_1}, ${cart.shipping_address.city}`
              : undefined
          }
          onEdit={() => goToStep("address")}
        >
          <div>
            {addresses.length > 0 ? (
              <div className="mb-4">
                <p className="mb-3 text-sm text-muted-foreground">Elegí una dirección de la empresa</p>
                <div className="flex flex-col gap-3">
                  {addresses.map((a) => {
                    const active = selectedAddr?.source === "company" && selectedAddr.a.id === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAddr({ source: "company", a })}
                        className={cn(
                          "flex w-full items-start rounded-xl border-2 p-4 text-left transition-all",
                          active
                            ? "border-[--primary-color] bg-[--primary-soft-bg]"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[--text-dark] text-sm">{a.label || a.address_line_1}</p>
                          <div className="mt-1 space-y-0.5 text-[--label-color] text-sm">
                            <p>
                              {a.address_line_1}
                              {a.address_line_2 ? `, ${a.address_line_2}` : ""}
                            </p>
                            <p>
                              {a.postal_code}, {a.city}
                            </p>
                            {a.province ? <p>{a.province}</p> : null}
                          </div>
                          {a.phone ? <p className="mt-1 text-[--icon-muted] text-xs">{a.phone}</p> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Dirección nueva agregada por el modal (aún no guardada en la empresa) */}
            {selectedAddr?.source === "new" ? (
              <div className="mb-4 w-full rounded-xl border-2 border-[--primary-color] bg-[--primary-soft-bg] p-4">
                <p className="font-semibold text-[--text-dark] text-sm">
                  {selectedAddr.data.addressName || "Nueva dirección"}
                </p>
                <p className="text-[--label-color] text-sm">
                  {selectedAddr.data.address1}
                  {selectedAddr.data.address2 ? `, ${selectedAddr.data.address2}` : ""}
                </p>
                <p className="text-[--label-color] text-sm">
                  {selectedAddr.data.postalCode}, {selectedAddr.data.city}
                </p>
                {selectedAddr.data.phone ? (
                  <p className="mt-1 text-[--icon-muted] text-xs">{selectedAddr.data.phone}</p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-4 text-sm font-medium text-[--primary-color] transition-colors hover:border-[--primary-color] hover:bg-green-50/30"
            >
              <Plus className="size-5" />
              Agregar dirección
            </button>

            <button
              type="button"
              onClick={continueWithAddress}
              disabled={busy || !selectedAddr}
              className="mt-6 w-full rounded-lg bg-[--primary-color] px-4 py-3 text-base font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Procesando…" : "Continuar con el envío"}
            </button>
            {error && currentStep === "address" ? (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            ) : null}
          </div>
        </CheckoutStep>}

        {/* 3 — Tipo de envío */}
        {visible("delivery") && <CheckoutStep
          stepNumber={stepIndex("delivery")}
          title="Tipo de envío"
          icon={<Truck />}
          isOpen={currentStep === "delivery"}
          isCompleted={deliveryComplete}
          completedSummary={cart.shipping_methods?.[0]?.name ?? undefined}
          onEdit={() => goToStep("delivery")}
        >
          <div className="space-y-2">
            {busy && shippingOptions === null ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (shippingOptions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay métodos de envío disponibles para esta dirección.
              </p>
            ) : (
              (shippingOptions ?? []).map((o) => {
                const selected = cart.shipping_methods?.some(
                  (m) => (m as { shipping_option_id?: string }).shipping_option_id === o.id,
                );
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={busy}
                    onClick={() => pickShipping(o.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60",
                      selected ? "border-[--primary-color] bg-[--primary-soft-bg]" : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      {o.name}
                    </span>
                    <span className="tabular-nums text-foreground">{fmt(o.amount)}</span>
                  </button>
                );
              })
            )}
            {deliveryComplete ? (
              <button
                type="button"
                onClick={() => goToStep("benefits")}
                className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-[--primary-color] px-4 text-sm font-medium text-white hover:opacity-90"
              >
                Continuar
              </button>
            ) : null}
          </div>
        </CheckoutStep>}

        {checkout.state?.configured && visible('billing') && <CheckoutStep stepNumber={stepIndex('billing')} title="Facturación" icon={<Building2 />} isOpen={currentStep === 'billing'} isCompleted={!!checkout.state.flow.blocks.find(b => b.id === 'billing')?.complete} onEdit={() => goToStep('billing')}>
          <p className="text-sm">La facturación utiliza los datos de tu empresa. Revisalos antes de continuar.</p>
          <LocalizedClientLink href="/b2b/empresa" className="text-sm underline">Revisar datos de facturación</LocalizedClientLink>
        </CheckoutStep>}
        {/* 4 — Beneficios (códigos de promoción) */}
        {checkout.state?.configured && checkout.state.policy.recipients.enabled && <CheckoutStep stepNumber={stepIndex('recipients')} title={checkout.state.policy.recipients.title} icon={<User />} isOpen={currentStep === 'recipients'} isCompleted={recipientsComplete} onEdit={() => goToStep('recipients')}>
          <Recipients state={checkout.state} items={items} onSaved={checkout.setState} onContinue={() => goToStep('benefits')} />
        </CheckoutStep>}
        {visible("benefits") && <CheckoutStep
          stepNumber={stepIndex("benefits")}
          title="Beneficios"
          icon={<Tag />}
          isOpen={currentStep === "benefits"}
          isCompleted={deliveryComplete}
          onEdit={() => goToStep("benefits")}
        >
          <div className="space-y-3">
            <B2BDiscountCode
              codes={promotions.filter((p) => p?.code && !p.is_automatic).map((p) => p.code!)}
              onApplied={() => router.refresh()}
            />
            {promotions.filter((p) => p?.code).length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {promotions
                  .filter((p) => p?.code)
                  .map((p) => (
                    <li
                      key={p.id ?? p.code}
                      className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      <Tag className="size-3.5" />
                      {p.code}
                    </li>
                  ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={() => goToStep("payment")}
              className="mt-1 inline-flex h-10 items-center justify-center rounded-lg bg-[--primary-color] px-4 text-sm font-medium text-white hover:opacity-90"
            >
              Continuar
            </button>
          </div>
        </CheckoutStep>}

        {/* 5 — Forma de pago */}
        {visible("payment") && <CheckoutStep
          stepNumber={stepIndex("payment")}
          title="Forma de pago"
          icon={<CreditCard />}
          isOpen={currentStep === "payment"}
          isCompleted={paymentComplete}
          completedSummary={
            selectedProvider ? paymentInfoMap[selectedProvider]?.title ?? selectedProvider : undefined
          }
          onEdit={() => goToStep("payment")}
        >
          <div className="space-y-2">
            {busy && providers === null ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (providers ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay medios de pago configurados para este canal.
              </p>
            ) : (
              (providers ?? []).map((p) => {
                const info = paymentInfoMap[p.id];
                const isCredit = isCuentaCorriente(p.id);
                const disabled = busy || (isCredit && !creditSufficient);
                const selected = selectedProvider === p.id;
                return (
                  <div key={p.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => pickProvider(p.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-60",
                        selected ? "border-[--primary-color] bg-[--primary-soft-bg]" : "border-border hover:bg-muted",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground [&_svg]:size-4">
                          {info?.icon ?? <CreditCard className="size-4" />}
                        </span>
                        {info?.title ?? p.id}
                      </span>
                      {selected ? <span className="text-xs font-medium text-[--primary-color]">Seleccionado</span> : null}
                    </button>

                    {/* Cuenta corriente: saldo disponible + gate por saldo */}
                    {isCredit ? (
                      <div className="mt-1.5 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                        {credit ? (
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-muted-foreground">Límite</p>
                              <p className="font-semibold tabular-nums text-foreground">{fmt(credit.credit_limit)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Utilizado</p>
                              <p className="font-semibold tabular-nums text-foreground">{fmt(credit.current_balance)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Disponible</p>
                              <p
                                className={cn(
                                  "font-semibold tabular-nums",
                                  creditSufficient ? "text-emerald-600" : "text-destructive",
                                )}
                              >
                                {fmt(credit.available_credit)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">La empresa no tiene cuenta corriente habilitada.</p>
                        )}
                        {credit && !creditActive ? (
                          <p className="mt-2 text-destructive">La cuenta corriente no está activa.</p>
                        ) : credit && !creditSufficient ? (
                          <p className="mt-2 text-destructive">
                            El total ({fmt(total)}) supera el crédito disponible.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </CheckoutStep>}
      </div>

      {/* Resumen — estilo B2C (impuestos incluidos) */}
      <aside className="shrink-0 lg:w-96">
        <div className="rounded-xl border border-transparent bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-[--text-dark]">
              Mi pedido ({items.length} ítem{items.length === 1 ? "" : "s"})
            </h3>
            {/* Editar = volver al armador de pedido (precargado con el carrito
                actual), no editar inline. Ahí se agregan/quitan productos. */}
            <LocalizedClientLink
              href="/b2b/pedidos/nuevo"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="size-4" />
              Editar pedido
            </LocalizedClientLink>
          </div>

          <div className="mt-3 space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[--text-dark]">{it.product_title ?? it.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.quantity} × {fmt(it.unit_price)}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums text-[--text-dark]">
                  {fmt((it.unit_price ?? 0) * it.quantity)}
                </span>
              </div>
            ))}
          </div>

          {checkout.state?.configured && <div className="my-3 space-y-2 border-t pt-3 text-sm" aria-label="Revisión de la compra">
            <p>{email}</p>
            {checkout.state.flow.blocks.filter(b => b.applicable && ['personal', 'address', 'delivery', 'recipients', 'payment'].includes(b.id)).map(b => <button key={b.id} type="button" className="mr-3 underline" onClick={() => goToStep('edit-' + b.id)}>Editar {{personal: 'contacto', address: 'dirección', delivery: 'entrega', recipients: 'destinatarios', payment: 'pago'}[b.id]}</button>)}
            {checkout.state.policy.recipients.enabled && <p>{checkout.state.units.length} unidades · {checkout.state.people.length} destinatarios</p>}
          </div>}
          <CartTotals
            totals={{
              total: cart.total,
              subtotal: cart.subtotal,
              tax_total: cart.tax_total,
              shipping_total: cart.shipping_total,
              shipping_subtotal: (cart as { shipping_subtotal?: number }).shipping_subtotal,
              discount_total: cart.discount_total,
              gift_card_total: (cart as { gift_card_total?: number }).gift_card_total,
              currency_code: currencyCode,
            }}
            promotions={promotions}
          />

          <button
            type="button"
            onClick={confirm}
            disabled={!allStepsComplete || busy || !creditGateOk}
            className={cn(
              "mt-4 flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-white transition-colors",
              !allStepsComplete || busy || !creditGateOk
                ? "cursor-not-allowed bg-[#A0A4A8]"
                : "bg-[--primary-color] hover:opacity-90",
            )}
          >
            {busy && allStepsComplete ? "Procesando…" : "Confirmar pedido"}
          </button>

          {!allStepsComplete ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {!addressComplete
                ? "Completá los datos de envío para continuar."
                : !deliveryComplete
                  ? "Elegí un tipo de envío."
                  : "Elegí una forma de pago."}
            </p>
          ) : !creditGateOk ? (
            <p className="mt-2 text-center text-xs text-destructive">
              El total supera el crédito disponible de la cuenta corriente.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
        </div>
      </aside>

      {/* Modal para agregar una dirección (sin campos de nombre) */}
      <Dialog
        className="relative z-[10000]"
        onClose={() => {
          if (!busy) setModalOpen(false);
        }}
        open={modalOpen}
      >
        <DialogBackdrop
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in"
          transition
        />
        <div className="fixed inset-0 z-[10000] w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-0 text-center sm:items-center sm:p-4">
            <DialogPanel
              className="relative w-full max-w-none transform rounded-t-2xl bg-white px-4 pt-5 pb-6 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-leave:duration-200 data-enter:ease-out data-leave:ease-in sm:my-8 sm:w-full sm:max-w-2xl sm:rounded-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
              transition
            >
              <DialogTitle as="h3" className="mb-4 text-center font-semibold text-gray-900 text-lg">
                Agregar dirección de envío
              </DialogTitle>
              <AddressFormWithMap
                googleMapsApiKey={googleMapsApiKey}
                hideNameFields
                initialData={{ countryCode }}
                isLoading={busy}
                onCancel={() => setModalOpen(false)}
                onSubmit={onModalSubmit}
                submitLabel="Usar esta dirección"
              />
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/** Input de código de promoción para el carrito B2B (acción `promotion`). */
function B2BDiscountCode({
  codes,
  onApplied,
}: {
  codes: string[];
  onApplied: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    const code = value.trim();
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    const next = Array.from(new Set([...codes, code]));
    const r = await cartAction({ action: "promotion", codes: next });
    setBusy(false);
    if (!r.ok) {
      setError("No se pudo aplicar el código. Verificá que sea correcto.");
      return;
    }
    setValue("");
    onApplied();
  };

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-stretch sm:gap-3">
        <div className="relative min-w-0 flex-1">
          <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                apply();
              }
            }}
            placeholder="Código de descuento"
            autoComplete="off"
            className="h-[42px] w-full rounded-lg border border-input pl-9 pr-3 text-sm outline-none focus:border-[--primary-color]"
          />
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={busy || !value.trim()}
          className={cn(
            "h-[42px] shrink-0 rounded-lg px-5 text-sm font-medium text-white transition-colors sm:min-w-[100px]",
            busy || !value.trim() ? "cursor-not-allowed bg-[#A0A4A8]" : "bg-[--primary-color] hover:opacity-90",
          )}
        >
          {busy ? "Aplicando…" : "Aplicar"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
