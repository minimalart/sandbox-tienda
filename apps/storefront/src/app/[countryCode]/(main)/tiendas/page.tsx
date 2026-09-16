import type { Metadata } from 'next';
import { listPublicSites, publicListingUrl, getSitesHubRequestOrigin } from '@lib/site-config/list-sites';
import { canonicalUrl } from '@lib/util/site-url';

export async function generateMetadata(): Promise<Metadata> {
  const hub = await getSitesHubRequestOrigin();
  return { title: 'Tiendas', description: 'Encontrá tu tienda y accedé a su catálogo.',
    alternates: { canonical: hub ? `${hub}/` : await canonicalUrl('/tiendas') },
    robots: { index: true, follow: true } };
}

export default async function SitesIndex() {
  const sites = await listPublicSites().catch(() => null);
  return <main className="mx-auto max-w-6xl px-6 py-16">
    <h1 className="text-3xl font-semibold tracking-tight">Encontrá tu tienda</h1>
    <p className="mt-3 text-base text-gray-600">Seleccioná una tienda para ver su catálogo.</p>
    {sites?.length ? <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {sites.map(site => <li key={site.slug}>
        <a href={publicListingUrl(site)} className="flex h-full items-center gap-5 rounded-xl border border-gray-200 bg-white p-6 transition hover:border-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
          {site.logo ? <img src={site.logo} alt="" className="h-16 w-16 shrink-0 object-contain" /> :
            <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-2xl">{site.name.slice(0, 1)}</span>}
          <span className="min-w-0"><span className="block break-words text-lg font-medium">{site.name}</span>
            <span className="mt-1 block text-sm text-gray-600">Visitar tienda →</span></span>
        </a>
      </li>)}
    </ul> : <p className="mt-10 rounded-xl border p-6">{sites ? 'Todavía no hay tiendas publicadas.' : 'No pudimos cargar las tiendas. Volvé a intentar en unos minutos.'}</p>}
  </main>;
}
