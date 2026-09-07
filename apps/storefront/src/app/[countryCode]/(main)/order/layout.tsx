import type { Metadata } from 'next';

/**
 * `noindex` para TODO /order (confirmación y transferencia de pedido).
 *
 * Son URLs de una sola persona y de un solo pedido. El `robots.txt` las bloquea, pero
 * una URL bloqueada que Google descubre por un link puede indexarse sin contenido; el
 * meta es lo que lo evita. Los títulos de cada página siguen ganando: `metadata` de un
 * layout se MERGEA con el de la página, no la reemplaza.
 */
export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
	return <>{children}</>;
}
