'use client';

import { CheckBadgeIcon, CreditCardIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useCartStore } from '@lib/stores/cart.store';
import { triggerHaptic } from '@lib/util/haptics';
import { convertToLocale } from '@lib/util/money';
import { type GiftCardCodeInput, giftCardCodeSchema } from '@lib/validation/checkout';
import { zodResolver } from '@lib/util/zod-resolver';
import type { HttpTypes } from '@medusajs/types';
import FormInput from '@modules/common/components/form-input';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useForm } from 'react-hook-form';
import ErrorMessage from '../error-message';

type AppliedGiftCard = {
  id?: string;
  masked_code?: string | null;
  amount?: number | null;
};

type WalletBalance = {
  balance: number;
  currency_code: string;
};

/**
 * Lee las gift cards aplicadas al carrito. El loyalty-plugin las expone como
 * `credit_lines` con `reference === "gift-card"` (o, según versión, un array
 * `gift_cards`). Leemos ambos de forma defensiva.
 */
function readAppliedGiftCards(cart: HttpTypes.StoreCart): AppliedGiftCard[] {
  const raw = cart as unknown as {
    gift_cards?: AppliedGiftCard[];
    credit_lines?: Array<{
      id?: string;
      amount?: number | null;
      reference?: string | null;
      reference_id?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
  };

  if (Array.isArray(raw.gift_cards) && raw.gift_cards.length > 0) {
    return raw.gift_cards;
  }

  if (Array.isArray(raw.credit_lines)) {
    return raw.credit_lines
      .filter((line) => line.reference === 'gift-card')
      .map((line) => ({
        id: line.id,
        masked_code: (line.metadata?.masked_code as string | undefined) ?? null,
        amount: line.amount ?? null,
      }));
  }

  return [];
}

function readAppliedStoreCredit(cart: HttpTypes.StoreCart): number {
  const raw = cart as unknown as {
    credit_lines?: Array<{
      amount?: number | null;
      reference?: string | null;
    }>;
  };

  return (raw.credit_lines ?? [])
    .filter((line) => line.reference === 'store-credit')
    .reduce((total, line) => total + Number(line.amount ?? 0), 0);
}

async function postCartGiftCard(
  action: 'applyGiftCard' | 'removeGiftCard',
  value: string
): Promise<{
  success: boolean;
  message?: string;
  cart?: HttpTypes.StoreCart | null;
}> {
  const res = await fetch('/api/store/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action === 'applyGiftCard' ? { action, code: value } : { action, applicationId: value }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    return {
      success: false,
      message: data?.message || `Error procesando la tarjeta (status ${res.status})`,
      cart: data?.cart ?? null,
    };
  }
  return { success: true, cart: data?.cart ?? null };
}

async function postCartStoreCredit(action: 'applyStoreCredit'): Promise<{
  success: boolean;
  message?: string;
  cart?: HttpTypes.StoreCart | null;
}> {
  const res = await fetch('/api/store/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    return {
      success: false,
      message: data?.message || 'No se pudo actualizar el saldo aplicado.',
      cart: data?.cart ?? null,
    };
  }
  return { success: true, cart: data?.cart ?? null };
}

type GiftCardCodeProps = {
  cart: HttpTypes.StoreCart;
  onCartUpdate?: (cart?: HttpTypes.StoreCart | null) => Promise<HttpTypes.StoreCart | null>;
};

