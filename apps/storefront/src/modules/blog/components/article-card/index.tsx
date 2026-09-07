import LocalizedClientLink from '@modules/common/components/localized-client-link';
import type { BlogPostCard } from '@lib/data/blog';
import Image from 'next/image';

type Props = {
  post: BlogPostCard;
  categoryName?: string;
};

/** Listing card for a blog article: cover, category, title, excerpt, date. */
const ArticleCard = ({ post, categoryName }: Props) => {
  const date = post.published_at ?? post.updated_at;
  return (
    <LocalizedClientLink
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base transition-shadow hover:shadow-elevation-card-hover"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-ui-bg-component">
        {post.cover_image?.url ? (
          <Image
            src={post.cover_image.url}
            alt={post.cover_image.alt || post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {categoryName ? (
          <span className="text-xs font-medium uppercase tracking-wide text-[--primary-color]">
            {categoryName}
          </span>
        ) : null}
        <h3 className="text-base font-semibold text-ui-fg-base line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="text-sm text-ui-fg-subtle line-clamp-3">{post.excerpt}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          {date ? (
            <time className="text-xs text-ui-fg-muted">
              {new Date(date).toLocaleDateString('es-AR')}
            </time>
          ) : (
            <span />
          )}
          <span className="text-sm font-medium text-[--primary-color] group-hover:underline">
            Leer más
          </span>
        </div>
      </div>
    </LocalizedClientLink>
  );
};

export default ArticleCard;
