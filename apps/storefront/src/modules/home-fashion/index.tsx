import { getActiveTenant } from "@lib/site-config/active-tenant";
import { Suspense } from "react";
import "./fashion-theme.css";

import ShopByLookSlot from "@modules/home/components/shop-by-look";
import CampaignBanner from "./components/campaign-banner";
import CollectionGrid from "./components/collection-grid";
import EditorialHero from "./components/editorial-hero";
import FashionNewsletter from "./components/fashion-newsletter";
import LifestyleCategories from "./components/lifestyle-categories";
import LookbookGrid from "./components/lookbook-grid";
import NewArrivalsCarousel from "./components/new-arrivals-carousel";
import SeasonBanner from "./components/season-banner";

/**
 * Home del template Moda / Indumentaria.
 *
 * Convive con los templates Grocery y Technology sin reemplazarlos: se
 * renderiza cuando el tenant activo tiene `template === "fashion"`. Cada
 * sección es un componente reutilizable que consume su bloque de
 * `assets.fashion`, de modo que el contenido varía por demo / vertical /
 * sales channel sin tocar el código (ver lib/site-config/fashion.ts para el
 * contenido por defecto).
 *
 * El header y footer de moda se montan desde el layout (main) cuando el
 * template está activo; acá vive el cuerpo editorial de la home.
 */
export default async function FashionHome({
  countryCode,
}: {
  countryCode?: string;
}) {
  const tenant = await getActiveTenant();
  const fashion = tenant.assets.fashion;

  return (
    <main className="fashion-home bg-[--f-canvas]">
      {/* 2. Hero editorial */}
      <EditorialHero hero={fashion?.hero} />

      <Suspense fallback={null}>
        <ShopByLookSlot slot="top" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>

      {/* 3. Colecciones destacadas */}
      <CollectionGrid config={fashion?.featuredCollections} />

      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_collections" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>

      {/* 4. Campaña editorial */}
      <CampaignBanner config={fashion?.campaign} />

      {/* 5. New Arrivals */}
      <Suspense fallback={null}>
        <NewArrivalsCarousel source="newArrivals" />
      </Suspense>

      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_featured" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>

      {/* 6. Categorías lifestyle */}
      <LifestyleCategories config={fashion?.lifestyleCategories} />

      {/* 7. Lookbook */}
      <LookbookGrid config={fashion?.lookbook} />

      {/* 8. Productos destacados (carrusel secundario) */}
      <Suspense fallback={null}>
        <NewArrivalsCarousel source="featuredProducts" />
      </Suspense>

      {/* 9. Banner de temporada */}
      <SeasonBanner config={fashion?.seasonBanner} />

      <Suspense fallback={null}>
        <ShopByLookSlot slot="before_footer" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>

      {/* 10. Newsletter */}
      <FashionNewsletter config={fashion?.newsletter} />
    </main>
  );
}
