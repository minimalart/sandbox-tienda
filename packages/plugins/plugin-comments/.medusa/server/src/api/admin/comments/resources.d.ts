import type { MedusaContainer } from '@medusajs/framework/types';
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
/** Clave del mapa: el par polimórfico completo. */
export declare const resourceKey: (type: string, id: string) => string;
/**
 * Trae los resúmenes de los recursos comentados, indexados por
 * `${commentable_type}:${commentable_id}`. Una query por tipo presente.
 */
export declare function loadCommentResources(container: MedusaContainer, targets: {
    commentable_type: string;
    commentable_id: string;
}[]): Promise<Map<string, CommentResource>>;
