import { getBlogPostBySlug, listBlogCategories } from '@lib/data/blog';
import { getProductsByIds } from '@lib/data/products';
import { canonicalUrl } from '@lib/util/site-url';
import ArticleDetailTemplate from '@modules/blog/templates/article-detail';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Igual que el listado: render por request para resolver el sales channel de la
// demo (x-demo-slug). Sin esto los productos relacionados se piden con el canal
// default y quedan filtrados (no aparecen en la demo).
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countryCode: string; slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await getBlogPostBySlug(slug);
  if (!data) {
    return { title: 'No encontrado' };
  }
  const { post } = data;
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || undefined;
  return {
    title,
    description,
    alternates: { canonical: await canonicalUrl(`/blog/${post.slug}`) },
    openGraph: {
      title,
      description,
      type: 'article',
      images: post.cover_image?.url ? [{ url: post.cover_image.url }] : undefined,
    },
  };
}

export default async function BlogPostPage(props: Props) {
  const { slug, countryCode } = await props.params;
  const { preview } = await props.searchParams;
  const isPreview = preview === '1' || preview === 'true';

  const data = await getBlogPostBySlug(slug, isPreview);
  if (!data) {
    notFound();
  }

  const { post, productIds, relatedPosts } = data;

  const [products, categories] = await Promise.all([
    productIds.length
      ? getProductsByIds({ productIds, countryCode })
      : Promise.resolve([]),
    listBlogCategories(),
  ]);

  const category = post.category_id
    ? categories.find((c) => c.id === post.category_id)
    : undefined;

  return (
    <ArticleDetailTemplate
      post={post}
      products={products}
      relatedPosts={relatedPosts}
      categoryName={category?.name}
      categorySlug={category?.slug}
    />
  );
}