const GiftCardCode: React.FC<GiftCardCodeProps> = ({ cart, onCartUpdate }) => {
  const router = useRouter();
  const setStoreCart = useCartStore((s) => s.setCart);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isStoreCreditSubmitting, setIsStoreCreditSubmitting] = React.useState(false);
  const [removingCode, setRemovingCode] = React.useState<string | null>(null);
  const [availableBalance, setAvailableBalance] = React.useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<GiftCardCodeInput>({
    resolver: zodResolver(giftCardCodeSchema),
    mode: 'onChange',
    defaultValues: { code: '' },
  });

  const appliedGiftCards = readAppliedGiftCards(cart);
  const giftCardTotal = (cart as { gift_card_total?: number | null }).gift_card_total;
  const currencyCode = cart.currency_code ?? 'ARS';
  const appliedStoreCredit = readAppliedStoreCredit(cart);

  const formatAmount = (amount: number) =>
    `$ ${convertToLocale({
      amount,
      currency_code: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      locale: 'es-AR',
    })}`;

  React.useEffect(() => {
    let active = true;
    void fetch('/api/store/gift-cards', { cache: 'no-store' })
      .then(async (response) =>
        response.ok ? ((await response.json()) as { accounts?: WalletBalance[] }) : null
      )
      .then((payload) => {
        if (!active || !payload) return;
        const wallet = payload.accounts?.find(
          (account) => account.currency_code.toLowerCase() === currencyCode.toLowerCase()
        );
        setAvailableBalance(wallet ? Number(wallet.balance) : null);
      })
      .catch(() => {
        if (active) setAvailableBalance(null);
      });
    return () => {
      active = false;
    };
  }, [currencyCode]);

  const syncCartUpdate = React.useCallback(
    async (freshCart?: HttpTypes.StoreCart | null) => {
      if (freshCart) setStoreCart(freshCart);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cart-updated'));
      }
      if (onCartUpdate) await onCartUpdate(freshCart ?? null);
      else router.refresh();
    },
    [onCartUpdate, router, setStoreCart]
  );

  const onApply = async ({ code }: GiftCardCodeInput) => {
    if (isSubmitting) return;
    triggerHaptic('medium');
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const {
        success,
        message,
        cart: freshCart,
      } = await postCartGiftCard('applyGiftCard', code.trim());
      if (!success) {
        setErrorMessage(message || 'El código de tarjeta de regalo no es válido o ya fue usado.');
        return;
      }
      reset();
      await syncCartUpdate(freshCart);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeGiftCardCode = async (applicationId: string) => {
    setErrorMessage('');
    setRemovingCode(applicationId);
    try {
      const { success, message, cart: freshCart } = await postCartGiftCard('removeGiftCard', applicationId);
      if (!success) {
        setErrorMessage(message || 'No se pudo quitar la tarjeta de regalo.');
        return;
      }
      await syncCartUpdate(freshCart);
    } finally {
      setRemovingCode(null);
    }
  };

  const toggleStoreCredit = async () => {
    if (isStoreCreditSubmitting) return;
    triggerHaptic('medium');
    setErrorMessage('');
    setIsStoreCreditSubmitting(true);
    try {
      const result = await postCartStoreCredit('applyStoreCredit');
      if (!result.success) {
        setErrorMessage(result.message || 'No se pudo aplicar el saldo.');
        return;
      }
      await syncCartUpdate(result.cart);
    } finally {
      setIsStoreCreditSubmitting(false);
    }
  };

  const canApply = isValid && !isSubmitting;
  const hasApplied = appliedGiftCards.length > 0;
  const hasHiddenGiftCard = !hasApplied && (giftCardTotal ?? 0) > 0;

  return (
    <div
      className="mt-5 w-full border-t border-gray-200 pt-5"
      data-testid="benefits-gift-card-card"
    >
      <h3 className="mb-1 font-semibold text-gray-900">Saldo y tarjetas de regalo</h3>
      <p className="mb-4 text-gray-500 text-sm">Usá tu saldo acreditado o ingresá otro código.</p>
      {availableBalance != null && availableBalance > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-emerald-950 text-sm">
              Saldo disponible: {formatAmount(availableBalance)}
            </p>
            {appliedStoreCredit > 0 && (
              <p className="mt-1 text-emerald-800 text-xs">
                Aplicaste {formatAmount(appliedStoreCredit)}. Remanente luego de esta compra:{' '}
                {formatAmount(Math.max(availableBalance - appliedStoreCredit, 0))}.
              </p>
            )}
          </div>
          {appliedStoreCredit > 0 ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800 text-xs">
              Saldo aplicado
            </span>
          ) : (
            <button
              className="rounded-lg border border-emerald-700 px-4 py-2 font-semibold text-emerald-800 text-sm transition hover:bg-emerald-100 disabled:opacity-50"
              disabled={isStoreCreditSubmitting}
              onClick={toggleStoreCredit}
              type="button"
            >
              {isStoreCreditSubmitting ? 'Procesando...' : 'Usar saldo'}
            </button>
          )}
        </div>
      )}
      <form className="w-full" noValidate onSubmit={handleSubmit(onApply)}>
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-stretch sm:gap-3">
          <FormInput
            autoComplete="off"
            className="min-w-0 flex-1"
            data-testid="gift-card-input"
            icon={<CreditCardIcon aria-hidden className="h-5 w-5" />}
            id="gift-card-input"
            label="Tarjeta de regalo"
            placeholder="Ej: GIFT-1234-ABCD"
            {...register('code')}
          />
          <button
            className={`!h-[42px] !w-full shrink-0 rounded-lg px-5 text-sm font-medium text-white shadow-none transition-colors focus:ring-gray-400 sm:!w-auto sm:min-w-[100px] ${
              canApply
                ? 'bg-[var(--primary-color)] hover:opacity-90'
                : 'cursor-not-allowed bg-[#A0A4A8]'
            }`}
            data-testid="gift-card-apply-button"
            disabled={!canApply}
            type="submit"
          >
            {isSubmitting ? 'Procesando...' : 'Aplicar'}
          </button>
        </div>

        <div className="mt-2">
          <ErrorMessage data-testid="gift-card-error-message" error={errorMessage} />
        </div>
      </form>

      {(hasApplied || hasHiddenGiftCard) && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="mb-3 flex items-center gap-1.5">
            <CheckBadgeIcon className="h-4 w-4 text-emerald-600" />
            <h4 className="font-semibold text-gray-900 text-sm">Tarjetas de regalo aplicadas</h4>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 font-semibold text-[11px] text-emerald-700">
              {hasApplied ? appliedGiftCards.length : 1}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {hasHiddenGiftCard && (
              <li
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
                data-testid="gift-card-row"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <CreditCardIcon className="h-4 w-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-semibold text-gray-900 text-sm">
                    Tarjeta de regalo aplicada
                  </span>
                  {(giftCardTotal ?? 0) > 0 && (
                    <span className="text-xs font-semibold text-emerald-600">
                      -{formatAmount(giftCardTotal ?? 0)}
                    </span>
                  )}
                </div>
              </li>
            )}
            {appliedGiftCards.map((giftCard) => {
              const applicationId = giftCard.id ?? '';
              const maskedCode = giftCard.masked_code || 'Tarjeta de regalo';
              return (
                <li
                  className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-gray-300"
                  data-testid="gift-card-row"
                  key={applicationId}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <CreditCardIcon className="h-4 w-4" />
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className="truncate font-semibold text-gray-900 text-sm"
                      data-testid="gift-card-code"
                    >
                      {maskedCode}
                    </span>
                    {giftCard.amount != null && giftCard.amount > 0 && (
                      <span className="text-xs font-semibold text-emerald-600">
                        -{formatAmount(giftCard.amount)}
                      </span>
                    )}
                  </div>

                  {applicationId && (
                    <button
                      aria-label={`Quitar ${maskedCode}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      data-testid="remove-gift-card-button"
                      disabled={removingCode === applicationId}
                      onClick={() => removeGiftCardCode(applicationId)}
                      type="button"
                    >
                      {removingCode === applicationId ? (
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
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

export default GiftCardCode;
