import { getActiveTenant } from "@lib/site-config/active-tenant";
import { Suspense } from "react";
import "./sports-theme.css";

import ShopByLookSlot from "@modules/home/components/shop-by-look";
import CampaignBanner from "./components/campaign-banner";
import SportsBrandStrip from "./components/sports-brand-strip";
import SportCategoryGrid from "./components/sport-category-grid";
import SportsCategories from "./components/sports-categories";
import SportsCollections from "./components/sports-collections";
import SportsFeaturedProducts from "./components/sports-featured-products";
import SportsHero from "./components/sports-hero";
import SportsLookbook from "./components/sports-lookbook";
import SportsReveal from "./components/sports-reveal";

/**
 * Home del template Marca Deportiva (Adidas / Puma / Nike).
 *
 * Convive con los demás templates sin reemplazarlos: se renderiza cuando el
 * tenant activo tiene `template === "sports"`. Cada sección es un componente
 * reutilizable que consume su bloque de `assets.sports`, de modo que el
 * contenido varía por demo / vertical / sales channel sin tocar el código (ver
 * lib/site-config/sports.ts para el contenido por defecto).
 *
 * El header y footer deportivos se montan desde el layout (main) cuando el
 * template está activo; acá vive el cuerpo de la home.
 */
export default async function SportsHome({
  countryCode,
}: {
  countryCode?: string;
}) {
  const tenant = await getActiveTenant();
  const sports = tenant.assets.sports;
  const heroSlides =
    sports?.heroSlides && sports.heroSlides.length > 0
      ? sports.heroSlides
      : sports?.hero
        ? [sports.hero]
        : [];

  return (
    <main className="sports-home bg-[--sp-paper]">
      {/* Hero: carrusel de campaña animado */}
      <SportsHero slides={heroSlides} />

      <Suspense fallback={null}>
        <ShopByLookSlot slot="top" countryCode={countryCode ?? ""} titleClassName="sp-section-title" />
      </Suspense>

      {/* Tira de logos de marcas (fondo negro, marquee automático) */}
      <Suspense fallback={null}>
        <SportsBrandStrip />
      </Suspense>

      {/* A partir del hero, cada sección entra con un scroll-reveal (fade +
          desplazamiento) para que la home deje de sentirse estática. */}

      {/* Deportes (bloque principal) */}
      <SportsReveal>
        <SportCategoryGrid config={sports?.sports} />
      </SportsReveal>

      {/* Fila de productos: Calzado — intercalada entre banners (producto →
          banner → producto → banner …). Cada fila usa una búsqueda distinta
          para que NO traiga los mismos productos. */}
      <SportsReveal>
        <Suspense fallback={null}>
          <SportsFeaturedProducts
            title="Lo más nuevo en calzado"
            description="Las últimas zapatillas para tu próximo entrenamiento."
            filter={{
              limit: 12,
              sortBy: "created_at",
              searchQuery: "zapatillas",
            }}
          />
        </Suspense>
      </SportsReveal>

      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_featured" countryCode={countryCode ?? ""} titleClassName="sp-section-title" />
      </Suspense>

      {/* Colecciones */}
      <SportsReveal>
        <SportsCollections config={sports?.collections} />
      </SportsReveal>

      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_collections" countryCode={countryCode ?? ""} titleClassName="sp-section-title" />
      </Suspense>

      {/* Fila de productos: Indumentaria */}
      <SportsReveal>
        <Suspense fallback={null}>
          <SportsFeaturedProducts
            title="Indumentaria"
            description="Buzos y camperas para entrenar con todo."
            filter={{ limit: 12, sortBy: "relevance", searchQuery: "buzo" }}
          />
        </Suspense>
      </SportsReveal>

      {/* Categorías (Calzado / Indumentaria / Accesorios) */}
      <SportsReveal>
        <SportsCategories config={sports?.categories} />
      </SportsReveal>

      {/* Campaña (muy visual) */}
      <SportsReveal>
        <CampaignBanner config={sports?.campaign} />
      </SportsReveal>

      {/* Fila de productos: Remeras */}
      <SportsReveal>
        <Suspense fallback={null}>
          <SportsFeaturedProducts
            title="Remeras deportivas"
            description="Livianas y transpirables para cada disciplina."
            filter={{ limit: 12, sortBy: "relevance", searchQuery: "remera" }}
          />
        </Suspense>
      </SportsReveal>

      {/* Lookbook deportivo — el CTA de cierre se renderiza DENTRO del mosaico,
          rellenando el hueco libre (alineado a la izquierda en desktop). */}
      <SportsReveal>
        <SportsLookbook
          config={sports?.lookbook}
          cta={{
            eyebrow: "Impossible is nothing",
            title: "Listo para tu próximo desafío",
            subtitle:
              "Equipate con lo último en performance y dejá todo en cada entrenamiento.",
            ctaText: "Ver todo el catálogo",
            ctaHref: "/store",
          }}
        />
      </SportsReveal>

      <Suspense fallback={null}>
        <ShopByLookSlot slot="before_footer" countryCode={countryCode ?? ""} titleClassName="sp-section-title" />
      </Suspense>
    </main>
  );
}
