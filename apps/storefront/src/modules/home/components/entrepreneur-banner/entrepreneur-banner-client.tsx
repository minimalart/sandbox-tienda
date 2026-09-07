"use client";

import type { HttpTypes } from "@medusajs/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ProductQuickViewModal from "@modules/common/components/quick-view-modal";
import { useState } from "react";

type EntrepreneurBannerClientProps = {
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
};

export default function EntrepreneurBannerClient({
  product,
  region,
}: EntrepreneurBannerClientProps) {
  const [open, setOpen] = useState(false);

  const featuredImage = product.images?.[0];

  return (
    <>
      <div className="text-center pt-4">
        <LocalizedClientLink
          href="/revendedores/#elegir-kit"
          target="_blank"
          className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 font-[600] text-gray-900 text-[16px] leading-[24px] transition-all hover:shadow-lg"
        >
          Ver productos
        </LocalizedClientLink>
      </div>

      <ProductQuickViewModal
        product={product}
        region={region}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
