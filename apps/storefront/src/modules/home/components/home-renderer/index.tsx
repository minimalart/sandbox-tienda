import { getRegion } from "@lib/data/regions";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import type { HomeLayoutBlock } from "@lib/site-config/types";
import { Suspense } from "react";

import BlogHighlights from "@modules/home/components/blog-highlights";
import CollectionsSection from "@modules/home/components/collections-section";
import EntrepreneurBanner from "@modules/home/components/entrepreneur-banner";
import FeaturedProductsGrid from "@modules/home/components/featured-products-grid";
import HeroBanners from "@modules/home/components/hero-banners";
import LogoShowcase from "@modules/home/components/logo-showcase";
import MoreProductsSection from "@modules/home/components/more-products-section";
import PromoBanner from "@modules/home/components/promo-banner";
import ShopByLookSlot from "@modules/home/components/shop-by-look";
import ShoppableVideos from "@modules/home/components/shoppable-videos";
import CampaignHero from "@modules/home-campaign/components/campaign-hero";
import LandingRenderer from "@modules/landing-page/components/landing-renderer";

/**
 * Renderiza el home de un demo desde su documento Puck (assets.homeLayout),
 * montando las SECCIONES REALES con su estilo real.
 *
 * Regla clave: para las secciones config-driven el `config` que le pasamos al
 * componente es el contenido real del demo (assets) PISADO campo por campo con
 * lo editado en el bloque. Así el home sembrado se ve como la home real y el
 * usuario va editando encima; en particular, editar solo el título o la bajada
 * de una sección surte efecto aunque no haya tocado sus tarjetas.
 *
 * Secciones "media" (banners/marcas/videos/shop-by-look): traen su contenido de
 * la DB scopeado al canal del demo (editable en sus pantallas), pero el TÍTULO y
 * la BAJADA de la sección sí se editan desde el bloque, como en el resto.
 * Bloques genéricos (Hero/RichText/Image/CTA/Spacer) → LandingRenderer.
 */

const GENERIC = new Set(["Hero", "RichText", "ImageBlock", "CTA", "Spacer"]);

const nonEmpty = (arr: unknown): arr is any[] => Array.isArray(arr) && arr.length > 0;

/**
 * ¿El bloque "Fila de productos" define una búsqueda propia (Typesense)?
 * Solo cuenta si el usuario eligió algo distinto del neutro `newest`, y para
 * búsqueda libre / tag además tiene que haber cargado el valor.
 *
 * OJO: el editor del admin repite esta regla para describir el bloque
 * (`apps/backend/src/admin/lib/puck/home-config.tsx`); si cambia acá, cambiarla allá.
 */
const hasBlockSearch = (p: Record<string, any>): boolean => {
  if (p.source === "promotions") return true;
  if (p.source === "query" || p.source === "tag") {
    return typeof p.value === "string" && p.value.trim().length > 0;
  }
  return false;
};

