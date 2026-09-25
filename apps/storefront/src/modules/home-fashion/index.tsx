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
  section,
}: {
  countryCode?: string;
  section?: string;
}) {
  const tenant = await getActiveTenant();
  const fashion = tenant.assets.fashion;

  return (
    <main className="fashion-home bg-[--f-canvas]">
      {/* 2. Hero editorial */}
      {(!section || section === '1') && (<EditorialHero hero={fashion?.hero} />)}

      {(!section || section === '2') && (<Suspense fallback={null}>
        <ShopByLookSlot slot="top" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>)}

      {/* 3. Colecciones destacadas */}
      {(!section || section === '3') && (<CollectionGrid config={fashion?.featuredCollections} />)}

      {(!section || section === '4') && (<Suspense fallback={null}>
        <ShopByLookSlot slot="after_collections" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>)}

      {/* 4. Campaña editorial */}
      {(!section || section === '5') && (<CampaignBanner config={fashion?.campaign} />)}

      {/* 5. New Arrivals */}
      {(!section || section === '6') && (<Suspense fallback={null}>
        <NewArrivalsCarousel source="newArrivals" />
      </Suspense>)}

      {(!section || section === '7') && (<Suspense fallback={null}>
        <ShopByLookSlot slot="after_featured" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>)}

      {/* 6. Categorías lifestyle */}
      {(!section || section === '8') && (<LifestyleCategories config={fashion?.lifestyleCategories} />)}

      {/* 7. Lookbook */}
      {(!section || section === '9') && (<LookbookGrid config={fashion?.lookbook} />)}

      {/* 8. Productos destacados (carrusel secundario) */}
      {(!section || section === '10') && (<Suspense fallback={null}>
        <NewArrivalsCarousel source="featuredProducts" />
      </Suspense>)}

      {/* 9. Banner de temporada */}
      {(!section || section === '11') && (<SeasonBanner config={fashion?.seasonBanner} />)}

      {(!section || section === '12') && (<Suspense fallback={null}>
        <ShopByLookSlot slot="before_footer" countryCode={countryCode ?? ""} titleClassName="f-section-title" />
      </Suspense>)}

      {/* 10. Newsletter */}
      {(!section || section === '13') && (<FashionNewsletter config={fashion?.newsletter} />)}
    </main>
  );
}
