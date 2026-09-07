"use client";

import NewBadge from "@modules/common/components/new-badge";

type PdpPromoBadgeProps = {
  // Producto ya enriquecido con datos de promo de Typesense (productWithDiscount).
  product?: any;
  isNew?: boolean;
};

/**
 * Badge para la PDP sobre la imagen. El badge de promo ahora vive únicamente
 * junto al precio (ProductPrice), así que acá dejamos solo el "Nuevo" cuando
 * corresponde para no duplicar la etiqueta de promoción.
 */
export default function PdpPromoBadge({ isNew }: PdpPromoBadgeProps) {
  if (!isNew) return null;

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1">
      <NewBadge />
    </div>
  );
}
