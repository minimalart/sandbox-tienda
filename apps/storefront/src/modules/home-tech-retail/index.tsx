import { getActiveTenant } from "@lib/site-config/active-tenant";
import { Suspense } from "react";
import "./tech-retail-theme.css";

import BrandCarousel from "./components/brand-carousel";
import FinancingBanner from "./components/financing-banner";
import TechCategoryGrid from "./components/tech-category-grid";
import TrBenefits from "./components/tr-benefits";
import TrFeaturedProducts from "./components/tr-featured-products";
import TrHero from "./components/tr-hero";
import TrNewsletter from "./components/tr-newsletter";
import TrPromoBanner from "./components/tr-promo-banner";

/**
 * Home del template Tecnología Retail (Frávega / Best Buy / Cetrogar).
 *
 * Convive con los demás templates sin reemplazarlos: se renderiza cuando el
 * tenant activo tiene `template === "tech-retail"`. Cada sección es un
 * componente reutilizable que consume su bloque de `assets.techRetail`, de modo
 * que el contenido varía por demo / vertical / sales channel sin tocar el
 * código (ver lib/site-config/tech-retail.ts para el contenido por defecto).
 *
 * El header y footer se montan desde el layout (main) cuando el template está
 * activo; acá vive el cuerpo de la home.
 */
export default async function TechRetailHome({
  countryCode,
}: {
  countryCode: string;
}) {
  const tenant = await getActiveTenant();
  const tr = tenant.assets.techRetail;

  return (
    <main className="tech-retail-home bg-white">
      {/* 2. Hero promocional (carrusel) */}
      <TrHero config={tr?.hero} />

      {/* 3. Categorías destacadas */}
      <TechCategoryGrid config={tr?.categories} />

      {/* 4. Marcas destacadas (bloque obligatorio) */}
      <BrandCarousel config={tr?.brands} />

      {/* 5. Financiación / promociones */}
      <FinancingBanner config={tr?.financing} />

      {/* 6. Productos destacados (catálogo dinámico) */}
      <Suspense fallback={null}>
        <TrFeaturedProducts countryCode={countryCode} />
      </Suspense>

      {/* 7. Gaming (opcional) */}
      <TrPromoBanner config={tr?.gaming} ctaVariant="accent" />

      {/* 8. Home Office (opcional) */}
      <TrPromoBanner config={tr?.homeOffice} ctaVariant="primary" />

      {/* 9. Beneficios de compra */}
      <TrBenefits config={tr?.benefits} />

      {/* 10. Newsletter / novedades */}
      <TrNewsletter config={tr?.newsletter} />
    </main>
  );
}
