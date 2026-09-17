"use client";

import Link from "next/link";
import type { StorefrontBundleDetail } from "@lib/data/bundles";
import { formatPrice } from "../lib/resolve-variant";

/**
 * Landing card for a bundle (PRD §40). Renders the bundle title, total item
 * count, how many are pre-resolved vs. configurable, an optional "from" price
 * (only when it can be computed correctly, per PRD §40), and the CTA that
 * enters the wizard.
 */
export const BundleEntry = ({
  bundle,
  href,
}: {
  bundle: StorefrontBundleDetail;
  href: string;
}) => {
  const totalItems = bundle.items.length;
  const configurableCount = bundle.items.filter((i) => !i.auto_resolved_variant_id).length;
  const autoCount = totalItems - configurableCount;

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{bundle.title}</h1>
      <p className="text-sm text-neutral-600">
        Este kit incluye {totalItems} productos.
        {autoCount > 0 && (
          <> Ya seleccionamos automáticamente {autoCount} productos que tienen una única opción.</>
        )}
        {configurableCount > 0 && <> Necesitamos que elijas {configurableCount}.</>}
      </p>
      {bundle.pricing.from && (
        <p className="text-lg font-medium">
          Desde {formatPrice(bundle.pricing.from.amount, bundle.pricing.from.currency_code)}
        </p>
      )}
      <Link
        href={href}
        className="inline-flex items-center rounded-full bg-[--primary-color] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[--primary-color-dark]"
      >
        Armar mi kit
      </Link>
    </div>
  );
};
