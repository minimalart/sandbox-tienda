import ArticleCard from '@modules/blog/components/article-card';
import BackButton from '@modules/blog/components/back-button';
import ArticleContent from '@modules/blog/components/article-content';
import ArticleShare from '@modules/blog/components/article-share';
import RelatedProducts from '@modules/blog/components/related-products';
import LocalizedClientLink from '@modules/common/components/localized-client-link';
import type { BlogPostCard, BlogPostDetail } from '@lib/data/blog';
import type { HttpTypes } from '@medusajs/types';
import Image from 'next/image';

type Props = {
  post: BlogPostDetail;
  products: HttpTypes.StoreProduct[];
  relatedPosts: BlogPostCard[];
  categoryName?: string;
  categorySlug?: string;
};

const CalendarIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const ArticleDetailTemplate = ({
  post,
  products,
  relatedPosts,
  categoryName,
  categorySlug,
}: Props) => {
  const date = post.published_at ?? post.updated_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <article className="mx-auto max-w-7xl px-6 py-8 md:py-12 lg:px-8">
      <div className="mb-4">
        <BackButton fallbackHref="/blog" />
      </div>

      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-gray-400">
        <LocalizedClientLink href="/blog" className="hover:text-[--primary-color]">
          Blog
        </LocalizedClientLink>
        {categoryName ? (
          <>
            <span>/</span>
            <LocalizedClientLink
              href={categorySlug ? `/blog/categoria/${categorySlug}` : '/blog'}
              className="hover:text-[--primary-color]"
            >
              {categoryName}
            </LocalizedClientLink>
          </>
        ) : null}
      </nav>

      <header className="mb-6 flex flex-col gap-4">
        <h1 className="text-3xl font-bold leading-tight text-gray-900 md:text-4xl">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="max-w-3xl text-lg text-gray-500">{post.excerpt}</p>
        ) : null}
        {formattedDate ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <CalendarIcon />
            <time>{formattedDate}</time>
          </div>
        ) : null}
      </header>

      {post.cover_image?.url ? (
        <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100">
          <Image
            src={post.cover_image.url}
            alt={post.cover_image.alt || post.title}
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Body. `min-w-0` evita que contenido ancho (tablas, code, imágenes)
            expanda la columna del grid y desborde el ancho máximo. */}
        <div className="min-w-0 lg:col-span-2">
          <ArticleContent html={post.content_html} />
          {/* Products on mobile: justo debajo del contenido y por encima de la
              sección de compartir, para que no queden al fondo de todo. */}
          {products.length > 0 ? (
            <div className="mt-8 lg:hidden">
              <RelatedProducts products={products} />
            </div>
          ) : null}
          <div className="mt-10 border-t border-gray-200 pt-6">
            <ArticleShare title={post.title} />
          </div>
        </div>

        {/* Sticky products sidebar on desktop */}
        {products.length > 0 ? (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <RelatedProducts products={products} />
            </div>
          </aside>
        ) : null}
      </div>

      {/* Related articles */}
      {relatedPosts.length > 0 ? (
        <section className="mt-14 border-t border-gray-200 pt-10">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">
            Artículos relacionados
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relatedPosts.map((rp) => (
              <ArticleCard key={rp.id} post={rp} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
};

export default ArticleDetailTemplate;
