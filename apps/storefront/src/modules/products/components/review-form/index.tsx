'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Textarea from '@modules/common/components/textarea'
import { createReview } from '@lib/data/comments-actions'
import type { CommentableType, ReviewMode } from '@lib/data/comments'

type ReviewFormProps = {
  commentableType: CommentableType
  commentableId: string
  reviewMode: ReviewMode
  ratingScale: number
  minLength: number
  maxLength: number
  moderation: 'auto' | 'manual'
}

function StarInput({
  value,
  scale,
  onChange,
}: {
  value: number
  scale: number
  onChange: (v: number) => void
}) {
  const [hover, setHover] = useState(0)
  const active = hover || value
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Puntaje">
      {Array.from({ length: scale }).map((_, i) => {
        const n = i + 1
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            className="p-0.5 text-2xl leading-none transition-colors"
            style={{ color: n <= active ? '#facc15' : '#d1d5db' }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export default function ReviewForm({
  commentableType,
  commentableId,
  reviewMode,
  ratingScale,
  minLength,
  maxLength,
  moderation,
}: ReviewFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const needsRating = reviewMode !== 'comment'
  const needsContent = reviewMode !== 'rating'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (needsRating && rating < 1) {
      setError('Elegí un puntaje.')
      return
    }
    const trimmed = content.trim()
    if (needsContent && trimmed.length < minLength) {
      setError(`El comentario debe tener al menos ${minLength} caracteres.`)
      return
    }

    startTransition(async () => {
      const result = await createReview({
        commentable_type: commentableType,
        commentable_id: commentableId,
        rating: needsRating ? rating : null,
        content: needsContent ? trimmed : null,
      })
      if (result.ok) {
        setSuccess(result.message)
        setRating(0)
        setContent('')
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm">
        {success}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
    >
      <h3 className="font-semibold text-gray-900 text-base">Escribí tu opinión</h3>

      {needsRating && (
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-gray-700 text-sm">Tu puntaje</span>
          <StarInput value={rating} scale={ratingScale} onChange={setRating} />
        </div>
      )}

      {needsContent && (
        <div className="flex flex-col gap-1">
          <Textarea
            name="review-content"
            label="Tu comentario"
            placeholder="Contá tu experiencia con el producto…"
            value={content}
            maxLength={maxLength}
            onChange={(e) => setContent(e.target.value)}
            hasError={!!error && content.trim().length < minLength}
          />
          <span className="self-end text-gray-400 text-xs">
            {content.trim().length}/{maxLength}
          </span>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[--primary-color] px-6 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Enviando…' : 'Publicar opinión'}
        </button>
        {moderation === 'manual' && (
          <span className="text-gray-500 text-xs">
            Tu opinión quedará pendiente de aprobación.
          </span>
        )}
      </div>
    </form>
  )
}
