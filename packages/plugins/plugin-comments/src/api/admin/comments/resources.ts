import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

type QueryLike = {
  graph: (input: unknown) => Promise<{ data: unknown[] }>;
};

export type CommentableType = 'product' | 'blog_post';

/**
 * Resumen del recurso comentado (producto o artículo) para el backoffice: sin
 * esto la moderación muestra solo un `commentable_id` opaco y el moderador no
 * sabe SOBRE QUÉ está aprobando ni cómo llegar a la publicación.
 *
 * - `admin_path`: path dentro del admin (se navega como `/app` + esto).
 * - `storefront_url`: URL pública absoluta de la publicación.
 */
export type CommentResource = {
  type: CommentableType;
  id: string;
  title: string | null;
  /** `handle` del producto / `slug` del artículo. */
  handle: string | null;
  thumbnail: string | null;
  /** 'published' | 'draft' | 'proposed' | … según la entidad. */
  status: string | null;
  admin_path: string | null;
  storefront_url: string | null;
};

const isLocal = (u: string): boolean =>
  /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u);

const isNonStorefront = (u: string): boolean => /medusajs\.com/i.test(u);

/**
 * Base pública del storefront, resuelta en runtime con la misma lógica que
 * `GET /admin/store-config/storefront-url` (STOREFRONT_URL explícita, si no el
 * primer origin público de STORE_CORS). Se duplica a propósito para que la
 * extensión no dependa de otra: son ~10 líneas de env.
 */
function resolveStorefrontBase(): string {
  const origins = (process.env.STORE_CORS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const publicOrigins = origins.filter((o) => !isLocal(o) && !isNonStorefront(o));
  const fromCors =
    publicOrigins.find((o) => o.startsWith('https://')) ||
    publicOrigins[0] ||
    origins[0];

  return (
    process.env.STOREFRONT_URL?.trim() ||
    fromCors ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

/**
 * `query.graph` tolerante: si el módulo dueño de la entidad no está instalado
 * (ej. una tienda con `comments` pero sin la extensión de blog) el grafo tira, y
 * eso no debe romper el listado de moderación — se degrada a "sin resumen".
 */
async function safeGraph<T>(
  query: QueryLike,
  input: unknown,
): Promise<T[]> {
  try {
    const { data } = await query.graph(input);
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

const uniq = (values: string[]): string[] =>
  [...new Set(values.filter(Boolean))];

/** Clave del mapa: el par polimórfico completo. */
export const resourceKey = (type: string, id: string): string => `${type}:${id}`;

/**
 * Trae los resúmenes de los recursos comentados, indexados por
 * `${commentable_type}:${commentable_id}`. Una query por tipo presente.
 */
export async function loadCommentResources(
  container: MedusaContainer,
  targets: { commentable_type: string; commentable_id: string }[],
): Promise<Map<string, CommentResource>> {
  const out = new Map<string, CommentResource>();
  if (!targets.length) return out;

  const query = container.resolve<QueryLike>(ContainerRegistrationKeys.QUERY);
  const base = resolveStorefrontBase();

  const productIds = uniq(
    targets
      .filter((t) => t.commentable_type === 'product')
      .map((t) => t.commentable_id),
  );
  const postIds = uniq(
    targets
      .filter((t) => t.commentable_type === 'blog_post')
      .map((t) => t.commentable_id),
  );

  if (productIds.length) {
    const products = await safeGraph<{
      id: string;
      title?: string | null;
      handle?: string | null;
      thumbnail?: string | null;
      status?: string | null;
    }>(query, {
      entity: 'product',
      // Sin filtro de status: el moderador tiene que poder ver que el comentario
      // es de un producto que quedó en borrador.
      fields: ['id', 'title', 'handle', 'thumbnail', 'status'],
      filters: { id: productIds },
    });

    for (const p of products) {
      if (!p?.id) continue;
      out.set(resourceKey('product', p.id), {
        type: 'product',
        id: p.id,
        title: p.title ?? null,
        handle: p.handle ?? null,
        thumbnail: p.thumbnail ?? null,
        status: p.status ?? null,
        admin_path: `/products/${p.id}`,
        // El ancla es el bloque de opiniones del PDP; si cambiara, el link sigue
        // siendo válido (solo no scrollea). La URL va sin countryCode: el proxy
        // del storefront reescribe las URLs limpias.
        storefront_url: p.handle
          ? `${base}/products/${p.handle}#comments-heading`
          : null,
      });
    }
  }

  if (postIds.length) {
    const posts = await safeGraph<{
      id: string;
      title?: string | null;
      slug?: string | null;
      status?: string | null;
    }>(query, {
      entity: 'blog_post',
      fields: ['id', 'title', 'slug', 'status'],
      filters: { id: postIds },
    });

    for (const post of posts) {
      if (!post?.id) continue;
      out.set(resourceKey('blog_post', post.id), {
        type: 'blog_post',
        id: post.id,
        title: post.title ?? null,
        handle: post.slug ?? null,
        thumbnail: null,
        status: post.status ?? null,
        admin_path: `/blog/articles/${post.id}`,
        storefront_url: post.slug ? `${base}/blog/${post.slug}` : null,
      });
    }
  }

  return out;
}
