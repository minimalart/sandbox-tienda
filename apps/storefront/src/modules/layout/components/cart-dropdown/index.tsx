"use client";

import {
  Popover,
  PopoverButton,
  PopoverPanel,
  Transition,
} from "@headlessui/react";
import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import { useCartStore } from "@lib/stores";
import { isLineItemInStock } from "@lib/util/is-line-item-in-stock";
import { convertToLocale } from "@lib/util/money";
import type { HttpTypes } from "@medusajs/types";
import { Button } from "@medusajs/ui";
import DeleteButton from "@modules/common/components/delete-button";
import DisneyBadge from "@modules/common/components/disney-badge";
import LineItemOptions from "@modules/common/components/line-item-options";
import LineItemPrice from "@modules/common/components/line-item-price";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Thumbnail from "@modules/products/components/thumbnail";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

const CartDropdown = ({
  cart: initialCart,
}: {
  cart?: HttpTypes.StoreCart | null;
}) => {
  // Zustand store
  const {
    cart: storeCart,
    setCart,
    isOpen,
    openCart,
    closeCart,
  } = useCartStore();

  // Usar cart del store si existe, sino el inicial
  const cartState = storeCart ?? initialCart;
  // Disney promo removed — stub yields null promotion
  const disneyState = useDisneyPromoState(null, cartState?.items ?? []);
  const disneyTargetIdsSet = useMemo(
    () => new Set(disneyState.targetProductIds),
    [disneyState.targetProductIds],
  );

  const [activeTimer, setActiveTimer] = useState<NodeJS.Timer | undefined>(
    undefined,
  );

  // Sincronizar cart inicial con el store
  useEffect(() => {
    if (initialCart && !storeCart) {
      setCart(initialCart);
    }
  }, [initialCart, storeCart, setCart]);

  const open = () => openCart();
  const close = () => closeCart();

  const totalItems =
    cartState?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const subtotal = cartState?.subtotal ?? 0;
  const itemRef = useRef<number>(totalItems || 0);

  const timedOpen = () => {
    open();

    const timer = setTimeout(close, 5000);

    setActiveTimer(timer);
  };

  const openAndCancel = () => {
    if (activeTimer) {
      clearTimeout(activeTimer);
    }

    open();
  };

  // Clean up the timer when the component unmounts
  useEffect(
    () => () => {
      if (activeTimer) {
        clearTimeout(activeTimer);
      }
    },
    [activeTimer],
  );

  const pathname = usePathname();

  // open cart dropdown when modifying the cart items, but only if we're not on the cart page
  useEffect(() => {
    if (itemRef.current !== totalItems && !pathname.includes("/cart")) {
      timedOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemRef.current]);
  return (
    <div
      className="z-50 h-full"
      onMouseEnter={openAndCancel}
      onMouseLeave={close}
    >
      <Popover className="relative h-full">
        <PopoverButton className="h-full">
          <LocalizedClientLink
            className="hover:text-ui-fg-base"
            data-testid="nav-cart-link"
            href="/cart"
          >{`Carrito (${totalItems})`}</LocalizedClientLink>
        </PopoverButton>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-200"
          enterFrom="opacity-0 translate-y-1"
          enterTo="opacity-100 translate-y-0"
          leave="transition ease-in duration-150"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-1"
          show={isOpen}
        >
          <PopoverPanel
            className="absolute top-[calc(100%+1px)] right-0 hidden w-[420px] border-gray-200 border-x border-b bg-white text-ui-fg-base small:block"
            data-testid="nav-cart-dropdown"
            static
          >
            <div className="flex items-center justify-center p-4">
              <h3 className="text-large-semi">Carrito</h3>
            </div>
            {cartState && cartState.items?.length ? (
              <>
                <div className="no-scrollbar grid max-h-[402px] grid-cols-1 gap-y-8 overflow-y-scroll p-px px-4">
                  {cartState.items
                    .sort((a, b) =>
                      (a.created_at ?? "") > (b.created_at ?? "") ? -1 : 1,
                    )
                    .map((item) => {
                      const itemInStock = isLineItemInStock(item);
                      return (
                        <div
                          className={`grid grid-cols-[122px_1fr] gap-x-4${!itemInStock ? " opacity-70" : ""}`}
                          data-testid="cart-item"
                          key={item.id}
                        >
                          <LocalizedClientLink
                            className="w-24"
                            href={`/products/${item.product_handle}`}
                          >
                            <Thumbnail
                              images={item.variant?.product?.images}
                              size="square"
                              thumbnail={item.thumbnail}
                            />
                          </LocalizedClientLink>
                          <div className="flex flex-1 flex-col justify-between">
                            <div className="flex flex-1 flex-col">
                              <div className="flex items-start justify-between">
                                <div className="mr-4 flex w-[180px] flex-col overflow-ellipsis whitespace-nowrap">
                                  <h3 className="overflow-hidden text-ellipsis text-base-regular">
                                    <LocalizedClientLink
                                      data-testid="product-link"
                                      href={`/products/${item.product_handle}`}
                                    >
                                      {item.title}
                                    </LocalizedClientLink>
                                  </h3>
                                  <div className="mt-0.5">
                                    <DisneyBadge productId={item.product_id} />
                                  </div>
                                  <LineItemOptions
                                    data-testid="cart-item-variant"
                                    data-value={item.variant}
                                    variant={item.variant}
                                    metadata={item.metadata}
                                  />
                                  <span
                                    data-testid="cart-item-quantity"
                                    data-value={item.quantity}
                                  >
                                    Cantidad: {item.quantity}
                                  </span>
                                  {!itemInStock && (
                                    <span className="mt-1 inline-flex w-fit items-center rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600 text-xs">
                                      Sin stock
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-end">
                                  <LineItemPrice
                                    currencyCode={cartState.currency_code}
                                    item={item}
                                    suppressDiscount={
                                      Boolean(item.product_id) &&
                                      !disneyState.unlocked &&
                                      disneyTargetIdsSet.has(item.product_id as string)
                                    }
                                    style="tight"
                                  />
                                </div>
                              </div>
                            </div>
                            <DeleteButton
                              className="mt-1"
                              data-testid="cart-item-remove-button"
                              id={item.id}
                            >
                              Eliminar
                            </DeleteButton>
                          </div>
                        </div>
                      );
                    })}
                </div>
                <div className="flex flex-col gap-y-4 p-4 text-small-regular">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ui-fg-base">
                      Subtotal{" "}
                      <span className="font-normal">(excl. impuestos)</span>
                    </span>
                    <span
                      className="text-large-semi"
                      data-testid="cart-subtotal"
                      data-value={subtotal}
                    >
                      {convertToLocale({
                        amount: subtotal,
                        currency_code: cartState.currency_code,
                      })}
                    </span>
                  </div>
                  <LocalizedClientLink href="/cart" passHref>
                    <Button
                      className="w-full"
                      data-testid="go-to-cart-button"
                      size="large"
                    >
                      Ir al carrito
                    </Button>
                  </LocalizedClientLink>
                </div>
              </>
            ) : (
              <div>
                <div className="flex flex-col items-center justify-center gap-y-4 py-16">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-small-regular text-white">
                    <span>0</span>
                  </div>
                  <span>Tu carrito está vacío.</span>
                  <div>
                    <LocalizedClientLink href="/store">
                      <>
                        <span className="sr-only">
                          Ir a la página de todos los productos
                        </span>
                        <Button onClick={close}>Explorar productos</Button>
                      </>
                    </LocalizedClientLink>
                  </div>
                </div>
              </div>
            )}
          </PopoverPanel>
        </Transition>
      </Popover>
    </div>
  );
};

export default CartDropdown;
