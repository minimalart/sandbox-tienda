import { getLegalPage } from '@lib/data/legal-pages';
import { canonicalUrl } from '@lib/util/site-url';
import type { Metadata } from 'next';

/**
 * Metadata de /legal/conditions.
 *
 * Vive en el layout y no en `page.tsx` por historia: la página era `'use client'` y un
 * componente cliente no puede exportar `metadata`. Ya no lo es, pero se queda acá —
 * mover las tres a su `page.tsx` sería un cambio sin efecto visible. Sin esto la
 * página heredaba el título y la descripción del root layout, compartidos con las
 * otras dos legales y con /account: cuatro URLs con el mismo `<title>` y la misma meta
 * description (auditoría del 19/08).
 *
 * El título y la descripción salen del texto EDITADO en el backoffice, con el literal
 * de siempre como fallback. Sin esto, un cliente que reescribe su política de
 * privacidad la publica con el `<title>` de otro texto. `getLegalPage` está envuelto
 * en `cache()`, así que este fetch y el de la página son uno solo.
 */
export async function generateMetadata(): Promise<Metadata> {
	const page = await getLegalPage('conditions');
	return {
		title: page?.title || 'Términos y condiciones',
		description: page?.seo_description || 'Condiciones de uso del sitio y de compra: precios, stock, formas de pago, envíos y garantías.',
		alternates: { canonical: await canonicalUrl('/legal/conditions') },
	};
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
