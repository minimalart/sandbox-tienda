import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { canonicalUrl } from '@lib/util/site-url';
import type { Metadata } from 'next';
import { getTintingCatalog, getTintingGate } from '@lib/data/tinting';
import { getTenant } from '@lib/site-config/resolver';
import ColorFinder from '@modules/tinting/components/color-finder';

/**
 * "Buscá tu color" — el flujo inverso del tintométrico: elegir el color primero
 * y ver con qué bases se logra, con opción de agregar al carrito ahí mismo.
 *
 * El flujo directo (elegir la base y después el color) sigue viviendo en el PDP:
 * son dos entradas al mismo sistema, para dos clientes distintos.
 *
 * La bajada y el conteo de colores los pone `ColorFinder`: cambian según el paso
 * (carta o resultado), así que no pueden vivir en el encabezado fijo. El
 * `Suspense` es obligatorio, no decorativo: el paso se lee de la query string
 * con `useSearchParams` y sin límite de suspensión Next no puede prerenderizar
 * la página.
 *
 * El contenedor NO es `content-container` (max-w-[1440px] px-6): el header usa
 * `max-w-7xl px-4 sm:px-6 lg:px-8`, así que la carta de colores se salía 80px por
 * cada lado del logo y del "Ingresar". Acá se repiten las clases del header para
 * que los bordes coincidan.
 */

export async function generateMetadata(): Promise<Metadata> {
	const tenant = await getTenant();
	return {
		title: 'Buscá tu color',
		// El sufijo de marca lo pone el `title.template` del root layout: repetirlo acá
		// emitía `Página | Marca | Marca`.
		alternates: { canonical: await canonicalUrl('/colores') },
		description:
			'Elegí un color de la carta y te mostramos con qué productos se logra, con el precio ya entonado.',
	};
}

export default async function TintingColorsPage() {
	/**
	 * Dos llaves, y CADA UNA APAGA DISTINTO (ver lib/data/tinting-gate.ts):
	 *
	 *  - feature apagada (la fila del sitio o el switch del ERP) → 404: la ruta no
	 *    existe para esta tienda.
	 *  - feature prendida y carta VACÍA → la página existe con su empty state. Ese
	 *    caso llegó a producción y devolvía 404, así que el hero que linkeaba acá
	 *    desde la home caía en not-found sin decir por qué. El motivo se loguea del
	 *    lado del server, no se le cuenta al cliente final.
	 */
	const gate = await getTintingGate();
	if (!gate.routeEnabled) notFound();

	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			<h1 className="mb-6 text-2xl font-semibold">Buscá tu color</h1>

			{gate.catalogReady ? (
				<Suspense
					fallback={<div className="h-96 animate-pulse rounded-lg bg-ui-bg-subtle" />}
				>
					<TintingColorsGrid />
				</Suspense>
			) : (
				<EmptyCatalog />
			)}
		</div>
	);
}

/** La carta. Separada para que el `Suspense` no envuelva también el empty state. */
async function TintingColorsGrid() {
	const catalog = await getTintingCatalog();
	return <ColorFinder colors={catalog.colors} />;
}

/**
 * Carta todavía sin cargar. No es un error del visitante ni hay nada que pueda
 * hacer, así que no se ofrece "reintentar": se le dice qué pasa y se lo devuelve a
 * la tienda.
 */
function EmptyCatalog() {
	return (
		<div className="rounded-lg border border-ui-border-base bg-ui-bg-subtle px-6 py-16 text-center">
			<p className="text-base font-medium text-ui-fg-base">
				Estamos preparando la carta de colores
			</p>
			<p className="mx-auto mt-2 max-w-md text-sm text-ui-fg-subtle">
				Todavía no hay colores para mostrar acá. Mientras tanto podés consultarnos
				por el color que buscás y lo entonamos igual.
			</p>
		</div>
	);
}
