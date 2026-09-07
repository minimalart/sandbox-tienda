import { getActiveTenant } from "@lib/site-config/active-tenant";
import { Suspense } from "react";
import "./campaign-theme.css";

import HomeRenderer from "@modules/home/components/home-renderer";
import CampaignHero from "./components/campaign-hero";
import CampaignKits from "./components/campaign-kits";

/**
 * Home del template Campaña (landing institucional).
 *
 * Convive con los demás templates sin reemplazarlos: se renderiza cuando el
 * tenant activo tiene `template === "campaign"`. El header/footer viven en
 * archivos aparte porque se montan desde el layout `(main)` según el chrome
 * del template activo (ver template-helpers → CUSTOM_CHROME_TEMPLATES).
 *
 * Dos caminos, en orden:
 *
 *  1) Si el demo tiene un `assets.homeLayout` guardado (documento Puck del
 *     editor "Personalizar home"), delegamos al `HomeRenderer` — el operador
 *     armó el body con bloques (`CampaignHero`, `ProductosDestacados`, etc.)
 *     y esos son los que se montan, con el estilo real. Mismo patrón que
 *     grocery en `(main)/page.tsx`.
 *
 *  2) Sin layout guardado (edge case: alguien borró el seed del template o
 *     el demo se creó por API sin `home_puck_data`), fallback al render
 *     estático con `<CampaignHero>` + `<CampaignKits>` alimentados con los
 *     defaults de `campaignConfig` — así el site NO se queda con el body
 *     en blanco.
 */
export default async function CampaignHome({
  countryCode,
}: {
  countryCode: string;
}) {
  const tenant = await getActiveTenant();
  const campaign = tenant.assets.campaign;
  if (!campaign) return null;

  const homeLayout = tenant.assets.homeLayout;
  if (homeLayout?.content && homeLayout.content.length > 0) {
    return (
      <main className="campaign-home bg-white">
        <HomeRenderer content={homeLayout.content} countryCode={countryCode} />
      </main>
    );
  }

  // Fallback estático — sólo si el demo NO tiene layout Puck.
  return (
    <main className="campaign-home bg-white">
      <CampaignHero hero={campaign.hero} />
      <Suspense fallback={null}>
        <CampaignKits
          config={campaign.kits}
          ctaLabel={campaign.kits.ctaLabel ?? "Agregar"}
          countryCode={countryCode}
        />
      </Suspense>
    </main>
  );
}
