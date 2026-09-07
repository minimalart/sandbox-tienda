import {
  getBlogCategoryBySlug,
  getBlogSettings,
  listBlogCategories,
  listBlogPosts,
} from '@lib/data/blog';
import { canonicalUrl } from '@lib/util/site-url';
import CategoryListTemplate from '@modules/blog/templates/category-list';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ countryCode: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await getBlogCategoryBySlug(slug);
  if (!category) {
    return { title: 'No encontrado' };
  }
  return {
    title: category.name,
    description: category.description || undefined,
    alternates: { canonical: await canonicalUrl(`/blog/categoria/${category.slug}`) },
    openGraph: { title: category.name, type: 'website' },
  };
}

export default async function BlogCategoryPage(props: Props) {
  const { slug } = await props.params;
  const { page: pageParam } = await props.searchParams;
  const category = await getBlogCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const settings = await getBlogSettings();
  const perPage = settings.posts_per_page || 12;
  const page = Math.max(1, Number(pageParam) || 1);
  const [categories, { posts, count }] = await Promise.all([
    listBlogCategories(),
    listBlogPosts({
      categoryId: category.id,
      limit: perPage,
      offset: (page - 1) * perPage,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(count / perPage));

  return (
    <CategoryListTemplate
      category={category}
      categories={categories}
      posts={posts}
      page={page}
      totalPages={totalPages}
    />
  );
}
