'use client';

import { convertToLocale } from '@minimalart/mercatto-storefront-shared/util/money';
import { getIndividualVariant } from '@minimalart/mercatto-storefront-shared/util/get-individual-variant';
import { isProductInStock } from '@minimalart/mercatto-storefront-shared/util/is-product-in-stock';
import CheckboxInput from '@minimalart/mercatto-storefront-shared/components/checkbox-input';
import ProductImage from '@minimalart/mercatto-storefront-shared/components/product-image';
import { useStorefrontShared } from '@minimalart/mercatto-storefront-shared/provider';
import type { HttpTypes } from '@medusajs/types';
import { toast } from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { trackRecommendationEvent } from '../../lib/events';

/**
 * "Comprados juntos" (PRD §9.2): el producto actual + acompañantes con checkbox,
 * precio por fila, total de lo seleccionado y un botón que agrega todo junto.
 *
 * Reglas que vienen del PRD y del repo:
 *
 * - El total sale SÓLO de precios que devuelve Medusa. Sin motor de promos propio y sin
 *   línea de "ahorro del combo": si hay una promo válida configurada en otro módulo, el
 *   precio que llega ya la tiene aplicada.
 * - La variante se resuelve con `getIndividualVariant`, que es la regla B2C del repo:
 *   nunca la variante "Bulto".
 * - El agregado es SECUENCIAL y no `Promise.all`: la reconciliación optimista del cart
 *   store no está hecha para adds concurrentes (mismo criterio que el bloque del blog).
 * - `convertToLocale` devuelve el número SIN símbolo, así que el `$` se prefija a mano
 *   (igual que `minimum-purchase-notice`).
 */

// Datos para la línea optimista del carrito, así el drawer muestra título, imagen y
// precio reales al instante. Duplicado a propósito desde el bloque del blog: esa
// carpeta la posee la extensión `blog` y puede no estar instalada.
const optimisticOptionsFor = (
  product: HttpTypes.StoreProduct,
  variant?: HttpTypes.StoreProductVariant,
) => ({
  title: product.title,
  handle: product.handle,
  thumbnail: product.thumbnail || product.images?.[0]?.url,
  unitPrice: variant?.calculated_price?.calculated_amount,
  currencyCode: variant?.calculated_price?.currency_code,
});

const unitPriceOf = (product: HttpTypes.StoreProduct): number =>
  getIndividualVariant(product.variants)?.calculated_price?.calculated_amount ?? 0;

const currencyOf = (product: HttpTypes.StoreProduct): string =>
  getIndividualVariant(product.variants)?.calculated_price?.currency_code ?? 'ars';

const formatAmount = (amount: number, currencyCode: string): string =>
  `$${convertToLocale({ amount, currency_code: currencyCode })}`;

/**
 * Shape mínimo del cart store que este componente usa. El host implementa el port
 * completo; acá se declaran únicamente las acciones que el widget dispara.
 */
type OptimisticOptions = {
  title?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  unitPrice?: number | null | undefined;
  currencyCode?: string | null | undefined;
};
type CartStoreShape = {
  addItem: (
    variantId: string,
    quantity: number,
    countryCode: string,
    productId: string,
    metadata: unknown,
    optimistic: OptimisticOptions,
  ) => Promise<boolean> | boolean;
  openCart: () => void;
};

