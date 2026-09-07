import { getActiveTenant, getTenantBySlug } from "@lib/site-config/active-tenant";
import { getRegion } from "@lib/data/regions";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CollectionsSection from "@modules/home/components/collections-section";
import EntrepreneurBanner from "@modules/home/components/entrepreneur-banner";
import FeaturedProductsGrid from "@modules/home/components/featured-products-grid";
import HeroBanners from "@modules/home/components/hero-banners";
import HomeProductRowSkeleton from "@modules/home/components/home-section-skeleton";
import LogoShowcase from "@modules/home/components/logo-showcase";
import MoreProductsSection from "@modules/home/components/more-products-section";
import PromoBanner from "@modules/home/components/promo-banner";
import ShopByLookSlot from "@modules/home/components/shop-by-look";
import ShoppableVideos from "@modules/home/components/shoppable-videos";
import TechnologyHome from "@modules/home-technology";
import FashionHome from "@modules/home-fashion";
import TechRetailHome from "@modules/home-tech-retail";
import SportsHome from "@modules/home-sports";
import CampaignHome from "@modules/home-campaign";
import HomeRenderer from "@modules/home/components/home-renderer";

/**
 * Demo store home — mercatto.studio/demo/{slug}.
 *
 * Lives under the (main) route group so it reuses the shared layout
 * (header/footer/providers). The proxy injects `x-demo-slug`, so getActiveTenant
 * + getActiveSalesChannelId (used by the layout and these sections) resolve the
 * demo's branding, template and catalog automatically. The demo tenant inherits
 * the default supermarket content sections (see getTenantBySlug), so the home
 * mirrors the main store's sections with demo branding + catalog.
 */
async function ShoppableVideosStreamed({ countryCode }: { countryCode: string }) {
  const region = await getRegion(countryCode);
  if (!region) return null;
  return <ShoppableVideos region={region} countryCode={countryCode} />;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const tenant = await getTenantBySlug(slug);
  return {
    title: { absolute: tenant?.metadata?.name || tenant?.name || "Demo" },
    description: (tenant?.metadata as { description?: string })?.description,
  };
}

export default async function DemoHome(props: {
  params: Promise<{ countryCode: string; slug: string }>;
}) {
  const { countryCode, slug } = await props.params;

  // 404 for unknown / not-yet-ready demos.
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  // Sanity: confirm the demo-aware resolver picked up the slug header.
  await getActiveTenant();

  // Home personalizada (editor Puck): si el demo tiene un layout guardado con
  // contenido, se renderiza con HomeRenderer, que monta las SECCIONES REALES con
  // su estilo real y el contenido editado (fallback al contenido real del demo
  // cuando un bloque viene vacío). Ausente = layout hardcodeado por defecto.
  const homeLayout = tenant.assets.homeLayout;
  if (homeLayout?.content && homeLayout.content.length > 0) {
    return (
      <HomeRenderer content={homeLayout.content} countryCode={countryCode} />
    );
  }

  // Per-vertical home templates. The grocery template (below) stays the
  // default and is untouched.
  if (tenant.template === "technology") {
    return <TechnologyHome countryCode={countryCode} />;
  }
  if (tenant.template === "fashion") {
    return <FashionHome countryCode={countryCode} />;
  }
  if (tenant.template === "tech-retail") {
    return <TechRetailHome countryCode={countryCode} />;
  }
  if (tenant.template === "sports") {
    return <SportsHome countryCode={countryCode} />;
  }
  if (tenant.template === "campaign") {
    return <CampaignHome countryCode={countryCode} />;
  }

  return (
    <>
      <HeroBanners />
      <Suspense fallback={null}>
        <ShopByLookSlot slot="top" countryCode={countryCode} />
      </Suspense>
      {/* Comprá por categoría */}
      <Suspense fallback={null}>
        <CollectionsSection banners={[]} countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_collections" countryCode={countryCode} />
      </Suspense>
      {/* Banner promocional (assets.promoBanner). Sin config no renderiza nada. */}
      <Suspense fallback={null}>
        <PromoBanner />
      </Suspense>
      <Suspense fallback={null}>
        <LogoShowcase countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={<HomeProductRowSkeleton />}>
        <FeaturedProductsGrid countryCode={countryCode} productCategory="featuredProducts" />
      </Suspense>
      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_featured" countryCode={countryCode} />
      </Suspense>
      {/* Combos y cajas */}
      <EntrepreneurBanner />
      <Suspense fallback={<HomeProductRowSkeleton />}>
        <FeaturedProductsGrid
          countryCode={countryCode}
          productCategory="novedades"
          cardVariant="compact"
        />
      </Suspense>
      {/* Conocé más categorías */}
      <MoreProductsSection />
      <Suspense fallback={null}>
        <ShoppableVideosStreamed countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={null}>
        <ShopByLookSlot slot="before_footer" countryCode={countryCode} />
      </Suspense>
    </>
  );
}
