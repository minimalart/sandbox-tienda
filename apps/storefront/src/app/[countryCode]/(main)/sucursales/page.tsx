import { getStoreLocations } from '@lib/data/store-locations';
import { getTenant } from '@lib/site-config/resolver';
import StoreLocationsTemplate from '@modules/store-locations/templates';
import { canonicalUrl } from '@lib/util/site-url';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
	const tenant = await getTenant();
	return {
		title: 'Sucursales',
		// El sufijo de marca lo pone el `title.template` del root layout: repetirlo acá
		// emitía `Página | Marca | Marca`.
		alternates: { canonical: await canonicalUrl('/sucursales') },
		description: 'Encontrá tu sucursal más cercana: dirección, horarios y formas de contacto.',
	};
}

export default async function StoreLocationsPage() {
	const locations = await getStoreLocations();

	// Marcador para que el template sports (sports-theme.css) pueda enderezar
	// bordes/sombras de esta página sin tocar el componente compartido.
	return (
		<div data-store-locator>
			<StoreLocationsTemplate locations={locations} />
		</div>
	);
}
