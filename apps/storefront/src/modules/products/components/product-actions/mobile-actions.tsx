import { ShoppingCartIcon, TrashIcon } from "@heroicons/react/24/outline";
import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import { getProductPrice } from "@lib/util/get-product-price";
import { convertToLocale } from "@lib/util/money";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";
import type React from "react";
import { Fragment, useCallback, useMemo } from "react";
import { Transition } from "@headlessui/react";
import CartTrashFlight from "@modules/common/components/cart-trash-flight";
import CartDropFlight, {
  startCartDrop,
  startCartTrash,
  useCartDropPhase,
} from "@modules/common/components/cart-drop-flight";

type MobileActionsProps = {
  product: HttpTypes.StoreProduct & {
    discount?: number;
    subtotal?: number;
    price?: number;
  };
  variant?: HttpTypes.StoreProductVariant;
  inStock?: boolean;
  handleAddToCart: (opts?: { skipAnimation?: boolean }) => void;
  handleBuyNow?: () => void;
  isAdding?: boolean;
  show: boolean;
  quantityInCart: number;
  /**
   * `false` cuando la cantidad en carrito ya llegó al stock disponible: apaga el
   * "+" del stepper. Sin esto el cliente podía clickear de más, el debounce
   * mandaba UNA cantidad imposible y el rollback lo devolvía al valor inicial.
   */
  canIncrement?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  isUpdatingQuantity: boolean;
  inline?: boolean;
  productPage?: boolean;
  addButtonRef?: React.RefObject<HTMLElement | null>;
  showBuyNow?: boolean;
  /**
   * Falta un paso obligatorio antes de poder comprar (hoy: elegir el color de una
   * base entonable). Se comporta igual que una variante sin elegir: el botón queda
   * deshabilitado con el texto de `blockedLabel`.
   */
  blocked?: boolean;
  blockedLabel?: string;
  /**
   * Precio unitario que reemplaza al de catálogo. Lo usa el entonado: el precio
   * final lo cotiza el ERP, así que la barra tiene que mostrar ESE precio y
   * cuánto suma el color, no el de la base pelada.
   */
  priceOverride?: {
    unitPrice: number;
    surcharge?: number | null;
    currencyCode?: string | null;
  } | null;
};

