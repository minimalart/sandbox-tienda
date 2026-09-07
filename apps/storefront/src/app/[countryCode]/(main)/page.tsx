import { getFirstBannerForPlacement } from "@lib/banners";
import { getHomeBanners } from "@lib/data/banners";
import { getRegion } from "@lib/data/regions";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { canonicalUrl } from "@lib/util/site-url";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import BlogHighlights from "@modules/home/components/blog-highlights";
import CollectionsSection from "@modules/home/components/collections-section";
import EntrepreneurBanner from "@modules/home/components/entrepreneur-banner";
import FeaturedProductsGrid from "@modules/home/components/featured-products-grid";
import HeroBanners from "@modules/home/components/hero-banners";
import HomeRenderer from "@modules/home/components/home-renderer";
import HomeProductRowSkeleton, {
  BrandsRowSkeleton,
  CollectionsRowSkeleton,
  VideosRowSkeleton,
} from "@modules/home/components/home-section-skeleton";
import LogoShowcase from "@modules/home/components/logo-showcase";
import MoreProductsSection from "@modules/home/components/more-products-section";
import PromoBanner from "@modules/home/components/promo-banner";
import ShopByLookSlot from "@modules/home/components/shop-by-look";
import ShoppableVideos from "@modules/home/components/shoppable-videos";
import { Suspense } from "react";

// Wrappers async para que la data de cada sección se resuelva DENTRO de su
// frontera de Suspense. Así el shell + el hero salen al instante y cada sección
// streamea cuando su fetch termina, en vez de bloquear toda la página hasta el
// fetch más lento (era LogoShowcase → getStoreBrands).
async function CollectionsSectionStreamed({
  countryCode,
}: {
  countryCode: string;
}) {
  const homeBanners = await getHomeBanners();
  return <CollectionsSection banners={homeBanners} countryCode={countryCode} />;
}

async function ShoppableVideosStreamed({
  countryCode,
}: {
  countryCode: string;
}) {
  const region = await getRegion(countryCode);
  if (!region) return null;
  return <ShoppableVideos region={region} countryCode={countryCode} />;
}

// Splash de bienvenida: la decisión de mostrarlo se toma EN EL SERVIDOR, antes
// de renderizar el home, para que nunca se vea el "flash" del home seguido del
// salto al splash. Si corresponde (mobile + hay banner + no se mostró en esta
// sesión), redirige a `/splash` con un 307 server-side. El splash setea la
// cookie de sesión al montarse, así no vuelve a aparecer.
const SPLASH_SHOWN_COOKIE = "welcome-splash-shown";
const MOBILE_UA_RE =
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|BlackBerry|webOS|Mobile/i;

async function maybeRedirectToSplash() {
  const cookieStore = await cookies();
  if (cookieStore.get(SPLASH_SHOWN_COOKIE)?.value === "1") return;

  const userAgent = (await headers()).get("user-agent") || "";
  if (!MOBILE_UA_RE.test(userAgent)) return;

  const homeBanners = await getHomeBanners();
  if (!getFirstBannerForPlacement(homeBanners, "welcome_splash")) return;

  redirect("/splash");
}

