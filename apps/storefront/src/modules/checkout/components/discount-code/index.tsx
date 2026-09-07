"use client";

import {
  CheckBadgeIcon,
  GiftIcon,
  TagIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import { useCartStore } from "@lib/stores/cart.store";
import {
  isDisneyGiftDiscountApplied,
  VELEZ_PROMO_CODE,
} from "@lib/util/disney-promo";
import { triggerHaptic } from "@lib/util/haptics";
import { convertToLocale } from "@lib/util/money";
import {
  type DiscountCodeInput,
  discountCodeSchema,
} from "@lib/validation/checkout";
import { zodResolver } from "@lib/util/zod-resolver";
import type { HttpTypes } from "@medusajs/types";
import FormInput from "@modules/common/components/form-input";
import { useRouter } from "next/navigation";
import React from "react";
import { useForm } from "react-hook-form";
import ErrorMessage from "../error-message";

/**
 * Aplica la lista completa de códigos de promoción vía API route tradicional
 * (no server action). Evitamos el server action `applyPromotions` por un bug
 * conocido de Next.js 15 + Turbopack + middleware que produce "An unexpected
 * response was received from the server"
 * (ver vercel/next.js#82937, discussions/87651).
 *
 * Medusa `promo_codes` reemplaza la lista completa en cada request, así que
 * siempre mandamos el array con TODAS las promos manuales que queremos activas.
 */
async function applyCartPromoCodes(codes: string[]): Promise<{
  success: boolean;
  message?: string;
  cart?: any;
}> {
  const res = await fetch("/api/store/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "applyPromotion", codes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    return {
      success: false,
      message:
        data?.message || `Error aplicando el código (status ${res.status})`,
      cart: data?.cart,
    };
  }
  return { success: true, cart: data?.cart };
}

type DiscountCodeProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[];
  };
  onCartUpdate?: (
    cart?: HttpTypes.StoreCart | null,
  ) => Promise<HttpTypes.StoreCart | null>;
};

