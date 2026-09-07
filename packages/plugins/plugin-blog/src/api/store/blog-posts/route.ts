import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { BLOG_MODULE } from '../../../modules/blog';
import type BlogModuleService from '../../../modules/blog/service';
import {
  toPublicBlogCard,
  isPostInSalesChannel,
  readStrictFlag,
} from './helpers';

/**
 * GET /store/blog-posts — public, PUBLISHED posts only. Supports `category_id`,
 * `q`, `limit`/`offset`. Ordered by published_at desc. Returns card projections
 * (no body) to keep the list response light.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: BlogModuleService = req.scope.resolve(BLOG_MODULE);
    const limit = req.query.limit ? Number(req.query.limit) : 12;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const category_id =
      typeof req.query.category_id === 'string'
        ? req.query.category_id
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const salesChannelId =
      typeof req.query.sales_channel_id === 'string'
        ? req.query.sales_channel_id
        : undefined;
    const strict = readStrictFlag(req.query);

    const filters: Record<string, unknown> = { status: 'published' };
    if (category_id) {
      filters.category_id = category_id;
    }
    if (q) {
      filters.$or = [
        { title: { $ilike: `%${q}%` } },
        { excerpt: { $ilike: `%${q}%` } },
      ];
    }

    // El canal filtra por pertenencia a sales_channel_ids (ver
    // isPostInSalesChannel). Como es un array JSON, traemos los publicados que
    // matchean (sin paginar en DB) y paginamos en JS. Los blogs son pocos, así
    // que es barato. Sin canal (callers legacy) mantenemos la query paginada en
    // DB, sin cambios.
    if (salesChannelId) {
      const [all] = await service.listAndCountBlogPosts(filters, {
        order: { published_at: 'DESC' },
      });
      const scoped = (all as Record<string, any>[]).filter((post) =>
        isPostInSalesChannel(post, salesChannelId, strict),
      );
      const paged = scoped.slice(offset, offset + limit);
      return res.status(200).json({
        blog_posts: paged.map(toPublicBlogCard),
        count: scoped.length,
        limit,
        offset,
      });
    }

    const [posts, count] = await service.listAndCountBlogPosts(filters, {
      skip: offset,
      take: limit,
      order: { published_at: 'DESC' },
    });

    return res.status(200).json({
      blog_posts: (posts as Record<string, any>[]).map(toPublicBlogCard),
      count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Store BlogPosts] Error listing posts:', error);
    return res.status(500).json({ message: 'Error fetching blog posts' });
  }
}