export default async function HomeRenderer({
  content,
  countryCode,
}: {
  content: HomeLayoutBlock[] | undefined | null;
  countryCode: string;
}) {
  const region = countryCode ? await getRegion(countryCode) : null;
  const blocks = Array.isArray(content) ? content : [];
  // Contenido real del demo: base sobre la que se aplican los overrides del
  // bloque (un bloque con la tarjeta vacía no debe borrar la sección).
  const assets = (await getActiveTenant()).assets;

  const renderBlock = (block: HomeLayoutBlock) => {
    const p = (block.props ?? {}) as Record<string, any>;
    switch (block.type) {
      case "Banners":
        return <HeroBanners />;

      // ── CampaignHero → hero de la landing institucional ────────────────
      // Bloque exclusivo del template `campaign`. El fallback estatico usaba
      // `campaignConfig.hero` como default; acá el Puck es autoritativo (el
      // operador es dueño del contenido) y los defaults sólo aplican para
      // seed inicial cuando el bloque se agrega desde el catálogo del editor.
      case "CampaignHero":
        return (
          <CampaignHero
            hero={{
              eyebrow: p.eyebrow,
              title: p.title ?? "",
              subtitle: p.subtitle,
              image: p.image,
              imageAlt: p.imageAlt,
              primaryCta:
                p.ctaText && p.ctaHref
                  ? { text: p.ctaText, href: p.ctaHref }
                  : undefined,
              trustBadges: nonEmpty(p.trustBadges)
                ? p.trustBadges
                    .filter((b: any) => b?.label)
                    .map((b: any, i: number) => ({
                      id: b.id || `badge-${i + 1}`,
                      icon: b.icon || "credit-card",
                      label: b.label,
                    }))
                : undefined,
            }}
          />
        );

      // Secciones "media": el contenido (logos, videos, looks) se edita en su
      // pantalla, pero el encabezado de la sección viene del bloque. `??` para
      // que un texto vaciado a propósito lo oculte en vez de caer al default.
      case "Marcas":
        return (
          <LogoShowcase
            countryCode={countryCode}
            title={p.title}
            subtitle={p.subtitle}
          />
        );

      case "Videos":
        return region ? (
          <ShoppableVideos
            region={region}
            countryCode={countryCode}
            title={p.title}
            mobileTitle={p.mobileTitle}
            description={p.description}
          />
        ) : null;

      case "ShopByLook":
        return (
          <ShopByLookSlot
            slot={p.slot ?? "top"}
            countryCode={countryCode}
            sectionTitle={p.title}
            sectionSubtitle={p.subtitle}
          />
        );

      case "Categorias": {
        const base = assets.collections;
        const config = {
          ...(base ?? {}),
          title: p.title || base?.title,
          subtitle: p.subtitle || base?.subtitle,
          collections: nonEmpty(p.collections)
            ? p.collections.map((c: any, i: number) => ({
                collectionId: c.href || c.label || `col-${i}`,
                label: c.label,
                image: c.image,
                href: c.href,
                backgroundColor: c.backgroundColor || undefined,
                backgroundImage: c.backgroundImage || undefined,
              }))
            : (base?.collections ?? []),
          viewAllCard: p.viewAllTitle
            ? { title: p.viewAllTitle, href: p.viewAllHref || "/store" }
            : base?.viewAllCard,
        } as any;
        return <CollectionsSection banners={[]} countryCode={countryCode} config={config} />;
      }

      case "ProductosDestacados": {
        const preset = p.preset ?? "featuredProducts";
        const viewAllCard = p.viewAllLabel
          ? { label: p.viewAllLabel, href: p.viewAllHref || "/store" }
          : undefined;
        // La búsqueda elegida en el bloque MANDA, incluso con un preset del
        // template: si no, editar "Qué traer" no tenía ningún efecto y la fila
        // seguía trayendo el filtro fijo del template (parecía hardcodeada).
        // `newest` es el valor neutro del campo (default de `defaultProps`), así
        // que no cuenta como búsqueda propia: con un preset sigue ganando el
        // template, que es lo que ve hoy cualquier home ya guardada.
        const blockSearch = hasBlockSearch(p);
        if (preset !== "custom" && !blockSearch) {
          // Contenido real del template (assets[preset]), con la Cantidad y el
          // Orden del bloque pisando su filtro. Vacíos = los del preset (el
          // campo no distingue "no lo toqué" de un valor elegido).
          // Se sigue pasando `productCategory` porque la grilla lo usa para
          // decidir la segunda imagen de la tarjeta compacta; `config` manda
          // sobre `assets[productCategory]` para el contenido.
          const presetBase = (assets as any)[preset];
          const limit = Number(p.limit) > 0 ? Number(p.limit) : undefined;
          const config = presetBase
            ? ({
                ...presetBase,
                filter: {
                  ...(presetBase.filter ?? {}),
                  ...(limit ? { limit } : {}),
                  ...(p.sortBy ? { sortBy: p.sortBy } : {}),
                },
              } as any)
            : undefined;
          return (
            <FeaturedProductsGrid
              countryCode={countryCode}
              productCategory={preset}
              config={config}
              cardVariant={p.cardVariant ?? "default"}
              title={p.title || undefined}
              description={p.description || undefined}
              viewAllCard={viewAllCard}
            />
          );
        }
        // Búsqueda propia del bloque: el filtro se arma acá y REEMPLAZA al del
        // preset (si dejáramos su categoryId/collectionId la búsqueda quedaría
        // acotada a lo del template). Los textos del preset siguen de base.
        const base = preset !== "custom" ? (assets as any)[preset] : undefined;
        const config = {
          title: p.title || base?.title || undefined,
          description: p.description ?? base?.description ?? undefined,
          filter: {
            // `> 0` y no `||`: un limit negativo guardado en el documento pasaba
            // el guard y hacia fallar la busqueda entera.
            limit: Number(p.limit) > 0 ? Number(p.limit) : 12,
            sortBy: p.sortBy || undefined,
            searchQuery: p.source === "query" ? p.value || undefined : undefined,
            tag: p.source === "tag" ? p.value || undefined : undefined,
          },
        } as any;
        return (
          <FeaturedProductsGrid
            countryCode={countryCode}
            config={config}
            cardVariant={p.cardVariant ?? "default"}
            onlyPromotions={p.source === "promotions"}
            viewAllCard={viewAllCard}
          />
        );
      }

      case "Combos": {
        const base = assets.resellerKits;
        const config = {
          ...(base ?? {}),
          titleHome: p.title || base?.titleHome,
          descriptionHome: p.description || base?.descriptionHome,
          kits: nonEmpty(p.kits)
            ? p.kits.map((k: any, i: number) => ({
                productId: k.href || `kit-${i}`,
                title: k.title,
                subtitle: k.subtitle,
                image: k.image,
                video: k.video || undefined,
                poster: k.poster || undefined,
                bgColor: k.bgColor,
                href: k.href,
              }))
            : (base?.kits ?? []),
        } as any;
        return <EntrepreneurBanner config={config} />;
      }

      case "BannerPromo": {
        // Banner de una sola pieza: todo su contenido se edita en el bloque, con
        // `assets.promoBanner` de base para el demo que ya lo trae configurado.
        const base = assets.promoBanner;
        const config = {
          ...(base ?? {}),
          title: p.title || base?.title,
          subtitle: p.subtitle ?? base?.subtitle,
          image: p.image || base?.image,
          backgroundColor: p.backgroundColor || base?.backgroundColor,
          textColor: p.textColor || base?.textColor,
          accentColor: p.accentColor || base?.accentColor,
          imagePosition: p.imagePosition || base?.imagePosition,
          cta: p.ctaLabel
            ? { text: p.ctaLabel, href: p.ctaHref || "/store" }
            : base?.cta,
        } as any;
        return <PromoBanner config={config} />;
      }

      case "Blog": {
        // Los artículos son los reales del canal y siempre son 2; el bloque solo
        // trae textos. Un `limit` viejo guardado en el documento se ignora.
        // Se mergea sobre `assets.blogHighlights` para no perder lo que el
        // bloque no expone (ej. `categoryId`, que filtra las notas).
        const base = assets.blogHighlights;
        const config = {
          ...(base ?? {}),
          title: p.title || base?.title,
          subtitle: p.subtitle ?? base?.subtitle,
          featuredCtaLabel: p.featuredCtaLabel || base?.featuredCtaLabel,
          ctaLabel: p.ctaLabel || base?.ctaLabel,
          viewAllLabel: p.viewAllLabel ?? base?.viewAllLabel,
        } as any;
        return <BlogHighlights config={config} />;
      }

      case "MasCategorias": {
        const base = assets.moreProducts;
        const config = {
          ...(base ?? {}),
          title: p.title || base?.title,
          subtitle: p.subtitle || base?.subtitle,
          items: nonEmpty(p.items)
            ? p.items.map((c: any, i: number) => ({
                categoryId: c.href || c.label || `item-${i}`,
                label: c.label,
                image: c.image,
                href: c.href || "/store",
                backgroundColor: c.backgroundColor || undefined,
              }))
            : (base?.items ?? []),
          viewAllCard: p.viewAllTitle
            ? { title: p.viewAllTitle, href: p.viewAllHref || "/store" }
            : base?.viewAllCard,
        } as any;
        return <MoreProductsSection config={config} />;
      }

      default:
        if (GENERIC.has(block.type)) {
          return <LandingRenderer content={[block as any]} countryCode={countryCode} />;
        }
        return null;
    }
  };

  return (
    <>
      {blocks.map((block, i) => (
        <Suspense key={block.props?.id ?? i} fallback={null}>
          {renderBlock(block)}
        </Suspense>
      ))}
    </>
  );
}
