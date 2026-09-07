import type { StoreBrand } from '@lib/data/brands';

/** Link al listado filtrado por la marca (compartido por los 3 layouts). */
export const brandHref = (brand: StoreBrand) =>
	`/store?brand=${encodeURIComponent(brand.name)}`;

/**
 * Logo de marca. `mix-blend-multiply` funde el blanco del PNG con el fondo de
 * la tarjeta (los logos vienen con fondo blanco, no transparente).
 */
export const BrandLogo = ({
	brand,
	className,
}: {
	brand: StoreBrand;
	className?: string;
}) => (
	<img
		alt={brand.name}
		className={`h-full w-full object-contain mix-blend-multiply ${className ?? ''}`}
		loading='lazy'
		src={brand.image}
	/>
);
