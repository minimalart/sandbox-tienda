import { clx } from '@medusajs/ui'

type StarRatingProps = {
  /** Raw value, expressed on the `scale` below. */
  value: number
  /** The scale `value` is expressed on (the configurable rating_scale). The
   *  display always normalizes this to 5 stars. Defaults to 5. */
  scale?: number
  /** Pixel size of each star. */
  size?: number
  className?: string
}

const STAR_COUNT = 5

/**
 * Read-only star rating, ALWAYS rendered on 5 stars. A value on any `scale`
 * (e.g. 7/10) is normalized to /5 and rounded to the nearest half, so it shows
 * clean full/half stars (e.g. 3.5 → three and a half). Half stars are drawn via
 * an overlay clip at 50% width.
 */
export default function StarRating({
  value,
  scale = 5,
  size = 16,
  className,
}: StarRatingProps) {
  const safeScale = scale > 0 ? scale : 5
  // Normalize to a 0..5 range, then snap to the nearest half star.
  const normalized = (Math.max(0, value) / safeScale) * STAR_COUNT
  const snapped = Math.min(STAR_COUNT, Math.round(normalized * 2) / 2)
  return (
    <span
      className={clx('inline-flex items-center', className)}
      role="img"
      aria-label={`${snapped} de ${STAR_COUNT} estrellas`}
      style={{ gap: 1 }}
    >
      {Array.from({ length: STAR_COUNT }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, snapped - i)) // 0, 0.5 or 1
        return (
          <span
            key={i}
            className="relative inline-block leading-none text-gray-300"
            style={{ width: size, height: size, fontSize: size }}
          >
            <span aria-hidden>★</span>
            <span
              aria-hidden
              className="absolute inset-0 overflow-hidden text-yellow-400"
              style={{ width: `${fill * 100}%` }}
            >
              ★
            </span>
          </span>
        )
      })}
    </span>
  )
}
