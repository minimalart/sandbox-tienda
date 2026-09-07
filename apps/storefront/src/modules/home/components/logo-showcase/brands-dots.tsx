'use client';

import type { StoreBrand } from '@lib/data/brands';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import { useState } from 'react';
import { BrandLogo, brandHref } from './brand-card';

/** Marcas por página. Se acomodan en grilla responsive (3 / 4 / 6 columnas). */
const PER_PAGE = 6;

/**
 * Paginado con puntos: muestra las marcas en páginas limpias, sin flechas.
 * El hover aplica un overlay blanco con una sombra suave (estilo Rex), sin
 * subrayados ni desplazamientos, y los puntos quedan cerca de los logos.
 */
const BrandsDots = ({ brands }: { brands: StoreBrand[] }) => {
	const pages = Math.max(1, Math.ceil(brands.length / PER_PAGE));
	const [page, setPage] = useState(0);
	// Si cambia la cantidad de marcas, no dejar la página fuera de rango.
	const current = Math.min(page, pages - 1);

	return (
		<div>
			<div className='overflow-hidden'>
				<div
					className='flex transition-transform duration-500 ease-out'
					style={{ transform: `translateX(-${current * 100}%)` }}
				>
					{Array.from({ length: pages }).map((_, pageIndex) => (
						<div
							aria-hidden={pageIndex === current ? undefined : 'true'}
							// `px-2 py-3` da aire dentro del track (que es `overflow-hidden`
							// para el slide) para que la sombra del hover no se recorte.
							className='grid w-full shrink-0 grid-cols-3 gap-2 px-2 py-3 sm:grid-cols-4 md:grid-cols-6'
							key={`page-${pageIndex}`}
						>
							{brands
								.slice(pageIndex * PER_PAGE, pageIndex * PER_PAGE + PER_PAGE)
								.map((brand) => (
									<LocalizedClientLink
										className='group flex h-[96px] items-center justify-center rounded-2xl border border-transparent bg-transparent transition-all duration-200 hover:border-gray-100 hover:bg-white hover:shadow-[0_2px_10px_rgba(15,23,42,0.10)]'
										href={brandHref(brand)}
										key={brand.id}
										tabIndex={pageIndex === current ? undefined : -1}
									>
										<BrandLogo brand={brand} className='p-2' />
									</LocalizedClientLink>
								))}
						</div>
					))}
				</div>
			</div>

			{pages > 1 && (
				<div className='mt-3 flex items-center justify-center gap-2'>
					{Array.from({ length: pages }).map((_, dotIndex) => (
						<button
							aria-current={dotIndex === current}
							aria-label={`Ir a la página ${dotIndex + 1}`}
							className={`h-2 rounded-full transition-all duration-200 ${
								dotIndex === current
									? 'w-6 bg-[--primary-color]'
									: 'w-2 bg-gray-300 hover:bg-gray-400'
							}`}
							key={`dot-${dotIndex}`}
							onClick={() => setPage(dotIndex)}
							type='button'
						/>
					))}
				</div>
			)}
		</div>
	);
};

export default BrandsDots;
