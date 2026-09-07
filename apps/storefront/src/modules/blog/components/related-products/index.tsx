'use client';

import { useCartStore } from '@lib/stores/cart.store';
import { getIndividualVariant } from '@lib/util/get-individual-variant';
import { isProductInStock } from '@lib/util/is-product-in-stock';
import {
  canIncrementQuantity,
  getLineItemMaxQuantity,
} from '@lib/util/max-purchasable-quantity';
import { getProductPrice } from '@lib/util/get-product-price';
import { CartQuantitySelector } from '@modules/common/components/cart-quantity-selector';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import type { HttpTypes } from '@medusajs/types';
import { toast } from '@medusajs/ui';
import ProductImage from '@modules/common/components/product-image';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

type Props = {
  products: HttpTypes.StoreProduct[];
};

// Datos para la línea optimista del carrito: así el drawer muestra título,
// imagen y precio reales al instante, sin esperar la respuesta del server.
const optimisticOptionsFor = (
  product: HttpTypes.StoreProduct,
  variant?: HttpTypes.StoreProductVariant
) => ({
  title: product.title,
  handle: product.handle,
  thumbnail: product.thumbnail || product.images?.[0]?.url,
  unitPrice: variant?.calculated_price?.calculated_amount,
  currencyCode: variant?.calculated_price?.currency_code,
});

/**
 * Shoppable product block for an article. Desktop: sticky right sidebar.
 * Mobile: rendered below the content. Each product can be added individually;
 * "Agregar todos" adds every available product (skipping out-of-stock ones and
 * continuing if one fails), per the PRD rules.
 *
 * Los controles leen el carrito (zustand) y se actualizan de forma OPTIMISTA:
 * al agregar, el botón pasa al instante al selector de cantidad sin esperar al
 * server (antes el botón quedaba "Agregar" y parecía que no pasaba nada).
 */
const RelatedProducts = ({ products }: Props) => {
  const { countryCode } = useParams() as { countryCode: string };
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.cart?.items);
  const openCart = useCartStore((s) => s.openCart);
  const [addingAll, setAddingAll] = useState(false);

  // Productos en stock que mostramos como "agregables".
  const inStockProducts = useMemo(
    () => products.filter((product) => isProductInStock(product)),
    [products]
  );

  // ¿Están TODOS los productos en stock ya en el carrito? Se deriva del carrito,
  // así que si el usuario quita uno, el botón vuelve a "Agregar todos".
  const allAdded = useMemo(() => {
    if (!inStockProducts.length) return false;
    return inStockProducts.every((product) => {
      const variantId = getIndividualVariant(product.variants)?.id;
      return Boolean(
        cartItems?.some(
          (item) =>
            (variantId && item.variant_id === variantId) ||
            item.product_id === product.id
        )
      );
    });
  }, [inStockProducts, cartItems]);

  if (!products.length) return null;

  const addOne = async (product: HttpTypes.StoreProduct) => {
    const variant = getIndividualVariant(product.variants);
    if (!variant?.id) return false;
    return addItem(
      variant.id,
      1,
      countryCode,
      product.id,
      undefined,
      optimisticOptionsFor(product, variant)
    );
  };

  const handleAddAll = async () => {
    setAddingAll(true);
    let added = 0;
    let skipped = 0;
    for (const product of products) {
      if (!isProductInStock(product)) {
        skipped += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const ok = await addOne(product);
      if (ok) added += 1;
      else skipped += 1;
    }
    setAddingAll(false);
    if (added > 0) {
      toast.success(`${added} producto(s) agregado(s) al carrito`);
    }
    if (added === 0 && skipped > 0) {
      toast.error('No se pudieron agregar los productos');
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <span className="mb-2 block h-1 w-8 rounded-full bg-[--primary-color]" />
      <h2 className="mb-4 text-lg font-bold text-gray-900">
        Productos para este artículo
      </h2>
      <ul className="flex flex-col gap-4">
        {products.map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            countryCode={countryCode}
          />
        ))}
      </ul>
      {allAdded && !addingAll ? (
        // Estado de éxito: todo en el carrito. Cambia de color y abre el carrito.
        <button
          type="button"
          onClick={openCart}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[--primary-color] bg-[--primary-soft-bg] px-4 py-2.5 text-sm font-semibold text-[--primary-color] transition-colors hover:bg-[--primary-color] hover:text-white"
        >
          <CheckIcon />
          Agregados — ver carrito
        </button>
      ) : (
        <button
          type="button"
          onClick={handleAddAll}
          disabled={addingAll}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[--primary-color] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {addingAll ? <Spinner /> : <CartIcon />}
          {addingAll ? 'Agregando…' : 'Agregar todos al carrito'}
        </button>
      )}
    </section>
  );
};

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <path
      d="M4.5 10.5l3.5 3.5 7.5-8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Spinner = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4 animate-spin"
    fill="none"
    aria-hidden
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const CartIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <path
      d="M2 2.5h2l1.2 9.2a1.2 1.2 0 0 0 1.2 1.05h7.1a1.2 1.2 0 0 0 1.18-.97l1.07-5.6H5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="7.5" cy="16.5" r="1.1" fill="currentColor" />
    <circle cx="14.5" cy="16.5" r="1.1" fill="currentColor" />
  </svg>
);