const DiscountCode: React.FC<DiscountCodeProps> = ({ cart, onCartUpdate }) => {
  const router = useRouter();
  const setStoreCart = useCartStore((s) => s.setCart);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<DiscountCodeInput>({
    resolver: zodResolver(discountCodeSchema),
    mode: "onChange",
    defaultValues: { code: "" },
  });

  // Mantiene el store global del carrito en sync con la respuesta del apply
  // de promo. Sin esto, el cart drawer queda con data stale (precios sin
  // descuento, total $0) hasta el próximo refetch externo.
  const syncCartUpdate = React.useCallback(
    async (freshCart?: HttpTypes.StoreCart | null) => {
      if (freshCart) setStoreCart(freshCart);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
      if (onCartUpdate) await onCartUpdate(freshCart ?? null);
      else router.refresh();
    },
    [onCartUpdate, router, setStoreCart],
  );

  const { promotions = [] } = cart;
  const cartSalesChannelId = (cart as any).sales_channel_id as
    | string
    | undefined;

  // Disney promo removed — stub always returns null/false
  const disneyState = useDisneyPromoState(null, cart.items ?? []);
  const disneyDiscountApplied = isDisneyGiftDiscountApplied(
    cart.items,
    disneyState,
  );
  const visiblePromotions = React.useMemo(
    () => promotions.filter(Boolean),
    [promotions],
  );
  const hasHiddenDiscount =
    (cart.discount_total ?? 0) > 0 && visiblePromotions.length === 0;

  // Nota: la incompatibilidad Velez ⇄ Disney en runtime (cuando Disney se
  // desbloquea con Velez aplicado) la maneja <PromoConflictGuard /> a nivel
  // layout, así también dispara cuando el unlock pasa fuera de /checkout.

  const removePromotionCode = async (code: string) => {
    const remainingCodes = promotions
      .filter(
        (p) => p && p.code !== code && p.code !== undefined && !p.is_automatic,
      )
      .map((p) => p.code!);

    const { success, message, cart: freshCart } =
      await applyCartPromoCodes(remainingCodes);
    if (!success && message) {
      setErrorMessage(message);
      return;
    }
    await syncCartUpdate(freshCart);
  };

  const clearPromotionCodes = async () => {
    const { success, message, cart: freshCart } = await applyCartPromoCodes([]);
    if (!success && message) {
      setErrorMessage(message);
      return;
    }
    await syncCartUpdate(freshCart);
  };

  const addPromotionCode = async (rawCode: string) => {
    setErrorMessage("");

    const code = rawCode.trim();
    if (!code) return;

    // TODO(promotions): regla hardcoded "AROMATIZATUPASION no acumulable".
    // El cupón Velez no debe combinarse con NINGUNA otra promo activa
    // (manuales o automáticas como Mundial / Disney). La regla correcta
    // debería vivir en el back como una `rule` de la propia promotion
    // (workflow de Medusa / admin), para que comercial pueda configurar
    // exclusividades sin tocar el storefront. Migrar cuando se defina el
    // modelo de exclusividad en admin.
    if (code.toUpperCase() === VELEZ_PROMO_CODE) {
      const hasOtherActivePromo =
        promotions.some((p) => p?.code && p.code !== VELEZ_PROMO_CODE) ||
        disneyDiscountApplied;
      if (hasOtherActivePromo) {
        setErrorMessage(
          "Este cupón no es acumulable con otras promociones activas en tu carrito.",
        );
        reset();
        return;
      }
    }

    // Pre-chequeo NO bloqueante: solo usado para detectar sales channel incompatible.
    try {
      const res = await fetch(
        `/api/store/promotions/by-code?code=${encodeURIComponent(code)}`,
      );
      const data = await res.json().catch(() => null);

      if (data?.success && data?.promotion) {
        const channelRules: any[] = (data.promotion.rules || []).filter(
          (r: any) => r.attribute === "sales_channel_id",
        );

        if (channelRules.length > 0 && cartSalesChannelId) {
          const channelOk = channelRules.every((rule: any) => {
            const values: string[] = (rule.values || []).map(
              (v: any) => v.value ?? v,
            );
            if (rule.operator === "ne")
              return !values.includes(cartSalesChannelId);
            return values.includes(cartSalesChannelId);
          });

          if (!channelOk) {
            setErrorMessage(
              "Este código de descuento no está disponible para esta tienda.",
            );
            reset();
            return;
          }
        }
      }
    } catch (e) {
      console.warn(
        "[discount-code] pre-validation failed, deferring to Medusa",
        e,
      );
    }

    const codes = promotions
      .filter((p) => p && p.code !== undefined && !p.is_automatic)
      .map((p) => p.code!);
    codes.push(code);

    const {
      success,
      message,
      cart: freshCart,
    } = await applyCartPromoCodes(codes);

    if (!success) {
      const msg = message || "";
      const isGeneric =
        !msg ||
        msg.toLowerCase().includes("unexpected") ||
        msg.toLowerCase().includes("setting up");
      setErrorMessage(
        isGeneric
          ? "El código ingresado no es válido o no existe. Por favor, verificá que sea correcto o probá con otro."
          : msg,
      );
    } else {
      await syncCartUpdate(freshCart);
    }

    reset();
  };

  const onApply = async ({ code }: DiscountCodeInput) => {
    if (isSubmitting) return;

    triggerHaptic("medium");
    setIsSubmitting(true);

    try {
      await addPromotionCode(code);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canApplyPromotion = isValid && !isSubmitting;

  return (
    <div className="w-full" data-testid="benefits-discount-card">
        <form className="w-full" noValidate onSubmit={handleSubmit(onApply)}>
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-stretch sm:gap-3">
            <FormInput
              autoComplete="off"
              className="min-w-0 flex-1"
              data-testid="discount-input"
              icon={<GiftIcon aria-hidden className="h-5 w-5" />}
              id="promotion-input"
              label="Código de descuento"
              placeholder="Ej: BIENVENIDO10"
              {...register("code")}
            />
            <button
              className={`!h-[42px] !w-full shrink-0 rounded-lg px-5 text-sm font-medium text-white shadow-none transition-colors focus:ring-gray-400 sm:!w-auto sm:min-w-[100px] ${
                canApplyPromotion
                  ? "bg-[var(--primary-color)] hover:opacity-90"
                  : "cursor-not-allowed bg-[#A0A4A8]"
              }`}
              data-testid="discount-apply-button"
              disabled={!canApplyPromotion}
              type="submit"
            >
              {isSubmitting ? "Procesando..." : "Aplicar"}
            </button>
          </div>

          <div className="mt-2">
            <ErrorMessage
              data-testid="discount-error-message"
              error={errorMessage}
            />
          </div>
        </form>

        {(visiblePromotions.length > 0 || hasHiddenDiscount) && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="mb-3 flex items-center gap-1.5">
              <CheckBadgeIcon className="h-4 w-4 text-emerald-600" />
              <h4 className="font-semibold text-gray-900 text-sm">
                Promociones aplicadas
              </h4>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 font-semibold text-[11px] text-emerald-700">
                {hasHiddenDiscount ? 1 : visiblePromotions.length}
              </span>
            </div>

            <ul className="flex flex-col gap-2">
              {hasHiddenDiscount && (
                <li
                  className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300"
                  data-testid="discount-row"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <GiftIcon className="h-4 w-4" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className="truncate font-semibold text-gray-900 text-sm"
                      data-testid="discount-code"
                    >
                      Cupón aplicado
                    </span>
                    <span className="text-xs text-gray-500">
                      No se pudo leer el código desde Medusa.
                    </span>
                  </div>

                  <button
                    aria-label="Quitar cupón aplicado"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    data-testid="remove-discount-button"
                    onClick={clearPromotionCodes}
                    type="button"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              )}
              {visiblePromotions.map((promotion) => {
                const isAutomatic = Boolean(promotion.is_automatic);
                const applicationMethod = promotion.application_method;
                const hasValue =
                  applicationMethod?.value !== undefined &&
                  applicationMethod?.value !== null;
                const formattedValue = hasValue
                  ? applicationMethod.type === "percentage"
                    ? `${applicationMethod.value}%`
                    : applicationMethod.currency_code
                      ? `$ ${convertToLocale({
                          amount:
                            typeof applicationMethod.value === "string"
                              ? Number.parseFloat(applicationMethod.value)
                              : (applicationMethod.value as number),
                          currency_code: applicationMethod.currency_code,
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                          locale: "es-AR",
                        })}`
                      : null
                  : null;

                return (
                  <li
                    className={`group flex items-center gap-3 rounded-xl border p-3 transition ${
                      isAutomatic
                        ? "border-emerald-100 bg-emerald-50/60"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                    data-testid="discount-row"
                    key={promotion.id}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isAutomatic
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      }`}
                    >
                      <GiftIcon className="h-4 w-4" />
                    </span>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="truncate font-semibold text-gray-900 text-sm"
                          data-testid="discount-code"
                        >
                          {promotion.code}
                        </span>
                        {isAutomatic && (
                          <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            Automática
                          </span>
                        )}
                      </div>
                      {formattedValue && (
                        <span className="text-xs font-semibold text-emerald-600">
                          -{formattedValue}
                        </span>
                      )}
                    </div>

                    {!isAutomatic && (
                      <button
                        aria-label={`Quitar cupón ${promotion.code}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        data-testid="remove-discount-button"
                        onClick={() => {
                          if (!promotion.code) return;
                          removePromotionCode(promotion.code);
                        }}
                        type="button"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
    </div>
  );
};

export default DiscountCode;
