import LocalizedClientLink from '@modules/common/components/localized-client-link';
import type { BlogPostCard } from '@lib/data/blog';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

type Props = {
  post: BlogPostCard;
  categoryName?: string;
  byline?: string;
};

const CalendarIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const ArrowIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
    <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Horizontal listing row for a blog article (cover left, content right, a
 * "Leer más" CTA). Used by the blog home and category pages. Stacks on mobile.
 */
const ArticleListItem = ({ post, categoryName, byline }: Props) => {
  const date = post.published_at ?? post.updated_at;
  return (
    <article className="group flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:p-4">
      <LocalizedClientLink
        href={`/blog/${post.slug}`}
        className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:aspect-square sm:h-40 sm:w-40 lg:h-44 lg:w-52"
      >
        {post.cover_image?.url ? (
          <Image
            src={post.cover_image.url}
            alt={post.cover_image.alt || post.title}
            fill
            sizes="(max-width: 640px) 100vw, 220px"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
      </LocalizedClientLink>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {categoryName ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-[--primary-color]">
            {categoryName}
          </span>
        ) : null}
        <LocalizedClientLink href={`/blog/${post.slug}`}>
          <h2 className="text-lg font-bold text-gray-900 transition-colors group-hover:text-[--primary-color] sm:text-xl">
            {post.title}
          </h2>
        </LocalizedClientLink>
        {post.excerpt ? (
          <p className="line-clamp-2 text-sm text-gray-500">{post.excerpt}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          {date ? (
            <span className="flex items-center gap-1.5">
              <CalendarIcon />
              {new Date(date).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          ) : null}
          {byline ? <span>Por {byline}</span> : null}
        </div>
      </div>

      <div className="shrink-0 sm:pl-2">
        <Button
          asChild
          className="w-full px-5 py-2.5 sm:w-auto"
          size="storefront"
          variant="storefront"
        >
          <LocalizedClientLink href={`/blog/${post.slug}`}>
            Leer más
            <ArrowIcon />
          </LocalizedClientLink>
        </Button>
      </div>
    </article>
  );
};

export default ArticleListItem;
