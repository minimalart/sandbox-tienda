"use client";

import type { HttpTypes } from "@medusajs/types";
import { Text } from "@medusajs/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ProductQuickViewModal from "@modules/common/components/quick-view-modal";
import Thumbnail from "@modules/products/components/thumbnail";
import { isTintableProduct } from "@lib/util/tinting";
import { useState } from "react";
import type { VariantPrice } from "types/global";
import PreviewPrice from "./price";

interface ProductPreviewClientProps {
  product: HttpTypes.StoreProduct;
  pricedProduct: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
  price?: VariantPrice | null;
}

const ProductPreviewClient = ({
  product,
  pricedProduct,
  region,
  price,
}: ProductPreviewClientProps) => {
  const [open, setOpen] = useState(false);

  // Las gift cards se personalizan en su propia página; no tiene sentido el
  // quick view (no puede resolver diseño/monto/destinatario/entrega).
  const isGiftCard = (product as { is_giftcard?: boolean }).is_giftcard === true;

  // Idem las bases entonables: el color es obligatorio y el selector vive en el
  // PDP, así que el quick view sólo podría agregar una base sin entonar.
  const isTintable = isTintableProduct(product as never);
  const requiresConfigurator = isGiftCard || isTintable;

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const cardBody = (
    <>
      <Thumbnail
        images={product.images}
        size="full"
        thumbnail={product.thumbnail}
      />
      <div className="mt-4 flex items-start justify-between">
        <Text
          className="font-medium text-base text-ui-fg-subtle"
          data-testid="product-title"
        >
          {product.title}
        </Text>
        <div className="ml-2 flex items-center gap-x-2">
          {price && <PreviewPrice price={price} />}
        </div>
      </div>
      <p className="mt-2 text-[--primary-color] text-sm">
        {isGiftCard
          ? "Personalizar gift card"
          : isTintable
            ? "Elegí tu color"
            : "Clic para vista rápida"}
      </p>
    </>
  );

  return (
    <>
      <div
        className="group interactive-elevate rounded-3xl border border-transparent bg-white/70 p-3 transition-colors duration-200 ease-in-out hover:border-cerulean-blue-200"
        data-testid="product-wrapper"
      >
        {requiresConfigurator ? (
          <LocalizedClientLink
            className="block w-full text-left transition-colors duration-200 ease-in-out hover:text-cerulean-blue-700"
            href={`/products/${product.handle}`}
          >
            {cardBody}
          </LocalizedClientLink>
        ) : (
          <button
            className="w-full text-left transition-colors duration-200 ease-in-out hover:text-cerulean-blue-700"
            onClick={handleOpen}
            type="button"
          >
            {cardBody}
          </button>
        )}
        <LocalizedClientLink
          className="mt-3 block text-center font-semibold text-gray-700 text-sm transition-colors duration-200 ease-in-out hover:text-cerulean-blue-600"
          href={`/products/${product.handle}`}
        >
          Ver detalles completos
        </LocalizedClientLink>
      </div>

      {!requiresConfigurator && (
        <ProductQuickViewModal
          onClose={handleClose}
          open={open}
          product={pricedProduct}
          region={region}
        />
      )}
    </>
  );
};

export default ProductPreviewClient;
