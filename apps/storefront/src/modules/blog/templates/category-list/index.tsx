import ArticleListItem from '@modules/blog/components/article-list-item';
import BlogPagination from '@modules/blog/components/blog-pagination';
import CategoryChips from '@modules/blog/components/category-chips';
import type { BlogCategoryPublic, BlogPostCard } from '@lib/data/blog';

type Props = {
  category: BlogCategoryPublic;
  categories: BlogCategoryPublic[];
  posts: BlogPostCard[];
  page: number;
  totalPages: number;
};

const CategoryListTemplate = ({
  category,
  categories,
  posts,
  page,
  totalPages,
}: Props) => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:py-12 lg:px-8">
      <header className="mb-8 flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
        {category.description ? (
          <p className="max-w-2xl text-gray-500">{category.description}</p>
        ) : null}
        <CategoryChips categories={categories} activeSlug={category.slug} />
      </header>

      {posts.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          No hay artículos en esta categoría.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <ArticleListItem
              key={post.id}
              post={post}
              categoryName={category.name}
            />
          ))}
        </div>
      )}

      <BlogPagination
        page={page}
        totalPages={totalPages}
        basePath={`/blog/categoria/${category.slug}`}
      />
    </div>
  );
};

export default CategoryListTemplate;