export default function FrequentlyBoughtTogether({
  anchor,
  companions,
  requestId,
  countryCode,
}: {
  anchor: HttpTypes.StoreProduct;
  companions: HttpTypes.StoreProduct[];
  requestId: string | null;
  countryCode: string;
}) {
  const { cartStore, link } = useStorefrontShared();
  const addItem = cartStore.useCartStore(
    (state: unknown) => (state as CartStoreShape).addItem,
  );
  const openCart = cartStore.useCartStore(
    (state: unknown) => (state as CartStoreShape).openCart,
  );
  const [isAdding, setIsAdding] = useState(false);

  // Arrancan seleccionados los que tienen stock. Los sin stock quedan deshabilitados y
  // nunca entran en la selección.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(companions.filter(isProductInStock).map((product) => product.id)),
  );

  const selectedCompanions = useMemo(
    () => companions.filter((product) => selected.has(product.id)),
    [companions, selected],
  );

  const currencyCode = currencyOf(anchor);
  const total = useMemo(
    () =>
      [anchor, ...selectedCompanions].reduce((sum, product) => sum + unitPriceOf(product), 0),
    [anchor, selectedCompanions],
  );

  const toggle = (productId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleAddAll = async () => {
    setIsAdding(true);
    let added = 0;
    let skipped = 0;

    // El producto ancla va primero: es el que el usuario vino a comprar.
    for (const product of [anchor, ...selectedCompanions]) {
      if (!isProductInStock(product)) {
        skipped += 1;
        continue;
      }
      const variant = getIndividualVariant(product.variants);
      if (!variant?.id) {
        skipped += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const ok = await addItem(
        variant.id,
        1,
        countryCode,
        product.id,
        undefined,
        optimisticOptionsFor(product, variant),
      );
      if (ok) {
        added += 1;
        if (product.id !== anchor.id) {
          const position = companions.findIndex((item) => item.id === product.id);
          trackRecommendationEvent({
            requestId,
            event: 'recommendation_added_to_cart',
            productId: product.id,
            position: position >= 0 ? position : undefined,
          });
        }
      } else {
        skipped += 1;
      }
    }

    setIsAdding(false);
    if (added > 0) {
      toast.success(`${added} producto(s) agregado(s) al carrito`);
      openCart();
    } else if (skipped > 0) {
      toast.error('No se pudieron agregar los productos');
    }
  };

  const rows = [
    { product: anchor, isAnchor: true },
    ...companions.map((product) => ({ product, isAnchor: false })),
  ];

  return (
    <section
      aria-labelledby="fbt-heading"
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 font-bold text-gray-900 text-xl" id="fbt-heading">
        Comprados juntos
      </h2>

      <ul className="flex flex-col gap-3">
        {rows.map(({ product, isAnchor }) => {
          const inStock = isProductInStock(product);
          const variant = getIndividualVariant(product.variants);
          const original = variant?.calculated_price?.original_amount;
          const calculated = variant?.calculated_price?.calculated_amount;
          const hasDiscount =
            typeof original === 'number' &&
            typeof calculated === 'number' &&
            original > calculated;

          return (
            <li key={product.id} className="flex items-center gap-3">
              <CheckboxInput
                aria-label={`Incluir ${product.title}`}
                // El ancla siempre va: no se puede armar un combo sin el producto que
                // se está mirando.
                checked={isAnchor ? true : selected.has(product.id)}
                disabled={isAnchor || !inStock || isAdding}
                onChange={() => toggle(product.id)}
              />

              {link.render({
                href: `/products/${product.handle}`,
                className:
                  'relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50',
                children: (
                  <ProductImage
                    src={product.thumbnail}
                    alt={product.title ?? ''}
                    fill
                    sizes="56px"
                    className="object-contain p-1"
                  />
                ),
              })}

              <div className="min-w-0 flex-1">
                {link.render({
                  href: `/products/${product.handle}`,
                  children: (
                    <p className="line-clamp-2 font-medium text-gray-900 text-sm leading-snug">
                      {isAnchor ? 'Este producto: ' : ''}
                      {product.title}
                    </p>
                  ),
                })}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[--primary-color] text-sm">
                    {formatAmount(unitPriceOf(product), currencyOf(product))}
                  </span>
                  {hasDiscount ? (
                    <span className="text-gray-400 text-xs line-through">
                      {formatAmount(original, currencyOf(product))}
                    </span>
                  ) : null}
                  {!inStock ? <span className="text-gray-500 text-xs">Sin stock</span> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-gray-100 border-t pt-4">
        <div>
          <p className="text-gray-500 text-xs">
            Total de {1 + selectedCompanions.length} producto
            {selectedCompanions.length === 0 ? '' : 's'}
          </p>
          <p className="font-bold text-gray-900 text-lg">{formatAmount(total, currencyCode)}</p>
        </div>
        <button
          type="button"
          disabled={isAdding}
          onClick={handleAddAll}
          className="flex items-center justify-center gap-2 rounded-lg bg-[--primary-color] px-4 py-2.5 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isAdding
            ? 'Agregando…'
            : `Agregar ${1 + selectedCompanions.length} al carrito`}
        </button>
      </div>
    </section>
  );
}
