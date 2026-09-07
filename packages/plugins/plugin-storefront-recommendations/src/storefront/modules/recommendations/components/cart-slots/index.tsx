'use client';

import type { HttpTypes } from '@medusajs/types';
import type { ComponentType } from 'react';
import CartRail from '../cart-rail';
import FreeShippingProgress from '../free-shipping-progress';
import { useFreeShippingTarget } from '../../hooks/use-free-shipping-target';

/**
 * Los tres widgets de carrito, agrupados para que el core los monte con un solo import
 * a través del slot generado.
 *
 * Son CLIENT components (el carrito es client-side), así que no pueden salir del mismo
 * archivo que el slot del PDP: ese es un módulo de servidor porque arrastra
 * `lib/data/recommendations.ts`, que es `server-only`.
 */

type CardComponentType = ComponentType<{
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
}>;

/** Recomendados del carrito (PRD §9.3). */
export function CartRecommendations({
  countryCode,
  region,
  CardComponent,
}: {
  countryCode: string;
  region: HttpTypes.StoreRegion;
  CardComponent: CardComponentType;
}) {
  // Sin `limit`: manda el "Productos a mostrar" del placement. Hardcodearlo acá hacía
  // que ese campo del backoffice no tuviera efecto.
  return (
    <CartRail
      countryCode={countryCode}
      headingId="cart-recommendations-heading"
      placement="cart-recommendations"
      region={region}
      title="Te puede interesar"
      CardComponent={CardComponent}
    />
  );
}

/**
 * Barra de envío gratis + productos puente (PRD §9.4/§9.5).
 *
 * Los dos van juntos porque comparten el monto faltante y porque los bridge products SIN
 * la barra no tienen sentido: el usuario no sabría por qué se le ofrecen esos productos.
 *
 * La banda de precio es ASIMÉTRICA (0,75× a 1,5× del faltante), igual que el ejemplo del
 * PRD: ofrecer algo bastante más caro que el faltante sirve —igual cruza el umbral— pero
 * algo mucho más barato no alcanza.
 */
export function FreeShippingBridge({
  countryCode,
  region,
  shippingOptions,
  CardComponent,
}: {
  countryCode: string;
  region: HttpTypes.StoreRegion;
  shippingOptions?: HttpTypes.StoreCartShippingOption[] | null;
  CardComponent: CardComponentType;
}) {
  const { target } = useFreeShippingTarget(shippingOptions);

  const remaining = target && !target.reached ? target.remaining : 0;
  // Se cuantiza a múltiplos de 500 para que la cache del motor pegue: sin esto, cada
  // click en el stepper de cantidad genera un `target_price` distinto y una consulta
  // nueva. El debounce solo no alcanza.
  const quantized = remaining > 0 ? Math.round(remaining / 500) * 500 || remaining : 0;

  return (
    <>
      <FreeShippingProgress shippingOptions={shippingOptions} />
      {quantized > 0 ? (
        <div className="mt-3">
          <CartRail
            context={{
              target_price: quantized,
              price_min: Math.round(quantized * 0.75),
              price_max: Math.round(quantized * 1.5),
            }}
            countryCode={countryCode}
            debounceMs={600}
            headingId="bridge-heading"
            placement="free-shipping-bridge"
            region={region}
            title="Sumá uno de estos y te llevás el envío gratis"
            CardComponent={CardComponent}
          />
        </div>
      ) : null}
    </>
  );
}
