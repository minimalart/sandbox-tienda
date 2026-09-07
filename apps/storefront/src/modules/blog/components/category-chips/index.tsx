import LocalizedClientLink from '@modules/common/components/localized-client-link';
import type { BlogCategoryPublic } from '@lib/data/blog';
import { clx } from '@medusajs/ui';

type Props = {
  categories: BlogCategoryPublic[];
  activeSlug?: string;
};

/** Horizontal list of category links for the blog. */
const CategoryChips = ({ categories, activeSlug }: Props) => {
  if (!categories.length) return null;
  return (
    <nav className="flex flex-wrap gap-2">
      <LocalizedClientLink
        href="/blog"
        className={clx(
          'rounded-full border px-3 py-1.5 text-sm transition-colors',
          !activeSlug
            ? 'border-[--primary-color] bg-[--primary-color] text-white'
            : 'border-gray-300 text-gray-600 hover:border-[--primary-color] hover:text-[--primary-color]',
        )}
      >
        Todos
      </LocalizedClientLink>
      {categories.map((c) => (
        <LocalizedClientLink
          key={c.id}
          href={`/blog/categoria/${c.slug}`}
          className={clx(
            'rounded-full border px-3 py-1.5 text-sm transition-colors',
            activeSlug === c.slug
              ? 'border-[--primary-color] bg-[--primary-color] text-white'
              : 'border-gray-300 text-gray-600 hover:border-[--primary-color] hover:text-[--primary-color]',
          )}
        >
          {c.name}
        </LocalizedClientLink>
      ))}
    </nav>
  );
};

export default CategoryChips;
