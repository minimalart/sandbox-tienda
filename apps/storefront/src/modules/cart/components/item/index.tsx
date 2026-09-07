"use client";

import { ChevronDownIcon } from "@heroicons/react/16/solid";
import {
  CheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { isLineItemInStock } from "@lib/util/is-line-item-in-stock";
import { getLineItemMaxQuantity } from "@lib/util/max-purchasable-quantity";
import { updateLineItem } from "@lib/data/cart";
import type { HttpTypes } from "@medusajs/types";
import ErrorMessage from "@modules/checkout/components/error-message";
import DisneyBadge from "@modules/common/components/disney-badge";
import LineItemOptions from "@modules/common/components/line-item-options";
import LineItemUnitPrice from "@modules/common/components/line-item-unit-price";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import TransportConditionBadge from "@modules/common/components/transport-condition-badge";
import Thumbnail from "@modules/products/components/thumbnail";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ItemProps = {
  item: HttpTypes.StoreCartLineItem;
  type?: "full" | "preview";
  currencyCode: string;
  suppressDisneyPromo?: boolean;
};

const Item = ({
  item,
  type = "full",
  currencyCode,
  suppressDisneyPromo = false,
}: ItemProps) => {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const changeQuantity = async (quantity: number) => {
    setError(null);
    setUpdating(true);

    await updateLineItem({
      lineId: item.id,
      quantity,
    })
      .then(() => {
        router.refresh();
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setUpdating(false);
      });
  };

  // Tope del selector. Este item NO pasa por el cart store (llama a
  // `updateLineItem` directo), así que el clamp del store no lo cubre: el techo
  // lo resolvemos acá con el stock real por variante que trae el carrito
  // enriquecido. Sin techo conocido, el histórico 10 sigue siendo el tope de la
  // lista (es un `<select>`, no un stepper: no hace falta ofrecer más).
  const stockCeiling = getLineItemMaxQuantity(item);
  const maxQuantity = stockCeiling ?? 10;

  const inStock = isLineItemInStock(item);

  const imageSize = type === "preview" ? "size-16" : "size-24 sm:size-48";
  const containerClasses =
    type === "preview"
      ? "flex gap-4 py-4 px-4 bg-gray-50 rounded-2xl border border-gray-100"
      : "flex py-6 sm:py-10";

  const displayThumbnail =
    item.thumbnail ||
    item.variant?.product?.thumbnail ||
    item.variant?.product?.images?.[0]?.url ||
    undefined;

  return (
    <li
      className={`${containerClasses}${!inStock ? " opacity-70 ring-1 ring-red-200 rounded-lg" : ""}`}
      data-testid="product-row"
    >
      <div className="shrink-0">
        <LocalizedClientLink href={`/products/${item.product_handle}`}>
          <Thumbnail
            className={`${imageSize} rounded-md object-cover`}
            images={item.variant?.product?.images}
            size="square"
            thumbnail={displayThumbnail}
          />
        </LocalizedClientLink>
      </div>

      <div className="ml-4 flex flex-1 flex-col justify-between sm:ml-6">
        <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm">
                <LocalizedClientLink
                  className="font-medium text-gray-700 transition-colors duration-200 ease-in-out hover:text-gray-800"
                  data-testid="product-title"
                  href={`/products/${item.product_handle}`}
                >
                  {item.product_title}
                </LocalizedClientLink>
              </h3>
              <DisneyBadge productId={item.product_id} />
            </div>
            <TransportConditionBadge className="mt-1.5" item={item} />
            <div className="mt-1 !hidden flex text-sm">
              <LineItemOptions
                data-testid="product-variant"
                variant={item.variant}
                metadata={item.metadata}
              />
            </div>
            <div className="mt-1 font-medium text-gray-900 text-sm">
              <LineItemUnitPrice
                currencyCode={currencyCode}
                item={item}
                suppressDiscount={suppressDisneyPromo}
                style="tight"
              />
            </div>
          </div>

          <div className="mt-4 sm:mt-0 sm:pr-9">
            {type === "preview" ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-700 text-sm">
                  Cantidad: {item.quantity}
                </span>
                {!inStock && (
                  <button
                    className="inline-flex items-center p-1 text-gray-400 transition-colors duration-200 ease-in-out hover:text-red-600"
                    data-testid="product-delete-button"
                    onClick={async () => {
                      setUpdating(true);
                      const { deleteLineItem } = await import("@lib/data/cart");
                      await deleteLineItem(item.id)
                        .then(() => router.refresh())
                        .finally(() => setUpdating(false));
                    }}
                    type="button"
                  >
                    <span className="sr-only">Eliminar</span>
                    <XMarkIcon aria-hidden="true" className="size-5" />
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="inline-grid w-full max-w-16 grid-cols-1">
                  <select
                    aria-label={`Quantity, ${item.product_title}`}
                    className="-outline-offset-1 focus:-outline-offset-2 col-start-1 row-start-1 appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 outline-1 outline-gray-300 transition-all duration-200 ease-in-out focus:outline-2 focus:outline-[--primary-color] sm:text-sm/6 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="product-select-button"
                    disabled={!inStock}
                    onChange={(e) =>
                      changeQuantity(Number.parseInt(e.target.value))
                    }
                    value={item.quantity}
                  >
                    {Array.from(
                      { length: Math.min(maxQuantity, 10) },
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1}
                        </option>
                      ),
                    )}
                  </select>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4"
                  />
                </div>

                <div className="absolute top-0 right-0">
                  <button
                    className="-m-2 inline-flex p-2 text-gray-400 transition-colors duration-200 ease-in-out hover:text-gray-500"
                    data-testid="product-delete-button"
                    onClick={async () => {
                      setUpdating(true);
                      const { deleteLineItem } = await import("@lib/data/cart");
                      await deleteLineItem(item.id)
                        .then(() => router.refresh())
                        .finally(() => setUpdating(false));
                    }}
                    type="button"
                  >
                    <span className="sr-only">Eliminar</span>
                    <XMarkIcon aria-hidden="true" className="size-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p
          className={`mt-4 flex space-x-2 text-sm ${inStock ? "text-gray-700" : "text-red-600 font-medium"}`}
        >
          {inStock ? (
            <CheckIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-green-500"
            />
          ) : (
            <ExclamationTriangleIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-red-500"
            />
          )}
          <span>{inStock ? "En stock" : "Sin stock"}</span>
        </p>
        <ErrorMessage data-testid="product-error-message" error={error} />
      </div>
    </li>
  );
};

export default Item;
