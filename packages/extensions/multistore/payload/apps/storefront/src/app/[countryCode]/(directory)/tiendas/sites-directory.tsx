'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { SitesHubPage } from '@lib/site-config/sites-hub';

export default function SitesDirectory({ initialPage }: { initialPage: SitesHubPage }) {
  const config = initialPage.config;
  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const firstSearch = useRef(true);
  const activeQuery = useRef('');
  const load = useCallback(async (offset: number, term: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    busy.current = true;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/sites-directory?${new URLSearchParams({ offset: String(offset), q: term })}`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error('directory');
      const next: SitesHubPage = await response.json();
      if (controller.signal.aborted) return;
      activeQuery.current = term;
      setPage((previous) => ({
        ...next,
        sites:
          offset === 0
            ? next.sites
            : [
                ...previous.sites,
                ...next.sites.filter(
                  (site) => !previous.sites.some((item) => item.slug === site.slug)
                ),
              ],
      }));
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        busy.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    request.current?.abort();
    busy.current = true;
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      void load(0, query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query, load]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const element = sentinel.current;
    if (
      !element ||
      page.next_offset === null ||
      loading ||
      error ||
      query.trim() !== activeQuery.current ||
      !('IntersectionObserver' in window)
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !busy.current)
          void load(page.next_offset!, activeQuery.current);
      },
      { rootMargin: '200px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [page.next_offset, loading, error, query, load]);

  const brand = (footer = false) => {
    const logo = footer ? config.footer_logo : config.logo;
    return logo ? (
      <img src={logo} alt={config.name} className="h-9 max-w-[220px] object-contain object-left" />
    ) : (
      <span className="text-xl font-bold tracking-tight">{config.name ?? 'Tiendas'}</span>
    );
  };
  const ctaButton = (label?: string, url?: string) =>
    label && url ? (
      <a
        href={url}
        style={{ backgroundColor: config.accent, color: '#ffffff' }}
        className="inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-950 shadow-sm transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        {label}
      </a>
    ) : null;
  const cta = ctaButton(config.cta_label, config.cta_url);
  const colors = {
    backgroundColor: config.background || '#f5f2ff',
    color: config.foreground || '#100b35',
  };

  const sections: Record<string, ReactNode> = {
    DirectoryHeader: (
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5 lg:px-10">
        <a href="" aria-label={config.name}>
          {brand()}
        </a>
        {cta}
      </header>
    ),
    DirectoryHero: (
      <div style={colors}>
        <section
          aria-labelledby="directory-title"
          className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-16 pt-12 lg:grid-cols-2 lg:px-10 lg:pb-20 lg:pt-16"
        >
          <div>
            <h1
              id="directory-title"
              className="max-w-xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
            >
              {config.title}
            </h1>
            {config.description && (
              <p className="mt-5 max-w-lg text-base leading-relaxed opacity-80">
                {config.description}
              </p>
            )}
            <label className="mt-7 flex max-w-lg items-center gap-3 rounded-lg bg-white px-4 text-gray-500 shadow-sm focus-within:ring-2 focus-within:ring-violet-500">
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <span className="sr-only">{config.search_placeholder}</span>
              <input
                type="search"
                maxLength={200}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={config.search_placeholder}
                className="min-w-0 flex-1 border-0 bg-transparent py-4 text-sm text-gray-900 outline-none focus:ring-0"
              />
            </label>
          </div>
          {config.hero_image ? (
            <img
              src={config.hero_image}
              alt=""
              className="mx-auto max-h-[380px] w-full object-contain"
            />
          ) : (
            <div aria-hidden="true" className="grid grid-cols-2 gap-4 p-5 sm:p-8">
              {initialPage.sites.slice(0, 4).map((site, index) => (
                <div
                  key={site.slug}
                  className={`flex min-h-36 flex-col items-center justify-center gap-4 rounded-2xl bg-white p-5 text-center text-gray-900 shadow-xl ${index % 2 ? 'rotate-6 translate-y-4' : '-rotate-6'}`}
                >
                  {site.logo && <img src={site.logo} alt="" className="h-16 w-20 object-contain" />}
                  <span className="text-sm font-semibold">{site.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    ),
    DirectoryListing: (
      <section role="main" aria-labelledby="sites-title">
        <h2 id="sites-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          {config.list_title}
        </h2>
        <p aria-live="polite" className="mt-2 text-sm text-gray-500">
          {loading
            ? 'Buscando tiendas…'
            : `${page.count} ${page.count === 1 ? 'tienda' : 'tiendas'}`}
        </p>
        <ul
          aria-busy={loading}
          className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          {page.sites.map((site) => (
            <li key={site.slug}>
              <a
                href={site.url}
                className="group flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-5 text-center transition hover:-translate-y-1 hover:border-gray-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                {site.logo ? (
                  <img
                    src={site.logo}
                    alt=""
                    loading="lazy"
                    className="mb-5 h-16 w-24 object-contain"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl font-semibold"
                  >
                    {site.name.slice(0, 1)}
                  </span>
                )}
                <h3 className="text-sm font-semibold leading-snug sm:text-base">{site.name}</h3>
                <span style={{ color: config.accent }} className="mt-3 text-xs sm:text-sm">
                  Ir a la tienda <span aria-hidden="true">›</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        {!loading && !error && page.count === 0 && (
          <p className="py-12 text-gray-600">
            {query
              ? 'No encontramos tiendas con ese nombre.'
              : 'Todavía no hay tiendas publicadas.'}
          </p>
        )}
        <div ref={sentinel} className="h-6" />
        {error ? (
          <div role="alert" className="py-4 text-center">
            <p>No pudimos cargar las tiendas.</p>
            <button
              className="mt-3 rounded-lg border px-5 py-3"
              onClick={() => {
                void load(
                  query.trim() !== activeQuery.current ? 0 : (page.next_offset ?? 0),
                  query.trim()
                );
              }}
            >
              Volver a intentar
            </button>
          </div>
        ) : (
          page.next_offset !== null && (
            <div className="text-center">
              <button
                disabled={loading}
                className="rounded-lg border px-5 py-3 text-sm disabled:opacity-50"
                onClick={() => {
                  void load(page.next_offset!, activeQuery.current);
                }}
              >
                {loading ? 'Cargando…' : 'Cargar más tiendas'}
              </button>
            </div>
          )
        )}
      </section>
    ),
    DirectoryInvitation: config.cta_title ? (
      <section
        style={colors}
        className="grid items-center gap-8 rounded-xl px-7 py-12 sm:px-10 lg:grid-cols-2"
      >
        <div>
          <h2 className="text-3xl font-bold leading-tight">{config.cta_title}</h2>
          {config.cta_description && (
            <p className="mb-6 mt-4 leading-relaxed opacity-80">{config.cta_description}</p>
          )}
          {ctaButton(config.invitation_label, config.invitation_url)}
        </div>
        {config.cta_image && (
          <img
            src={config.cta_image}
            alt=""
            loading="lazy"
            className="mx-auto max-h-72 w-full object-contain"
          />
        )}
      </section>
    ) : null,
    DirectoryBenefits: (
      <section className="py-8 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">{config.benefits_title}</h2>
        {config.benefits_description && (
          <p className="mt-3 text-gray-500">{config.benefits_description}</p>
        )}
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {config.items?.map((item, index) => (
            <div key={index}>
              <span
                aria-hidden="true"
                style={{ backgroundColor: config.background, color: config.accent }}
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
              >
                {['◇', '♧', '☆', '♡'][index % 4]}
              </span>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-500">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    ),
    DirectoryFooter: (
      <footer id="contacto" className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            <div>
              {brand(true)}
              {config.footer_description && (
                <p className="mt-5 max-w-md text-sm leading-relaxed text-gray-500">
                  {config.footer_description}
                </p>
              )}
            </div>
            {(config.contact_email || config.address) && (
              <div>
                <h2 className="font-semibold">Contacto</h2>
                {config.contact_email && (
                  <a
                    className="mt-5 block break-words text-sm text-gray-500"
                    href={`mailto:${config.contact_email}`}
                  >
                    {config.contact_email}
                  </a>
                )}
                {config.address && <p className="mt-4 text-sm text-gray-500">{config.address}</p>}
              </div>
            )}
            {(config.privacy_url || config.terms_url) && (
              <nav aria-label="Legales">
                <h2 className="font-semibold">Legales</h2>
                {config.privacy_url && (
                  <a className="mt-5 block text-sm text-gray-500" href={config.privacy_url}>
                    Política de privacidad
                  </a>
                )}
                {config.terms_url && (
                  <a className="mt-4 block text-sm text-gray-500" href={config.terms_url}>
                    Términos y condiciones
                  </a>
                )}
              </nav>
            )}
          </div>
          <p className="mt-12 border-t border-gray-100 pt-7 text-xs text-gray-500">
            {config.name} © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    ),
  };
  return (
    <div className="min-h-screen bg-white" style={{ color: config.foreground }}>
      {config.sections.map((type) => (
        <div
          key={type}
          className={
            ['DirectoryListing', 'DirectoryInvitation', 'DirectoryBenefits'].includes(type)
              ? 'mx-auto max-w-7xl px-6 py-10 lg:px-10'
              : undefined
          }
        >
          {sections[type]}
        </div>
      ))}
    </div>
  );
}