function ProductRow({
  product,
  countryCode,
}: {
  product: HttpTypes.StoreProduct;
  countryCode: string;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const changeItemQuantity = useCartStore((s) => s.changeItemQuantity);
  const cart = useCartStore((s) => s.cart);
  const pendingAdditions = useCartStore((s) => s.pendingAdditions);
  const pendingQuantityUpdates = useCartStore((s) => s.pendingQuantityUpdates);

  const variant = useMemo(
    () => getIndividualVariant(product.variants),
    [product.variants]
  );
  const variantId = variant?.id;
  const inStock = isProductInStock(product);
  const price = (() => {
    try {
      return getProductPrice({ product }).cheapestPrice?.calculated_price;
    } catch {
      return undefined;
    }
  })();

  // Línea del carrito para este producto (match por variante, con fallback por
  // producto). Es la fuente de verdad del estado del botón.
  const lineItem = useMemo(() => {
    if (!cart?.items) return undefined;
    if (variantId) {
      const exactMatch = cart.items.find((item) => item.variant_id === variantId);
      if (exactMatch) return exactMatch;
    }
    return cart.items.find((item) => item.product_id === product.id);
  }, [cart?.items, variantId, product.id]);

  const isAdding = variantId ? pendingAdditions.has(variantId) : false;
  // Optimista: reflejamos el "+1" al instante aunque la línea optimista todavía
  // no haya aterrizado en el store.
  const quantity = lineItem?.quantity ?? (isAdding ? 1 : 0);
  const isUpdating = lineItem ? pendingQuantityUpdates.has(lineItem.id) : false;
  const isLoading = isAdding || isUpdating;
  // Techo de stock de la línea (el carrito viene enriquecido con el stock real
  // por variante). `null` = sin techo conocido. Sin esto, clickear rápido de más
  // mandaba UNA cantidad imposible y el rollback volvía al valor inicial.
  const maxQuantity = getLineItemMaxQuantity(lineItem);
  const canIncrement = canIncrementQuantity(quantity, maxQuantity);

  const handleIncrement = async () => {
    if (!variantId) return;
    if (!canIncrement) return;
    if (quantity === 0) {
      await addItem(
        variantId,
        1,
        countryCode,
        product.id,
        undefined,
        optimisticOptionsFor(product, variant)
      );
    } else if (lineItem) {
      changeItemQuantity(lineItem.id, 1);
    }
  };

  const handleDecrement = () => {
    if (lineItem) {
      changeItemQuantity(lineItem.id, -1);
    }
  };

  const handleRemove = () => {
    if (lineItem) {
      updateQuantity(lineItem.id, 0);
    }
  };

  return (
    <li className="flex items-center gap-3">
      <LocalizedClientLink
        href={`/products/${product.handle}`}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
      >
        <ProductImage
          src={product.thumbnail}
          alt={product.title}
          fill
          sizes="64px"
          className="object-contain p-1"
        />
      </LocalizedClientLink>
      <div className="min-w-0 flex-1">
        <LocalizedClientLink href={`/products/${product.handle}`}>
          <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
            {product.title}
          </p>
        </LocalizedClientLink>
        {price ? (
          <p className="mt-0.5 text-sm font-bold text-[--primary-color]">
            {price}
          </p>
        ) : null}
      </div>
      {quantity === 0 ? (
        <button
          type="button"
          disabled={!inStock || isLoading}
          onClick={handleIncrement}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-[--primary-color] hover:bg-[--primary-soft-bg] hover:text-[--primary-color] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-300 disabled:hover:bg-white disabled:hover:text-gray-700"
        >
          {isLoading ? <Spinner /> : null}
          {inStock ? 'Agregar' : 'Sin stock'}
        </button>
      ) : (
        <CartQuantitySelector
          quantity={quantity}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRemove={handleRemove}
          isLoading={isLoading}
          canIncrement={canIncrement}
          size="sm"
          className="shrink-0"
        />
      )}
    </li>
  );
}

export default RelatedProducts;