export async function generateMetadata() {
  const tenant = await getActiveTenant();
  const brand = tenant.metadata?.name || tenant.name;

  return {
    title: { absolute: tenant.metadata?.seo?.title || brand },
    // El texto de fallback hablaba de fragancias y aromaterapia: en una pinturería, en
    // una ferretería o en un supermercado eso es una descripción equivocada, no genérica.
    description:
      tenant.metadata?.seo?.description ||
      tenant.metadata?.description ||
      `Comprá online en ${brand}: catálogo completo, precios actualizados y envíos a domicilio.`,
    // La home es la única página cuyo canonical coincidía con el que heredaba del root.
    // Se declara igual: el prefijo de tienda lo pone `canonicalUrl()`, y sin él una
    // tienda en /tienda/<slug> canonicaliza a la home del sitio PRINCIPAL.
    alternates: { canonical: await canonicalUrl("/") },
  };
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>;
}) {
  const params = await props.params;
  const { countryCode } = params;

  // Decisión server-side del splash ANTES de renderizar el home (evita el flash).
  await maybeRedirectToSplash();

  const tenant = await getActiveTenant();

  // Home personalizada desde "Personalizar home" (editor Puck del admin). El
  // documento vive en `assets.homeLayout` y llega hasta acá por el merge del
  // tenant principal. Con contenido, MANDA sobre la composición de abajo; sin
  // documento, el home queda byte por byte como estaba.
  //
  // El H1 se emite en las DOS ramas. El JSON-LD de Organization ya no vive acá: lo
  // emite el layout `(main)` para todo el árbol, no sólo para la home.
  const homeLayout = tenant.assets.homeLayout;
  if (homeLayout?.content && homeLayout.content.length > 0) {
    return (
      <>
        {/* La home no emitía H1: el hero abre en h2 y el grid en h3, así que la página
            más importante del sitio no declaraba de qué es. Va oculto visualmente para
            no tocar el diseño del hero. */}
        <h1 className="sr-only">{tenant.metadata?.seo?.title || `${tenant.metadata?.name || tenant.name} — tienda online`}</h1>
        <HomeRenderer content={homeLayout.content} countryCode={countryCode} />
      </>
    );
  }

  // Sin awaits a nivel de página: el shell y el hero (above-the-fold) se
  // renderizan de inmediato. Cada sección con data va en su propia frontera de
  // Suspense y streamea cuando resuelve.
  return (
    <>
      <h1 className="sr-only">{tenant.metadata?.seo?.title || `${tenant.metadata?.name || tenant.name} — tienda online`}</h1>
      <HeroBanners />
      <Suspense fallback={null}>
        <ShopByLookSlot slot="top" countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={<CollectionsRowSkeleton />}>
        <CollectionsSectionStreamed countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_collections" countryCode={countryCode} />
      </Suspense>
      {/* Banner promocional (assets.promoBanner). Sin config no renderiza nada. */}
      <Suspense fallback={null}>
        <PromoBanner />
      </Suspense>
      <Suspense fallback={<BrandsRowSkeleton />}>
        <LogoShowcase countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={<HomeProductRowSkeleton />}>
        <FeaturedProductsGrid
          countryCode={countryCode}
          productCategory="featuredProducts"
        />
      </Suspense>
      <Suspense fallback={null}>
        <ShopByLookSlot slot="after_featured" countryCode={countryCode} />
      </Suspense>
      <EntrepreneurBanner />
      <Suspense fallback={<HomeProductRowSkeleton />}>
        <FeaturedProductsGrid
          countryCode={countryCode}
          productCategory="novedades"
          cardVariant="compact"
        />
      </Suspense>
      <Suspense fallback={null}>
        <BlogHighlights />
      </Suspense>
      <Suspense fallback={<VideosRowSkeleton />}>
        <ShoppableVideosStreamed countryCode={countryCode} />
      </Suspense>
      <Suspense fallback={<HomeProductRowSkeleton />}>
        <FeaturedProductsGrid
          countryCode={countryCode}
          productCategory="renovaEnergia"
          cardVariant="compact"
          onlyPromotions
          maxItems={4}
          viewAllCard={{
            label: "Ver todas las promociones",
            href: "/store?promos=1",
          }}
        />
      </Suspense>
      <Suspense fallback={null}>
        <MoreProductsSection />
      </Suspense>
      <Suspense fallback={<HomeProductRowSkeleton />}>
        <FeaturedProductsGrid
          countryCode={countryCode}
          productCategory="destacadosDelMes"
        />
      </Suspense>
      <Suspense fallback={null}>
        <ShopByLookSlot slot="before_footer" countryCode={countryCode} />
      </Suspense>
    </>
  );
}
