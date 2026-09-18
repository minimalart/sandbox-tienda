import type { Metadata } from 'next';
import { getSitesHubRequestOrigin, listSitesHubPage } from '@lib/site-config/list-sites';
import { canonicalUrl } from '@lib/util/site-url';
import SitesDirectory from './sites-directory';

export async function generateMetadata(): Promise<Metadata> {
  const [origin, page] = await Promise.all([
    getSitesHubRequestOrigin(),
    listSitesHubPage().catch(() => null),
  ]);
  const title = page?.config.title ?? 'Tiendas';
  const description = page?.config.description ?? 'Encontrá tu tienda.';
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: origin ? `${origin}/` : await canonicalUrl('/tiendas') },
    openGraph: { title, description, siteName: page?.config.name ?? 'Tiendas' },
    twitter: { title, description },
    robots: { index: true, follow: true },
  };
}

export default async function SitesIndex() {
  const page = await listSitesHubPage().catch(() => null);
  if (!page)
    return (
      <main className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="text-3xl font-semibold">Tiendas</h1>
        <p role="alert" className="mt-6">
          No pudimos cargar el directorio. Volvé a intentar en unos minutos.
        </p>
        <a className="mt-6 inline-block underline" href="">
          Volver a intentar
        </a>
      </main>
    );
  return <SitesDirectory initialPage={page} />;
}
