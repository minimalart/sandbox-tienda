import { getActiveTenant } from "@lib/site-config/active-tenant";
import { Suspense } from "react";
import "./tech-theme.css";

import TechBenefits from "./components/tech-benefits";
import TechBrands from "./components/tech-brands";
import TechCategories from "./components/tech-categories";
import TechFeaturedProducts from "./components/tech-featured-products";
import TechHero from "./components/tech-hero";
import TechNewsletter from "./components/tech-newsletter";
import TechPromotions from "./components/tech-promotions";
import TechSecondaryBanner from "./components/tech-secondary-banner";
import TechUseCases from "./components/tech-use-cases";

/**
 * Home del template Tecnología / Electrodomésticos.
 *
 * Convive con el template Grocery sin reemplazarlo: se renderiza cuando el
 * tenant activo tiene `template === "technology"`. Cada sección es un
 * componente reutilizable que consume su bloque de `assets.technology`, de
 * modo que el contenido varía por demo / vertical / sales channel sin tocar
 * el código (ver lib/site-config/technology.ts para el contenido por defecto).
 *
 * El header y footer tecnológicos se montan desde el layout (main) cuando el
 * template está activo; acá vive el cuerpo de la home.
 */
export default async function TechnologyHome({
  countryCode,
}: {
  countryCode: string;
}) {
  const tenant = await getActiveTenant();
  const tech = tenant.assets.technology;

  return (
    <main className="tech-home bg-white">
      {/* 2. Hero principal */}
      <TechHero hero={tech?.hero} />

      {/* 3. Categorías destacadas */}
      <TechCategories config={tech?.featuredCategories} />

      {/* 4. Marcas destacadas */}
      <TechBrands config={tech?.featuredBrands} />

      {/* 5. Productos destacados (catálogo dinámico) */}
      <Suspense fallback={null}>
        <TechFeaturedProducts countryCode={countryCode} />
      </Suspense>

      {/* 6. Financiación / promociones */}
      <TechPromotions config={tech?.promotions} />

      {/* 7. Compra por necesidad */}
      <TechUseCases config={tech?.useCases} />

      {/* 8. Banner secundario */}
      <TechSecondaryBanner config={tech?.secondaryBanner} />

      {/* 9. Beneficios de compra */}
      <TechBenefits config={tech?.benefits} />

      {/* 10. Newsletter / novedades */}
      <TechNewsletter config={tech?.newsletter} />
    </main>
  );
}
