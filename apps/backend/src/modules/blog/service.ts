import { MedusaService } from '@medusajs/framework/utils';
import {
  BlogPost,
  BlogCategory,
  BlogPostProduct,
  BlogSettings,
} from './models';

type SearchPostsOptions = {
  status?: string;
  category_id?: string;
  limit?: number;
  offset?: number;
  /**
   * Filtro extra ya resuelto por el llamador — hoy sólo el de tienda activa
   * (`siteFilter` de `lib/multistore`). Se mergea DENTRO de listAndCount para que
   * `count` siga coincidiendo con lo paginado.
   */
  extraFilters?: Record<string, unknown>;
};

class BlogModuleService extends MedusaService({
  BlogPost,
  BlogCategory,
  BlogPostProduct,
  BlogSettings,
}) {
  /** URL-safe slug from a title (accent-folded, lowercased, hyphenated). */
  generateSlug(title: string): string {
    const base = (title || '')
      .toLowerCase()
      .normalize('NFD')
      // strip combining diacritical marks (U+0300–U+036F)
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96);
    return base || 'post';
  }

  /** Returns a slug not used by another (non-deleted) post. */
  async ensureUniquePostSlug(slug: string, excludeId?: string): Promise<string> {
    const normalized = this.generateSlug(slug);
    let candidate = normalized;
    let suffix = 2;
    for (;;) {
      const existing = await this.listBlogPosts({ slug: candidate });
      const taken = existing.some((p: { id: string }) => p.id !== excludeId);
      if (!taken) {
        return candidate;
      }
      candidate = `${normalized}-${suffix}`;
      suffix += 1;
    }
  }

  /** Returns a slug not used by another (non-deleted) category. */
  async ensureUniqueCategorySlug(
    slug: string,
    excludeId?: string,
  ): Promise<string> {
    const normalized = this.generateSlug(slug);
    let candidate = normalized;
    let suffix = 2;
    for (;;) {
      const existing = await this.listBlogCategories({ slug: candidate });
      const taken = existing.some((c: { id: string }) => c.id !== excludeId);
      if (!taken) {
        return candidate;
      }
      candidate = `${normalized}-${suffix}`;
      suffix += 1;
    }
  }

  /** List + count posts with optional text search, status and category filters. */
  async searchPosts(q: string | undefined, opts: SearchPostsOptions = {}) {
    const filters: Record<string, unknown> = {};
    if (opts.status) {
      filters.status = opts.status;
    }
    if (opts.category_id) {
      filters.category_id = opts.category_id;
    }
    if (q && q.trim()) {
      filters.$or = [
        { title: { $ilike: `%${q.trim()}%` } },
        { excerpt: { $ilike: `%${q.trim()}%` } },
        { slug: { $ilike: `%${q.trim()}%` } },
      ];
    }
    Object.assign(filters, opts.extraFilters ?? {});

    return this.listAndCountBlogPosts(filters, {
      skip: opts.offset ?? 0,
      take: opts.limit ?? 20,
      order: { created_at: 'DESC' },
    });
  }

  /** Returns the published post for a slug, or undefined. */
  async getPublishedBySlug(slug: string) {
    const [post] = await this.listBlogPosts(
      { slug, status: 'published' },
      { take: 1 },
    );
    return post;
  }

  /** Returns the linked product ids for a post, ordered by sort_order. */
  async getPostProductIds(blogPostId: string): Promise<string[]> {
    const links = await this.listBlogPostProducts(
      { blog_post_id: blogPostId },
      { order: { sort_order: 'ASC' } },
    );
    return links.map((l: { product_id: string }) => l.product_id);
  }

  /** Replaces a post's product associations with the given ordered ids. */
  async setPostProducts(blogPostId: string, productIds: string[]) {
    const existing = await this.listBlogPostProducts({
      blog_post_id: blogPostId,
    });
    if (existing.length) {
      await this.deleteBlogPostProducts(
        existing.map((l: { id: string }) => l.id),
      );
    }
    if (!productIds.length) {
      return [];
    }
    return this.createBlogPostProducts(
      productIds.map((product_id, index) => ({
        blog_post_id: blogPostId,
        product_id,
        sort_order: index,
      })),
    );
  }

  /** Returns the singleton settings row, creating defaults on first access. */
  /**
   * La configuración EFECTIVA de una tienda: la suya si la definió, la global si no.
   *
   * La creación perezosa es SIEMPRE sobre la fila global. Crear una por tienda la
   * primera vez que alguien mira la pantalla congelaría los defaults de ese momento,
   * y a partir de ahí cambiar el global ya no se propagaría a esa tienda.
   */
  async getSettings(siteId?: string | null) {
    if (siteId) {
      const [own] = await this.listBlogSettings({ site_id: siteId }, { take: 1 });
      if (own) return own;
    }
    const [existing] = await this.listBlogSettings({ site_id: null }, { take: 1 });
    if (existing) {
      return existing;
    }
    return this.createBlogSettings({ site_id: null });
  }

  /**
   * Guarda la configuración de UNA tienda, creando su fila si no existe.
   *
   * Parte del valor EFECTIVO, no de los defaults: el operador abre la pantalla, ve el
   * heredado, cambia un campo y espera que el resto quede como lo veía.
   */
  async upsertSettingsForSite(siteId: string | null, values: Record<string, unknown>) {
    const current = (await this.getSettings(siteId)) as unknown as Record<string, unknown>;
    if ((current.site_id ?? null) === siteId) {
      return this.updateBlogSettings({ id: current.id as string, ...values });
    }
    const { id: _ignored, ...inherited } = current;
    return this.createBlogSettings({ ...inherited, site_id: siteId, ...values });
  }

  /** Upserts the singleton settings row. */
  async updateSettings(data: Record<string, unknown>) {
    const current = await this.getSettings();
    return this.updateBlogSettings({ id: current.id, ...data });
  }
}

export default BlogModuleService;
