'use client';

import { convertToLocale } from '@minimalart/mercatto-storefront-shared/util/money';
import type { HttpTypes } from '@medusajs/types';
import { useFreeShippingTarget } from '../../hooks/use-free-shipping-target';

/**
 * Barra de progreso de envío gratis (PRD §9.4).
 *
 * El umbral SIEMPRE se deriva de las shipping options reales del carrito. El
 * `threshold` que se puede configurar en el backoffice es informativo y no pisa este
 * valor: el PRD §17 prohíbe mostrar un umbral promocional que no coincida con las
 * condiciones reales de envío, porque prometer envío gratis que después no se aplica es
 * peor que no prometer nada.
 *
 * Si la tienda no tiene envío gratis condicionado por `item_total` en la moneda del
 * carrito, no se muestra nada.
 *
 * `convertToLocale` devuelve el número SIN símbolo, así que el `$` se prefija a mano
 * (igual que `minimum-purchase-notice`).
 */

const TruckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
    <path
      d="M3 7h11v8H3zM14 10h4l3 3v2h-7z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <circle cx="7" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="17" cy="17" r="1.6" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0" aria-hidden>
    <path
      d="M4.5 10.5l3.5 3.5 7.5-8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function FreeShippingProgress({
  shippingOptions,
  messageInProgress = 'Te faltan {amount} para obtener envío gratis.',
  messageCompleted = 'Ya tenés envío gratis.',
}: {
  /** En la página de carrito llegan por prop (sin round trip); en el drawer, no. */
  shippingOptions?: HttpTypes.StoreCartShippingOption[] | null;
  messageInProgress?: string;
  messageCompleted?: string;
}) {
  const { cart, target } = useFreeShippingTarget(shippingOptions);

  if (!cart || !target) return null;

  const remaining = `$${convertToLocale({
    amount: target.remaining,
    currency_code: cart.currency_code,
  })}`;

  const message = target.reached
    ? messageCompleted
    : messageInProgress.replace('{amount}', remaining);

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center gap-2">
        <span className={target.reached ? 'text-green-600' : 'text-gray-500'}>
          {target.reached ? <CheckIcon /> : <TruckIcon />}
        </span>
        <p
          className={`text-xs ${target.reached ? 'font-semibold text-green-700' : 'text-gray-700'}`}
        >
          {message}
        </p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-in-out ${
            target.reached
              ? 'bg-gradient-to-r from-green-400 to-green-500'
              : 'bg-gradient-to-r from-[--primary-color] to-[--primary-color]'
          }`}
          // `target.progress` viene clampeado a 0..1 por el util, así que la barra nunca
          // desborda el riel (bug de la versión original de computeTarget).
          style={{ width: `${Math.round(target.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
