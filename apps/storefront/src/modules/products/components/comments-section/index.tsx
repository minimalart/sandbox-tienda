import StarRating from '@modules/common/components/star-rating'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import ReviewForm from '@modules/products/components/review-form'
import {
  type CommentableType,
  type PublicComment,
  getComments,
  getReviewEligibility,
} from '@lib/data/comments'
import { retrieveCustomer } from '@lib/data/customer'

type CommentsSectionProps = {
  commentableType: CommentableType
  commentableId: string
}

const ELIGIBILITY_MESSAGE: Record<string, string> = {
  already_reviewed: 'Ya dejaste tu opinión sobre este producto. ¡Gracias!',
  not_delivered:
    'Vas a poder opinar cuando recibas este producto (pedido entregado).',
  product_only: 'Las opiniones están habilitadas solo para productos.',
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

function CommentBody({
  comment,
  showStars,
  scale,
}: {
  comment: PublicComment
  showStars: boolean
  scale: number
}) {
  const deleted = comment.status === 'deleted'
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900 text-sm">
          {comment.author_name || 'Usuario'}
        </span>
        {comment.verified_buyer && (
          <span className="rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-700 text-xs">
            Comprador verificado
          </span>
        )}
        <span className="text-gray-400 text-xs">{fmtDate(comment.created_at)}</span>
      </div>
      {showStars && comment.rating != null && (
        <StarRating value={comment.rating} scale={scale} size={14} />
      )}
      {deleted ? (
        <p className="text-gray-400 text-sm italic">Este comentario fue eliminado.</p>
      ) : (
        comment.content && (
          <p className="whitespace-pre-wrap text-gray-700 text-sm">{comment.content}</p>
        )
      )}
    </div>
  )
}

/**
 * Comments/reviews for a commentable entity: average rating, approved comments
 * with one level of replies, and a creation form gated by the backend policy
 * (logged in + delivered order when `who_can_comment = verified_buyer`).
 */
export default async function CommentsSection({
  commentableType,
  commentableId,
}: CommentsSectionProps) {
  const [data, customer] = await Promise.all([
    getComments(commentableType, commentableId),
    retrieveCustomer(),
  ])
  if (!data || !data.settings.enabled) return null

  const { comments, aggregate, settings } = data
  const showStars = settings.review_mode !== 'comment'
  const scale = settings.rating_scale

  // Eligibility only matters when logged in; otherwise we show a login prompt.
  const eligibility = customer
    ? await getReviewEligibility(commentableType, commentableId)
    : null

  return (
    <section
      aria-labelledby="comments-heading"
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 border-gray-200 border-b pb-4">
        <h2 id="comments-heading" className="font-semibold text-gray-900 text-xl">
          Opiniones
        </h2>
        {showStars && aggregate.average_rating != null && (
          <div className="flex items-center gap-2">
            <StarRating value={aggregate.average_rating} scale={scale} size={18} />
            <span className="font-medium text-gray-900 text-sm">
              {/* Promedio normalizado a escala /5 (las estrellas siempre son 5). */}
              {((aggregate.average_rating / scale) * 5).toFixed(1)} / 5
            </span>
            <span className="text-gray-500 text-sm">
              ({aggregate.rating_count}{' '}
              {aggregate.rating_count === 1 ? 'calificación' : 'calificaciones'})
            </span>
          </div>
        )}
        <span className="ml-auto text-gray-500 text-sm">
          {aggregate.total} {aggregate.total === 1 ? 'comentario' : 'comentarios'}
        </span>
      </div>

      {/* Crear opinión: form si puede, o mensaje (login / no entregado / ya opinó) */}
      <div className="mb-8">
        {!customer ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600 text-sm">
            <LocalizedClientLink
              href="/account"
              className="font-semibold text-[--primary-color] hover:underline"
            >
              Iniciá sesión
            </LocalizedClientLink>{' '}
            para opinar sobre este producto.
          </div>
        ) : eligibility?.can_review ? (
          <ReviewForm
            commentableType={commentableType}
            commentableId={commentableId}
            reviewMode={eligibility.review_mode}
            ratingScale={eligibility.rating_scale}
            minLength={eligibility.min_length}
            maxLength={eligibility.max_length}
            moderation={eligibility.moderation}
          />
        ) : eligibility && eligibility.reason !== 'disabled' ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-600 text-sm">
            {ELIGIBILITY_MESSAGE[eligibility.reason] ??
              'No podés opinar sobre este producto por ahora.'}
          </div>
        ) : null}
      </div>

      {comments.length === 0 ? (
        <p className="text-gray-500 text-sm">
          Todavía no hay opiniones para este producto.
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {comments.map((c) => (
            <li key={c.id} className="flex flex-col gap-3">
              <CommentBody comment={c} showStars={showStars} scale={scale} />
              {c.replies && c.replies.length > 0 && (
                <ul className="ml-6 flex flex-col gap-3 border-gray-100 border-l pl-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentBody comment={r} showStars={false} scale={scale} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
