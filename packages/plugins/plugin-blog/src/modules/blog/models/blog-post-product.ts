import { model } from '@medusajs/framework/utils';

/**
 * BlogPostProduct — ordered association between a blog post and a catalog
 * product. `product_id` is a plain text column (no FK to the product table),
 * mirroring the vimeo-video `product_video_link` approach; products are
 * hydrated from the store products endpoint by id. `sort_order` preserves the
 * admin's drag & drop ordering.
 */
export const BlogPostProduct = model
  .define('blog_post_product', {
    id: model.id({ prefix: 'bpp' }).primaryKey(),
    blog_post_id: model.text(),
    product_id: model.text(),
    sort_order: model.number().default(0),
  })
  .indexes([
    { on: ['blog_post_id'] },
    {
      on: ['blog_post_id', 'product_id'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
  ]);

export default BlogPostProduct;
