"use client";

import LocalizedClientLink from "@modules/common/components/localized-client-link";
import type { HttpTypes } from "@medusajs/types";

type MoreProductCardProps = {
  item: {
    image: string;
    label: string;
    backgroundColor?: string;
    categoryId: string;
  };
  href: string;
  product?: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
};

export default function MoreProductCard({ item, href }: MoreProductCardProps) {
  return (
    <LocalizedClientLink
      href={href}
      className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 px-6 py-4 shadow-sm transition-all hover:shadow-md"
      style={{ backgroundColor: item.backgroundColor || "#F6F7FB" }}
    >
      <div className="h-24 w-24 overflow-hidden rounded-xl">
        <img
          src={item.image}
          alt={item.label}
          // mix-blend-multiply funde el fondo blanco de la foto con el color
          // (claro) de la card, "eliminándolo" sin tocar el asset.
          className="h-full w-full object-contain mix-blend-multiply"
          height={96}
          width={96}
        />
      </div>
      <span className="whitespace-nowrap text-center text-sm font-medium leading-tight text-gray-900">
        {item.label}
      </span>
    </LocalizedClientLink>
  );
}