const MobileActions: React.FC<MobileActionsProps> = ({
  product,
  variant,
  inStock,
  handleAddToCart,
  handleBuyNow,
  isAdding,
  show,
  quantityInCart,
  canIncrement = true,
  onIncrement,
  onDecrement,
  onRemove,
  isUpdatingQuantity,
  inline = false,
  productPage = false,
  addButtonRef,
  showBuyNow = false,
  blocked = false,
  blockedLabel = "Elegí una opción",
  priceOverride = null,
}) => {
  const price = getProductPrice({
    product,
    variantId: variant?.id,
  });

  const selectedPrice = useMemo(() => {
    if (!price) {
      return null;
    }
    const { variantPrice, cheapestPrice } = price;
    return variantPrice || cheapestPrice || null;
  }, [price]);

  // Check for Typesense discount data
  const hasTypesenseDiscount =
    (product.discount ?? 0) > 0 && (product.subtotal ?? 0) > 0;

  // Precio del entonado: pisa cualquier otro precio (catálogo o Typesense) porque
  // es el único que el cliente va a pagar.
  const overridePrice = useMemo(() => {
    if (!priceOverride || typeof priceOverride.unitPrice !== "number") {
      return null;
    }
    return convertToLocale({
      amount: priceOverride.unitPrice,
      currency_code: priceOverride.currencyCode || "ARS",
    });
  }, [priceOverride]);

  // Cuánto suma el color sobre la base. Sólo informativo, y sólo si suma.
  const overrideSurcharge = useMemo(() => {
    if (!priceOverride || typeof priceOverride.surcharge !== "number") {
      return null;
    }
    if (priceOverride.surcharge <= 0) {
      return null;
    }
    return convertToLocale({
      amount: priceOverride.surcharge,
      currency_code: priceOverride.currencyCode || "ARS",
    });
  }, [priceOverride]);

  // Calculate prices with Typesense discount support
  const catalogPrice = useMemo(() => {
    if (hasTypesenseDiscount) {
      return convertToLocale({
        amount: product.subtotal!,
        currency_code: "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      });
    }
    return selectedPrice?.calculated_price;
  }, [hasTypesenseDiscount, product.subtotal, selectedPrice]);

  const displayOriginalPrice = useMemo(() => {
    if (hasTypesenseDiscount && product.price) {
      return convertToLocale({
        amount: product.price,
        currency_code: "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      });
    }
    return selectedPrice?.original_price;
  }, [hasTypesenseDiscount, product.price, selectedPrice]);

  const displayPrice = overridePrice ?? catalogPrice;

  // El entonado no es una oferta: con precio del ERP no se tacha nada.
  const isPriceSale =
    !overridePrice &&
    (hasTypesenseDiscount || selectedPrice?.price_type === "sale");

  // Fase de la coreografía, leída del store por variante:
  // "dropping" = corre la animación y hay que RETENER el botón aunque el
  // carrito ya tenga la línea (si no, el alta optimista mete el stepper en el
  // mismo frame del click y no se llega a ver nada).
  // "entering" = el stepper ya tomó el lugar y hace su entrada.
  const phase = useCartDropPhase(variant?.id);

  const playAndAdd = useCallback(() => {
    if (!variant?.id) {
      return;
    }
    // `startCartDrop` devuelve false si ya está corriendo: eso cubre el doble
    // click, que es lo que antes cubría el `disabled` (ver `addButtonDisabled`).
    if (!startCartDrop(variant.id)) {
      return;
    }
    // `skipAnimation` apaga el vuelo de la miniatura al ícono del carrito: ese
    // vuelo pisa esta coreografía (y en el quick view termina cerrando el
    // modal). Acá el feedback es el botón y el stepper que lo releva.
    handleAddToCart({ skipAnimation: true });
  }, [handleAddToCart, variant?.id]);

  // Tirar al tacho la última unidad. Sólo acá: con cantidad > 1 el control es
  // un "−" y la línea no desaparece, así que no hay nada que tirar.
  const trashAndRemove = useCallback(() => {
    if (!variant?.id || !startCartTrash(variant.id)) {
      return;
    }
    onRemove();
  }, [onRemove, variant?.id]);

  // Durante la animación el botón manda, aunque la línea ya esté en el carrito;
  // y al revés al sacar: el stepper se retiene aunque la línea ya no esté.
  const showQuantityControls =
    (quantityInCart > 0 || phase === "trashing") &&
    inStock &&
    phase !== "dropping";

  // Un solo criterio para los tres layouts (PDP, inline, sticky mobile).
  const addDisabled = !(inStock && variant) || isAdding || blocked;
  // Mientras corre la animación NO marcamos el botón como deshabilitado: el
  // alta en vuelo prende `isAdding` y el `disabled:opacity-50` lo dejaría
  // apagado justo durante la coreografía. El doble click lo corta la guarda de
  // `playAndAdd`.
  const addButtonDisabled = addDisabled && phase !== "dropping";
  const addLabel = !inStock
    ? "Sin Stock"
    : blocked
      ? blockedLabel
      : "Agregar al carrito";
  // En la barra fija de la PDP mobile el botón compite con la miniatura, el
  // título y el precio en ~360px: "Agregar al carrito" obligaba a truncar el
  // título. En mobile va "Agregar" (el ícono de carrito ya dice a dónde); en
  // desktop se mantiene el texto completo. "Sin Stock" y el label de bloqueo
  // no se acortan porque no son la acción sino un estado.
  const isDefaultAddLabel = addLabel === "Agregar al carrito";

  if (productPage) {
    return (
      <>
        {/*
          Sin spacer en flujo: este bloque vive dentro de la columna de info del
          PDP, así que reservar alto acá abría un hueco entre el precio y los
          beneficios cuando el producto no tiene descripción. El alto de la barra
          fija lo reserva el padding inferior del template del PDP.
        */}
        <div
          className="fixed inset-x-0 bottom-0 z-30"
          {...floatingObstacle("add-to-cart", FLOATING_LAYER.edgeBar)}
        >
          <div
            className="border-gray-200 border-t bg-white shadow-[0_-10px_30px_rgba(15,23,42,0.08)]"
            data-testid="product-page-cart-controls"
          >
            <div
              className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:px-8 lg:py-5"
            >
              {/* Product info */}
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-gray-100 lg:h-[72px] lg:w-[72px]">
                  <img
                    alt={product.title}
                    className="h-full w-full object-cover"
                    onError={handleImageError}
                    src={
                      product.thumbnail ||
                      product.images?.[0]?.url ||
                      PLACEHOLDER_IMAGE
                    }
                  />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-gray-900 text-base lg:text-lg">
                    {product.title}
                  </span>
                  {displayPrice && (
                    <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                      {isPriceSale && displayOriginalPrice && (
                        <span className="min-w-0 truncate text-gray-400 text-[11px] line-through">
                          $ {displayOriginalPrice}
                        </span>
                      )}
                      <span
                        className={clx("text-base font-bold lg:text-lg", {
                          "text-red-600": isPriceSale,
                          "text-gray-600": !isPriceSale,
                        })}
                      >
                        $ {displayPrice}
                      </span>
                      {overrideSurcharge && (
                        <span className="min-w-0 truncate text-[11px] text-gray-500">
                          incluye +$ {overrideSurcharge} de entonado
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cart controls */}
              <div
                className="flex flex-shrink-0 items-center gap-2"
                ref={addButtonRef as React.LegacyRef<HTMLDivElement>}
              >
                {showBuyNow && (
                  <button
                    className="hidden h-12 min-w-[160px] items-center justify-center rounded-xl border border-gray-900 bg-gray-900 px-7 font-semibold text-base text-white transition-colors hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 sm:flex lg:h-14"
                    data-testid="buy-now-button"
                    disabled={addDisabled}
                    onClick={handleBuyNow}
                    type="button"
                  >
                    Comprar ahora
                  </button>
                )}
                {showQuantityControls ? (
                  <div
                    className={clx(
                      "flex items-center rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity",
                      { "opacity-70": isUpdatingQuantity && phase !== "trashing" },
                      (phase === "entering" || phase === "returning") &&
                        "animate-atc-stepper-in motion-reduce:animate-none",
                      phase === "trashing" && "relative overflow-hidden",
                    )}
                  >
                    {phase === "trashing" && <CartTrashFlight />}
                    {quantityInCart === 1 || phase === "trashing" ? (
                      <button
                        aria-label="Eliminar producto"
                        className={clx(
                          "flex h-12 w-12 items-center justify-center rounded-l-xl bg-red-600 text-white transition-colors hover:bg-red-700 lg:h-14 lg:w-14",
                          phase === "trashing" && "pointer-events-none opacity-0",
                        )}
                        onClick={trashAndRemove}
                        type="button"
                      >
                        <TrashIcon className="h-5 w-5 text-white" />
                      </button>
                    ) : (
                      <button
                        aria-label="Reducir cantidad"
                        className="flex h-12 w-12 items-center justify-center font-semibold text-gray-700 text-xl transition-colors hover:bg-gray-100 lg:h-14 lg:w-14"
                        onClick={onDecrement}
                        type="button"
                      >
                        −
                      </button>
                    )}
                    <div className={clx("w-10 text-center font-semibold text-base tabular-nums lg:w-12 lg:text-lg", phase === "trashing" && "animate-atc-trash-fade motion-reduce:animate-none",)}>
                      {quantityInCart}
                    </div>
                    <button
                      aria-label="Incrementar cantidad"
                      className={clx("flex h-12 w-12 items-center justify-center font-semibold text-gray-700 text-xl transition-colors hover:bg-gray-100 lg:h-14 lg:w-14", phase === "trashing" && "animate-atc-trash-fade motion-reduce:animate-none",)}
                      onClick={onIncrement}
                      disabled={!canIncrement}
                      title={
                        canIncrement ? undefined : "No hay más stock disponible"
                      }
                      type="button"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className={clx(
                      "relative flex h-12 min-w-[132px] items-center justify-center gap-2 overflow-hidden rounded-xl bg-[--primary-color] px-5 font-semibold text-base text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 lg:h-14 lg:min-w-[220px] lg:px-9",
                      phase === "returning" &&
                        "animate-atc-stepper-in motion-reduce:animate-none",
                    )}
                    data-testid="product-page-cart-button"
                    disabled={addButtonDisabled}
                    onClick={playAndAdd}
                    type="button"
                  >
                    <CartDropFlight playing={phase === "dropping"}>
                      {isAdding ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      ) : (
                        <ShoppingCartIcon
                          aria-hidden="true"
                          className="h-5 w-5"
                        />
                      )}
                      {isDefaultAddLabel ? (
                        <>
                          <span className="lg:hidden">Agregar</span>
                          <span className="hidden lg:inline">{addLabel}</span>
                        </>
                      ) : (
                        addLabel
                      )}
                    </CartDropFlight>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (inline) {
    return (
      <div
        className="bg-white"
        data-testid="sticky-cart-bar"
      >
        <div className="mx-auto flex w-full items-center justify-end">
          {/* Cart controls */}
          <div
            className="flex w-full flex-shrink-0 items-center gap-2 sm:w-auto"
            ref={addButtonRef as React.LegacyRef<HTMLDivElement>}
          >
            {showBuyNow && (
              <button
                className="flex h-12 flex-1 items-center justify-center rounded-xl border border-gray-900 bg-gray-900 px-5 font-semibold text-sm text-white transition hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[190px] sm:flex-none"
                data-testid="buy-now-button"
                disabled={addDisabled}
                onClick={handleBuyNow}
                type="button"
              >
                Comprar ahora
              </button>
            )}
            {showQuantityControls ? (
              // No deshabilitamos los botones mientras sincroniza: el sync está
              // debounced (~500ms), y deshabilitar bloqueaba los clicks rápidos
              // justo cuando el debounce debería coalescerlos. Feedback = opacidad.
              <div
                className={clx(
                  "flex w-full items-center justify-between overflow-hidden rounded-xl border border-gray-200 transition-opacity sm:w-auto sm:justify-center",
                  { "opacity-70": isUpdatingQuantity && phase !== "trashing" },
                  (phase === "entering" || phase === "returning") &&
                        "animate-atc-stepper-in motion-reduce:animate-none",
                      phase === "trashing" && "relative overflow-hidden",
                )}
              >
                    {phase === "trashing" && <CartTrashFlight />}
                {quantityInCart === 1 || phase === "trashing" ? (
                  <button
                    aria-label="Eliminar producto"
                    className={clx(
                          "flex h-12 w-12 items-center justify-center rounded-l-xl bg-red-600 text-white transition-colors hover:bg-red-700",
                          phase === "trashing" && "pointer-events-none opacity-0",
                        )}
                    onClick={trashAndRemove}
                    type="button"
                  >
                    <TrashIcon className="h-5 w-5 text-white" />
                  </button>
                ) : (
                  <button
                    aria-label="Reducir cantidad"
                    className="flex h-12 w-12 items-center justify-center font-semibold text-gray-700 text-lg transition-colors hover:bg-gray-100"
                    onClick={onDecrement}
                    type="button"
                  >
                    −
                  </button>
                )}
                <div className={clx("w-12 text-center font-semibold text-base tabular-nums", phase === "trashing" && "animate-atc-trash-fade motion-reduce:animate-none",)}>
                  {quantityInCart}
                </div>
                <button
                  aria-label="Incrementar cantidad"
                  className={clx("flex h-12 w-12 items-center justify-center font-semibold text-gray-700 text-lg transition-colors hover:bg-gray-100", phase === "trashing" && "animate-atc-trash-fade motion-reduce:animate-none",)}
                  onClick={onIncrement}
                  disabled={!canIncrement}
                  title={canIncrement ? undefined : "No hay más stock disponible"}
                  type="button"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                className={clx(
                      "relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[--primary-color] px-6 font-semibold text-base text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-[230px]",
                      phase === "returning" &&
                        "animate-atc-stepper-in motion-reduce:animate-none",
                    )}
                data-testid="sticky-cart-button"
                disabled={addButtonDisabled}
                onClick={playAndAdd}
                type="button"
              >
                <CartDropFlight playing={phase === "dropping"}>
                  {isAdding ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  ) : (
                    <ShoppingCartIcon aria-hidden="true" className="h-4 w-4" />
                  )}
                  {addLabel}
                </CartDropFlight>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {show && <div className="h-12 lg:h-20" aria-hidden="true" />}
      <div
        className={clx("fixed inset-x-0 bottom-0 z-30 lg:hidden", {
          "pointer-events-none": !show,
        })}
        {...floatingObstacle("add-to-cart", FLOATING_LAYER.edgeBar)}
      >
        <Transition
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0 translate-y-full"
          enterTo="opacity-100 translate-y-0"
          leave="ease-in duration-300"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-full"
          show={show}
        >
          <div
            className="border-gray-200 border-t bg-white shadow-lg"
            data-testid="sticky-cart-bar"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
              {/* Product info */}
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-bold text-gray-900 text-sm lg:text-base">
                  {product.title}
                </span>
                {displayPrice && (
                  <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                    {isPriceSale && displayOriginalPrice && (
                      <span className="min-w-0 truncate text-gray-400 text-[11px] line-through">
                        $ {displayOriginalPrice}
                      </span>
                    )}
                    <span
                      className={clx("text-sm font-semibold", {
                        "text-red-600": isPriceSale,
                        "text-gray-600": !isPriceSale,
                      })}
                    >
                      $ {displayPrice}
                    </span>
                    {overrideSurcharge && (
                      <span className="min-w-0 truncate text-[11px] text-gray-500">
                        +$ {overrideSurcharge} entonado
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Cart controls */}
              <div
                className="flex flex-shrink-0 items-center gap-2"
                ref={addButtonRef as React.LegacyRef<HTMLDivElement>}
              >
                {showBuyNow && (
                  <button
                    className="hidden h-10 items-center rounded-lg border border-gray-900 bg-gray-900 px-4 font-medium text-sm text-white transition hover:bg-white hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
                    data-testid="buy-now-button"
                    disabled={addDisabled}
                    onClick={handleBuyNow}
                    type="button"
                  >
                    Comprar ahora
                  </button>
                )}
                {showQuantityControls ? (
                  <div
                    className={clx(
                      "flex items-center rounded-lg border border-gray-200 transition-opacity",
                      { "opacity-70": isUpdatingQuantity && phase !== "trashing" },
                      (phase === "entering" || phase === "returning") &&
                        "animate-atc-stepper-in motion-reduce:animate-none",
                      phase === "trashing" && "relative overflow-hidden",
                    )}
                  >
                    {phase === "trashing" && <CartTrashFlight />}
                    {quantityInCart === 1 || phase === "trashing" ? (
                      <button
                        aria-label="Eliminar producto"
                        className={clx(
                          "flex h-10 w-10 items-center justify-center rounded-l-lg bg-red-600 text-white transition-colors hover:bg-red-700 lg:h-11 lg:w-11",
                          phase === "trashing" && "pointer-events-none opacity-0",
                        )}
                        onClick={trashAndRemove}
                        type="button"
                      >
                        <TrashIcon className="h-5 w-5 text-white" />
                      </button>
                    ) : (
                      <button
                        aria-label="Reducir cantidad"
                        className="flex h-10 w-10 items-center justify-center font-semibold text-gray-700 text-lg transition-colors hover:bg-gray-100 lg:h-11 lg:w-11"
                        onClick={onDecrement}
                        type="button"
                      >
                        −
                      </button>
                    )}
                    <div className={clx("w-8 text-center font-semibold text-sm tabular-nums lg:w-10 lg:text-base", phase === "trashing" && "animate-atc-trash-fade motion-reduce:animate-none",)}>
                      {quantityInCart}
                    </div>
                    <button
                      aria-label="Incrementar cantidad"
                      className={clx("flex h-10 w-10 items-center justify-center font-semibold text-gray-700 text-lg transition-colors hover:bg-gray-100 lg:h-11 lg:w-11", phase === "trashing" && "animate-atc-trash-fade motion-reduce:animate-none",)}
                      onClick={onIncrement}
                      disabled={!canIncrement}
                      title={
                        canIncrement ? undefined : "No hay más stock disponible"
                      }
                      type="button"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    className={clx(
                      "relative flex h-10 items-center gap-2 overflow-hidden rounded-lg bg-[--primary-color] px-5 font-medium text-sm text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 lg:h-11 lg:px-6 lg:text-base",
                      phase === "returning" &&
                        "animate-atc-stepper-in motion-reduce:animate-none",
                    )}
                    data-testid="sticky-cart-button"
                    disabled={addButtonDisabled}
                    onClick={playAndAdd}
                    type="button"
                  >
                    <CartDropFlight playing={phase === "dropping"}>
                      {isAdding ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                      ) : (
                        <ShoppingCartIcon
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      )}
                      {addLabel}
                    </CartDropFlight>
                  </button>
                )}
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </>
  );
};

export default MobileActions;
