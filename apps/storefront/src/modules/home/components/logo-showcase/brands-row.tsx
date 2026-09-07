'use client';

import type { StoreBrand } from '@lib/data/brands';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import ScrollCarousel from '@modules/common/components/scroll-carousel';
import { useLayoutEffect, useRef, useState } from 'react';
import { BrandLogo, brandHref } from './brand-card';

const CARD_CLASS = 'group flex w-[180px] min-w-[180px] flex-none flex-col items-center gap-2';

const BrandCard = ({ brand }: { brand: StoreBrand }) => (
	<LocalizedClientLink className={CARD_CLASS} href={brandHref(brand)}>
		<div className='flex h-[110px] w-full items-center justify-center rounded-[24px] border border-transparent bg-[#F3F3F3] shadow-sm transition-all duration-200 group-hover:-translate-y-1 group-hover:border-[--primary-color] group-hover:bg-white group-hover:shadow-[0_14px_30px_rgba(0,128,177,0.18)]'>
			<BrandLogo brand={brand} className='p-4 transition-transform duration-200 group-hover:scale-110' />
		</div>
		{/* Solo logo: el nombre queda en el alt de la imagen para accesibilidad. */}
	</LocalizedClientLink>
);

/**
 * Single-row brand strip: if all brands fit in the container they are
 * rendered centered; if they overflow, the row becomes a scroll carousel.
 * Never wraps to a second line.
 *
 * El contenedor scrolleable lleva padding vertical propio (`pt-2 pb-8`) porque
 * `overflow-x-auto` también recorta en el eje Y: sin ese aire, el hover (que
 * levanta la tarjeta 4px y proyecta una sombra de 30px) quedaba cortado.
 */
const BrandsRow = ({ brands }: { brands: StoreBrand[] }) => {
	const measureRef = useRef<HTMLDivElement>(null);
	const [overflowing, setOverflowing] = useState(false);

	useLayoutEffect(() => {
		const el = measureRef.current;

		if (!el) {
			return;
		}

		const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);

		check();

		const observer = new ResizeObserver(check);

		observer.observe(el);

		return () => observer.disconnect();
	}, [brands.length]);

	return (
		<div>
			{/* Hidden measurement row: always rendered so we can detect fit/overflow in both directions */}
			<div aria-hidden='true' className='pointer-events-none invisible h-0 overflow-hidden'>
				<div className='flex flex-nowrap gap-3' ref={measureRef}>
					{brands.map((brand) => (
						<div className={CARD_CLASS} key={`measure-${brand.id}`}>
							<div className='h-[110px] w-full' />
						</div>
					))}
				</div>
			</div>

			{overflowing ? (
				<ScrollCarousel
					containerClassName='gap-3 px-1 pt-2 pb-8'
					// Flechas a la derecha: sin `title` el `justify-between` por
					// defecto las empujaba al borde izquierdo.
					headerClassName='mb-2 flex items-center justify-end'
					snap
				>
					{brands.map((brand) => (
						<BrandCard brand={brand} key={brand.id} />
					))}
				</ScrollCarousel>
			) : (
				<div className='flex flex-nowrap justify-center gap-3 px-1 pt-2 pb-8'>
					{brands.map((brand) => (
						<BrandCard brand={brand} key={brand.id} />
					))}
				</div>
			)}
		</div>
	);
};

export default BrandsRow;
