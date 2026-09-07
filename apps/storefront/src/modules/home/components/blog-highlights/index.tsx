import { listBlogCategories, listBlogPosts } from "@lib/data/blog";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import type { BlogHighlightsConfig } from "@lib/site-config/types";
import { Button } from "@/components/ui/button";
import ProductImage from "@modules/common/components/product-image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Reveal from "@modules/common/components/reveal";
import { ArrowUpRight } from "lucide-react";

/**
 * Notas del blog en el home (template grocery/supermercado).
 *
 * Trae las dos últimas notas publicadas del canal activo (el helper de blog ya
 * scopea por canal y es estricto en demos): la más reciente destacada en una
 * card ancha (2/3) + la siguiente en una card vertical (1/3).
 *
 * No hay contenido en `assets`: los artículos son los reales del blog. La config
 * (`assets.blogHighlights` o el bloque del editor de home) solo ajusta textos.
 * Si el demo oculta el blog (`sectionVisibility.blog === false`) o no hay
 * artículos, la sección no se renderiza.
 */

/**
 * Cantidad fija: la nota destacada (2/3) + una secundaria (1/3), que es el
 * layout de la fila. NO es configurable a propósito: cuando lo era, los homes
 * que ya tenían el bloque guardado con otro valor (p. ej. `limit: 3`) seguían
 * mostrando de más aunque el default bajara a 2.
 */
const POSTS_LIMIT = 2;

export default async function BlogHighlights({
  config: configOverride,
}: {
  /** Config inyectada por el editor del home; fallback a `assets.blogHighlights`. */
  config?: BlogHighlightsConfig;
} = {}) {
  const tenant = await getActiveTenant();
  if (tenant.assets.sectionVisibility?.blog === false) return null;

  const config = configOverride ?? tenant.assets.blogHighlights ?? {};

  const { posts } = await listBlogPosts({
    limit: POSTS_LIMIT,
    categoryId: config.categoryId || undefined,
  });
  if (!posts.length) return null;

  // Los nombres de categoría son un adorno: si la llamada falla la sección igual
  // se muestra sin el eyebrow.
  const categories = await listBlogCategories().catch(() => []);
  const categoryName = (id?: string | null) =>
    id ? categories.find((c) => c.id === id)?.name : undefined;

  const title =
    config.title || tenant.assets.blogSectionName || "Recetas y consejos";
  const subtitle =
    config.subtitle ?? "Ideas y tips para aprovechar al máximo tu compra.";
  const featuredCtaLabel = config.featuredCtaLabel || "Leer nota";
  const ctaLabel = config.ctaLabel || "Leer nota";
  const viewAllLabel = config.viewAllLabel ?? "Ver todas las notas";

  const [featured, ...rest] = posts;

  return (
    <section className="bg-white py-8">
      <Reveal as="div" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="home-section-heading">{title}</p>
            {subtitle && (
              <p className="mt-1 text-sm font-normal text-gray-500 sm:text-base">
                {subtitle}
              </p>
            )}
          </div>
          {viewAllLabel && (
            <Button
              asChild
              className="group hidden sm:inline-flex"
              size="storefront"
              variant="storefront"
            >
              <LocalizedClientLink href="/blog">
                {viewAllLabel}
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </LocalizedClientLink>
            </Button>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Con una sola nota publicada la destacada ocupa toda la fila en vez
              de dejar un hueco. */}
          <Reveal
            as="div"
            className={rest.length ? "lg:col-span-2" : "lg:col-span-3"}
          >
            <FeaturedCard
              post={featured}
              categoryName={categoryName(featured.category_id)}
              ctaLabel={featuredCtaLabel}
            />
          </Reveal>

          {rest.map((post, index) => (
            <Reveal as="div" key={post.id} delay={(index + 1) * 60}>
              <CompactCard
                post={post}
                categoryName={categoryName(post.category_id)}
                ctaLabel={ctaLabel}
              />
            </Reveal>
          ))}
        </div>

        {/* En mobile el CTA baja debajo de las cards. Va envuelto porque el
            Button es `inline-flex`: centrarlo con `mx-auto` no tendría efecto. */}
        {viewAllLabel && (
          <div className="mt-4 flex justify-center sm:hidden">
            <Button asChild size="storefront" variant="storefront">
              <LocalizedClientLink href="/blog">
                {viewAllLabel}
                <ArrowUpRight className="h-4 w-4" />
              </LocalizedClientLink>
            </Button>
          </div>
        )}
      </Reveal>
    </section>
  );
}

type CardProps = {
  post: Awaited<ReturnType<typeof listBlogPosts>>["posts"][number];
  categoryName?: string;
  ctaLabel: string;
};

/** Card ancha del artículo más reciente: copy a la izquierda, imagen a la derecha. */
const FeaturedCard = ({ post, categoryName, ctaLabel }: CardProps) => (
  <LocalizedClientLink
    href={`/blog/${post.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-3xl bg-[#f3f5f6] transition-shadow hover:shadow-md sm:flex-row"
  >
    <div className="flex flex-1 flex-col justify-center gap-4 p-6 sm:p-8">
      {categoryName && (
        <span className="text-xs font-medium uppercase tracking-wide text-[--primary-color]">
          {categoryName}
        </span>
      )}
      <h3 className="text-2xl font-bold leading-tight text-[#111827] line-clamp-3 sm:text-[28px]">
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="text-sm text-gray-500 line-clamp-3 sm:text-base">
          {post.excerpt}
        </p>
      )}
      <Button
        asChild
        className="mt-2 w-fit shadow-sm"
        size="storefront"
        variant="storefront"
      >
        <span>{ctaLabel}</span>
      </Button>
    </div>
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 sm:aspect-auto sm:w-1/2 sm:self-stretch">
      <ProductImage
        src={post.cover_image?.url}
        alt={post.cover_image?.alt || post.title}
        fill
        sizes="(max-width: 640px) 100vw, 45vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  </LocalizedClientLink>
);

/** Card vertical: imagen arriba, título y CTA primario abajo. */
const CompactCard = ({ post, categoryName, ctaLabel }: CardProps) => (
  <LocalizedClientLink
    href={`/blog/${post.slug}`}
    className="group flex h-full flex-col overflow-hidden rounded-3xl bg-[#f3f5f6] transition-shadow hover:shadow-md"
  >
    <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
      <ProductImage
        src={post.cover_image?.url}
        alt={post.cover_image?.alt || post.title}
        fill
        sizes="(max-width: 1024px) 100vw, 30vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
      />
    </div>
    <div className="flex flex-1 flex-col gap-3 p-6">
      {categoryName && (
        <span className="text-xs font-medium uppercase tracking-wide text-[--primary-color]">
          {categoryName}
        </span>
      )}
      <h3 className="text-xl font-bold leading-tight text-[#111827] line-clamp-3">
        {post.title}
      </h3>
      <Button
        asChild
        className="mt-auto w-fit"
        size="storefront"
        variant="storefront"
      >
        <span>{ctaLabel}</span>
      </Button>
    </div>
  </LocalizedClientLink>
);
