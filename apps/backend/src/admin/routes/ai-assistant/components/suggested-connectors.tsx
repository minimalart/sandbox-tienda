import { Badge, Text } from '@medusajs/ui';
import type { ReactNode } from 'react';

/**
 * Catálogo de "conectores sugeridos" de marketing, al estilo de los builders
 * multi-agente: tarjetas con logo + descripción que guían qué integraciones
 * conviene sumar para cruzar inversión/tráfico con los datos de la tienda.
 *
 * Hoy NO hay un MCP de marketing oficial, gratis y hosteado (GA4/GSC/Ads/Meta):
 * lo turnkey son proveedores comerciales y la opción libre es self-host. Por eso
 * estos cuatro se muestran como "Próximamente" (integración nativa en un clic) y
 * el CTA de abajo abre el alta de servidor pre-cargada (HTTP + OAuth) para quien
 * ya tenga un endpoint (self-host o proveedor). Sin endorsar ningún vendor.
 *
 * Los logos son marcas simplificadas (geometría propia, colores de marca) e
 * inline, para cumplir el CSP del admin (sin requests externos).
 */

const GoogleAdsLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="6" y="4" width="5.4" height="15" rx="2.7" transform="rotate(-26 8.7 11.5)" fill="#FBBC04" />
    <rect x="12.6" y="4" width="5.4" height="15" rx="2.7" transform="rotate(26 15.3 11.5)" fill="#4285F4" />
    <circle cx="12" cy="18.6" r="2.6" fill="#34A853" />
  </svg>
);

const MetaLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 12c0-3.3 1.9-5.5 4.2-5.5 3 0 4.6 5.5 3.8 5.5-.8 0 .8-5.5 3.8-5.5C18 6.5 20 8.7 20 12s-1.6 5.5-3.8 5.5c-3 0-4.2-5.5-4.2-5.5s-1.2 5.5-4.2 5.5C5.9 17.5 4 15.3 4 12Z"
      fill="none"
      stroke="#0866FF"
      strokeWidth="2.3"
    />
  </svg>
);

const GoogleAnalyticsLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3.5" y="13" width="4" height="7.5" rx="2" fill="#F9AB00" />
    <rect x="10" y="8.5" width="4" height="12" rx="2" fill="#F9AB00" />
    <rect x="16.5" y="3.5" width="4" height="17" rx="2" fill="#E37400" />
  </svg>
);

const SearchConsoleLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="15" width="3" height="4.5" rx="1.5" fill="#4285F4" />
    <rect x="8" y="12.5" width="3" height="7" rx="1.5" fill="#34A853" />
    <circle cx="15.5" cy="9" r="4.3" fill="none" stroke="#EA4335" strokeWidth="2.3" />
    <line x1="18.6" y1="12.1" x2="21.5" y2="15" stroke="#FBBC04" strokeWidth="2.3" strokeLinecap="round" />
  </svg>
);

type Connector = {
  key: string;
  name: string;
  description: string;
  logo: ReactNode;
  soon?: boolean;
};

const CONNECTORS: Connector[] = [
  {
    key: 'google-ads',
    name: 'Google Ads',
    description: 'Campañas, inversión, conversiones y ROAS de paid search.',
    logo: <GoogleAdsLogo />,
    soon: true,
  },
  {
    key: 'meta-ads',
    name: 'Meta Ads',
    description: 'Facebook e Instagram Ads: gasto, resultados y ROAS.',
    logo: <MetaLogo />,
    soon: true,
  },
  {
    key: 'google-analytics',
    name: 'Google Analytics 4',
    description: 'Tráfico, sesiones, conversiones y comportamiento de usuarios.',
    logo: <GoogleAnalyticsLogo />,
    soon: true,
  },
  {
    key: 'search-console',
    name: 'Google Search Console',
    description: 'Búsquedas, posiciones, clics e indexación orgánica (SEO).',
    logo: <SearchConsoleLogo />,
    soon: true,
  },
];

export const SuggestedConnectors = () => {
  return (
    <div className="flex flex-col gap-3">
      <Text className="txt-compact-small-plus text-ui-fg-base">Conectores sugeridos</Text>

      <div className="grid gap-3 sm:grid-cols-2">
        {CONNECTORS.map((c) => (
          <div
            key={c.key}
            className="flex items-start gap-3 rounded-xl border border-ui-border-base bg-ui-bg-subtle p-4 opacity-70"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-border-base bg-white">
              {c.logo}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="txt-compact-small-plus text-ui-fg-base">{c.name}</p>
                {c.soon ? (
                  <Badge size="2xsmall" color="grey">
                    Próximamente
                  </Badge>
                ) : null}
              </div>
              <p className="txt-small text-ui-fg-subtle">{c.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
