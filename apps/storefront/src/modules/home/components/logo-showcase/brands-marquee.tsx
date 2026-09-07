'use client';

import type { StoreBrand } from '@lib/data/brands';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { BrandLogo, brandHref } from './brand-card';

/** Velocidad constante (px/s) independiente de la cantidad de marcas. */
const SPEED_PX_PER_SECOND = 42;
/** Ancho de tarjeta + separación, en px (w-[190px] + mr-3). */
const SLOT_WIDTH = 202;
/** Mínimo de tarjetas por set: con pocas marcas la pista no llenaría el ancho. */
const MIN_SET_SIZE = 10;

/**
 * Marquesina infinita: la pista se desplaza sola de forma continua. Los logos
 * van en escala de grises y toman color al pasar el mouse; el movimiento se
 * pausa mientras el cursor está sobre la sección.
 *
 * La animación traslada la pista un -50%, así que la pista se arma con el set
 * repetido DOS veces: al llegar a la mitad la posición coincide exactamente con
 * el inicio y el loop no tiene salto.
 */
const BrandsMarquee = ({ brands }: { brands: StoreBrand[] }) => {
	if (!brands.length) {
		return null;
	}

	// Repite el set hasta cubrir el ancho de pantalla más ancho razonable.
	const set: StoreBrand[] = [];

	while (set.length < MIN_SET_SIZE) {
		set.push(...brands);
	}

	const durationSeconds = Math.max(
		20,
		Math.round((set.length * SLOT_WIDTH) / SPEED_PX_PER_SECOND),
	);

	return (
		<div className='brands-marquee relative overflow-hidden'>
			{/* Degradados en los bordes: la pista entra y sale sin corte seco. */}
			<div className='pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-24' />
			<div className='pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-24' />

			{/* La separación va como `mr-3` de cada tarjeta y NO como `gap`: con
			    `gap` el ancho de la pista es 2n·card + (2n−1)·gap, y el -50% del
			    keyframe no coincide con el período real (n·(card+gap)) → salto. */}
			<div
				className='brands-marquee-track flex w-max py-2'
				style={{ animationDuration: `${durationSeconds}s` }}
			>
				{[...set, ...set].map((brand, index) => (
					<LocalizedClientLink
						aria-hidden={index >= set.length ? 'true' : undefined}
						// Sin sombra: el contenedor necesita `overflow-hidden` para la
						// marquesina y la recortaría. El realce es el borde + el color.
						className='group mr-3 flex h-[110px] w-[190px] flex-none items-center justify-center rounded-[24px] border border-gray-100 bg-white transition-colors duration-300 hover:border-[--primary-color]'
						href={brandHref(brand)}
						key={`${brand.id}-${index}`}
						tabIndex={index >= set.length ? -1 : undefined}
					>
						<BrandLogo
							brand={brand}
							className='p-4 grayscale transition duration-300 group-hover:grayscale-0'
						/>
					</LocalizedClientLink>
				))}
			</div>
		</div>
	);
};

export default BrandsMarquee;
