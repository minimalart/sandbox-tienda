import { getFirstBannerForPlacement, type ApiBanner } from "@lib/banners";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import type { CollectionConfig } from "@lib/site-config/types";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Reveal from "@modules/common/components/reveal";
import ViewAllCard from "@modules/home/components/ui/view-all-card";
import Image from "next/image";

type CollectionsSectionProps = {
  banners: ApiBanner[];
  countryCode: string;
  configKey?: "collections" | "renewEnergy";
  /**
   * Config de contenido inyectada por el editor del home (bloque Puck). Si se
   * provee, se usa en lugar de `tenant.assets[configKey]`.
   */
  config?: CollectionConfig;
};

const DEFAULT_BACKGROUNDS = ["#e6f2ff", "#EAF0E8", "#EEECEB", "#f8f1f5"];

type CollectionItem = {
  collectionId: string;
  handle?: string;
  searchQuery?: string;
  href?: string;
  image?: string;
  label?: string;
  backgroundColor?: string;
  /** Imagen de fondo de la card. Si está seteada, pisa `backgroundColor`. */
  backgroundImage?: string;
};

const COLLECTION_PLACEMENTS = ["banner_4", "banner_5", "banner_6"];

const isRenderableCollection = (item: CollectionItem) =>
  Boolean(item.label && item.image && item.href);

export default async function CollectionsSection({
  banners,
  countryCode,
  configKey = "collections",
  config,
}: CollectionsSectionProps) {
  const tenant = await getActiveTenant();
  const apiBanners = COLLECTION_PLACEMENTS.map((placement) =>
    getFirstBannerForPlacement(banners, placement),
  ).filter((banner): banner is ApiBanner => Boolean(banner));
  const collectionsConfig = config ?? tenant.assets[configKey];

  const sectionTitle = collectionsConfig?.title;
  const sectionSubtitle = collectionsConfig?.subtitle;
  const backgrounds = collectionsConfig?.backgrounds || DEFAULT_BACKGROUNDS;
  const viewAllCard = collectionsConfig?.viewAllCard;
  const fallbackCollections: CollectionItem[] = (
    collectionsConfig?.collections ?? []
  ).map((config) => ({
    collectionId: config.collectionId,
    handle: config.handle,
    searchQuery: config.searchQuery,
    href: config.href,
    image: config.image,
    label: config.label,
    backgroundColor: config.backgroundColor,
    backgroundImage: config.backgroundImage,
  }));

  // Use API banners if available, otherwise fall back to tenant config
  const collections: CollectionItem[] =
    apiBanners.length > 0
      ? COLLECTION_PLACEMENTS.map((placement, index) => {
          const banner = getFirstBannerForPlacement(banners, placement);
          const mappedCollection = banner
            ? {
                collectionId: banner.id,
                href: banner.href,
                image: banner.image,
                label: banner.title,
                backgroundColor: banner.card_color,
              }
            : undefined;

          return mappedCollection && isRenderableCollection(mappedCollection)
            ? mappedCollection
            : fallbackCollections[index];
        }).filter((item): item is CollectionItem => Boolean(item))
      : fallbackCollections;

  if (!collections.length) {
    return null;
  }

  // Total cards in the row (collections + the "view all" CTA card) so the
  // desktop grid always keeps everything on a single row.
  const totalCards = collections.length + (viewAllCard ? 1 : 0);
  const GRID_COLS: Record<number, string> = {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  };
  const gridColsClass = GRID_COLS[Math.min(totalCards, 6)] ?? "lg:grid-cols-4";

  return (
    <Reveal as="section" className="bg-white py-10 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="home-section-heading">{sectionTitle}</p>
          {sectionSubtitle && (
            <p className="mt-1 text-sm font-normal text-gray-500 sm:text-base">
              {sectionSubtitle}
            </p>
          )}
        </div>

        <div className="relative sm:mx-0">
          <div
            className={`no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-6 sm:px-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible ${gridColsClass}`}
          >
            {collections.map((item, index) => {
              const isHighlight = index === 0;
              const backgroundColor =
                item.backgroundColor ||
                (isHighlight
                  ? "#EBF1F6"
                  : backgrounds[index % backgrounds.length]);
              const backgroundImage = item.backgroundImage;

              // Con imagen de fondo y sin imagen propia, la card es solo el
              // fondo + el label (no forzamos el thumbnail por defecto).
              const imageSrc =
                item.image ||
                (backgroundImage ? "" : "/images/category-difusores.webp");
              const label = item.label || "Colección";

              const cardHref = item.href
                ? item.href
                : item.handle
                  ? `/store?category=${item.handle}`
                  : item.searchQuery
                    ? `/store?q=${item.searchQuery}`
                    : `/store?category=${item.collectionId}`;

              return (
                <Reveal
                  as="article"
                  className="flex basis-[calc(100%/1.5)] flex-none snap-start snap-always flex-col overflow-hidden rounded-3xl shadow-sm ring-1 ring-gray-100 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg md:flex-1 md:basis-auto"
                  delay={index * 80}
                  key={item.collectionId}
                  style={
                    backgroundImage
                      ? {
                          backgroundColor,
                          backgroundImage: `url("${backgroundImage}")`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : { backgroundColor }
                  }
                >
                  <LocalizedClientLink
                    className={`flex h-full flex-col p-6 ${imageSrc ? "" : "min-h-72"}`}
                    href={cardHref}
                  >
                    {imageSrc && (
                      <div className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl">
                        <Image
                          alt={label}
                          className="object-cover"
                          fill
                          priority={index === 0}
                          sizes="(max-width: 1024px) 50vw, 280px"
                          src={imageSrc}
                        />
                      </div>
                    )}

                    <div className="mt-auto">
                      <span className="inline-flex items-center rounded bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition-colors">
                        {label}
                      </span>
                    </div>
                  </LocalizedClientLink>
                </Reveal>
              );
            })}

            {viewAllCard && (
              <Reveal
                as="div"
                className="flex basis-[calc(100%/1.5)] flex-none snap-start snap-always md:flex-1 md:basis-auto"
                delay={collections.length * 80}
              >
                <ViewAllCard
                  href={viewAllCard.href}
                  subtitle={viewAllCard.subtitle}
                  title={viewAllCard.title}
                />
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </Reveal>
  );
}
