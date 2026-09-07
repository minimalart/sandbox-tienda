import ArticleListItem from '@modules/blog/components/article-list-item';
import BlogPagination from '@modules/blog/components/blog-pagination';
import BlogSearch from '@modules/blog/components/blog-search';
import CategoryChips from '@modules/blog/components/category-chips';
import type {
  BlogCategoryPublic,
  BlogPostCard,
  BlogSettingsPublic,
} from '@lib/data/blog';

type Props = {
  settings: BlogSettingsPublic;
  categories: BlogCategoryPublic[];
  posts: BlogPostCard[];
  page: number;
  totalPages: number;
  query?: string;
};

const BlogHomeTemplate = ({
  settings,
  categories,
  posts,
  page,
  totalPages,
  query,
}: Props) => {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 md:py-12 lg:px-8">
      <header className="mb-8 flex flex-col gap-4">
        <h1 className="text-3xl font-bold text-gray-900">
          {settings.section_name || 'Blog'}
        </h1>
        {settings.show_search ? (
          <div className="max-w-xl">
            <BlogSearch />
          </div>
        ) : null}
        {settings.show_categories ? (
          <CategoryChips categories={categories} />
        ) : null}
      </header>

      {query ? (
        <p className="mb-4 text-sm text-gray-500">Resultados para “{query}”</p>
      ) : null}

      {posts.length === 0 ? (
        <p className="py-16 text-center text-gray-500">
          No hay artículos para mostrar.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <ArticleListItem
              key={post.id}
              post={post}
              categoryName={
                post.category_id
                  ? categoryName.get(post.category_id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <BlogPagination
        page={page}
        totalPages={totalPages}
        basePath="/blog"
        params={{ q: query }}
      />
    </div>
  );
};

export default BlogHomeTemplate;
