import { MedusaError, MedusaService } from '@medusajs/framework/utils';
import { Comment, CommentSettings } from './models';

export type CommentableType = 'product' | 'blog_post';
export type ReviewMode = 'comment' | 'rating' | 'both';

export type CreateCommentInput = {
  commentable_type: CommentableType;
  commentable_id: string;
  customer_id: string;
  author_name?: string | null;
  rating?: number | null;
  content?: string | null;
  parent_id?: string | null;
  verified_buyer?: boolean;
  /**
   * La tienda desde la que se publicó. Tiene que estar en el tipo Y enumerarse abajo:
   * `createCommentModerated` arma el objeto campo por campo, así que un `site_id` que
   * sólo viaje en el input se descarta EN SILENCIO — el comentario nace global y la
   * cola de moderación filtrada ya no lo encuentra.
   */
  site_id?: string | null;
};

type SettingsLike = {
  review_mode: ReviewMode;
  rating_scale: number;
  moderation: 'auto' | 'manual';
  edit_window_minutes: number;
  min_length: number;
  max_length: number;
  rate_limit_per_minute: number;
};

class CommentsModuleService extends MedusaService({
  Comment,
  CommentSettings,
}) {
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
      const [own] = await this.listCommentSettings({ site_id: siteId }, { take: 1 });
      if (own) return own;
    }
    const [existing] = await this.listCommentSettings({ site_id: null }, { take: 1 });
    if (existing) {
      return existing;
    }
    return this.createCommentSettings({ site_id: null });
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
      return this.updateCommentSettings({ id: current.id as string, ...values });
    }
    const { id: _ignored, ...inherited } = current;
    return this.createCommentSettings({ ...inherited, site_id: siteId, ...values });
  }

  /** Upserts the singleton settings row. */
  async updateSettings(data: Record<string, unknown>) {
    const current = await this.getSettings();
    return this.updateCommentSettings({ id: current.id, ...data });
  }

  /**
   * Validates an incoming comment against the global settings: review_mode
   * (rating and/or content required), rating range, content length, rate limit
   * and flood control. Throws a MedusaError on the first violation.
   */
  async validateForCreate(
    input: CreateCommentInput,
    settings: SettingsLike,
  ): Promise<void> {
    const mode = settings.review_mode;
    const hasRating =
      input.rating !== undefined && input.rating !== null;
    const content = (input.content ?? '').trim();
    const hasContent = content.length > 0;

    // review_mode gating
    if (mode === 'rating' && !hasRating) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Se requiere un puntaje.',
      );
    }
    if (mode === 'comment' && !hasContent) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Se requiere un comentario.',
      );
    }
    if (mode === 'both' && (!hasRating || !hasContent)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Se requiere puntaje y comentario.',
      );
    }

    // rating range (only when a rating is provided / expected)
    if (hasRating) {
      const r = input.rating as number;
      if (!Number.isInteger(r) || r < 1 || r > settings.rating_scale) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `El puntaje debe ser un entero entre 1 y ${settings.rating_scale}.`,
        );
      }
    }

    // content length (only when content is present)
    if (hasContent) {
      if (content.length < settings.min_length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `El comentario debe tener al menos ${settings.min_length} caracteres.`,
        );
      }
      if (content.length > settings.max_length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `El comentario no puede superar los ${settings.max_length} caracteres.`,
        );
      }
    }

    // rate limit: N comments per minute per customer
    const since = new Date(Date.now() - 60_000);
    const recent = await this.listComments(
      { customer_id: input.customer_id, created_at: { $gte: since } },
      { take: settings.rate_limit_per_minute + 1 },
    );
    if (recent.length >= settings.rate_limit_per_minute) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Estás comentando demasiado rápido. Esperá un momento.',
      );
    }

    // flood control: no identical content consecutively from the same customer
    if (hasContent) {
      const [last] = await this.listComments(
        { customer_id: input.customer_id },
        { take: 1, order: { created_at: 'DESC' } },
      );
      if (last && (last.content ?? '').trim() === content) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'No se permiten comentarios idénticos consecutivos.',
        );
      }
    }
  }

  /**
   * Creates a comment applying moderation policy: 'auto' publishes immediately
   * (status=approved, published_at=now), 'manual' leaves it pending.
   */
  async createCommentModerated(
    input: CreateCommentInput,
    settings: SettingsLike,
  ) {
    const auto = settings.moderation === 'auto';
    const content = input.content?.trim() ? input.content.trim() : null;
    return this.createComments({
      commentable_type: input.commentable_type,
      commentable_id: input.commentable_id,
      parent_id: input.parent_id ?? null,
      customer_id: input.customer_id,
      author_name: input.author_name ?? null,
      rating: input.rating ?? null,
      content,
      verified_buyer: input.verified_buyer ?? false,
      status: auto ? 'approved' : 'pending',
      published_at: auto ? new Date() : null,
      site_id: input.site_id ?? null,
    });
  }

  async approve(id: string) {
    return this.updateComments({
      id,
      status: 'approved',
      published_at: new Date(),
    });
  }

  async hide(id: string) {
    return this.updateComments({ id, status: 'hidden' });
  }

  /** Soft-delete: keeps the row so replies can still render a tombstone. */
  async softDelete(id: string) {
    return this.updateComments({ id, status: 'deleted' });
  }

  /**
   * Approved-comment aggregate for an entity: average rating (rounded to 1
   * decimal) and the count of approved top-level comments.
   */
  async getAggregate(type: CommentableType, id: string) {
    const approved = await this.listComments(
      { commentable_type: type, commentable_id: id, status: 'approved' },
      { take: 10_000 },
    );
    const ratings = approved
      .map((c: { rating: number | null }) => c.rating)
      .filter((r): r is number => typeof r === 'number');
    const average =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
          10
        : null;
    return {
      total: approved.length,
      rating_count: ratings.length,
      average_rating: average,
    };
  }
}

export default CommentsModuleService;
