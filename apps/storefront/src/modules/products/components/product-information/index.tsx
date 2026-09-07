'use client'

import {
  ArrowLeftRight,
  Droplet,
  MoveHorizontal,
  MoveVertical,
  Weight,
  type LucideIcon,
} from 'lucide-react'
import type { HttpTypes } from '@medusajs/types'
import { useCallback, useEffect, useRef, useState } from 'react'

type DimensionField = {
  key: 'weight' | 'height' | 'width' | 'length' | 'volume'
  label: string
  unit: string
  icon: LucideIcon
  source: 'product' | 'metadata'
}

const FIELDS: ReadonlyArray<DimensionField> = [
  { key: 'weight', label: 'Peso', unit: 'g', icon: Weight, source: 'product' },
  { key: 'height', label: 'Altura', unit: 'cm', icon: MoveVertical, source: 'product' },
  { key: 'width', label: 'Ancho', unit: 'cm', icon: MoveHorizontal, source: 'product' },
  { key: 'length', label: 'Profundidad', unit: 'cm', icon: ArrowLeftRight, source: 'product' },
  { key: 'volume', label: 'Volumen', unit: 'ml', icon: Droplet, source: 'metadata' },
]

function formatValue(
  raw: number | string | null | undefined,
  unit: string,
): string | null {
  if (raw === null || raw === undefined) return null
  const num = typeof raw === 'string' ? Number.parseFloat(raw) : raw
  if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) return null

  const formatted = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 2,
  }).format(num)

  return `${formatted} ${unit}`
}

type ProductInformationProps = {
  product: HttpTypes.StoreProduct
}

const ProductInformation = ({ product }: ProductInformationProps) => {
  const metadata = product.metadata as Record<string, unknown> | null | undefined

  const items = FIELDS.map((field) => {
    const raw =
      field.source === 'metadata'
        ? (metadata?.[field.key] as number | string | null | undefined)
        : (product[field.key as keyof HttpTypes.StoreProduct] as
            | number
            | string
            | null
            | undefined)
    return {
      label: field.label,
      icon: field.icon,
      value: formatValue(raw, field.unit),
    }
  }).filter((item): item is typeof item & { value: string } => item.value !== null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const measure = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth + 1
    setHasOverflow(overflow)
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(
      overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    )
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', measure)
    }
  }, [measure, items.length])

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el?.firstElementChild) return
    const itemWidth = (el.firstElementChild as HTMLElement).offsetWidth
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    const step = itemWidth + gap
    el.scrollBy({
      left: direction === 'right' ? step : -step,
      behavior: 'smooth',
    })
  }, [])

  if (items.length === 0) return null

  return (
    <div className='mt-4'>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <h2 className='font-semibold text-gray-900 text-sm'>
          Información del producto
        </h2>
        {hasOverflow && (
          <div className='flex items-center gap-1'>
            <button
              type='button'
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label='Anterior'
              className='flex h-6 w-6 items-center justify-center rounded transition-opacity disabled:opacity-30'
            >
              <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='none'
                aria-hidden='true'
              >
                <path
                  d='M10 12L6 8L10 4'
                  stroke='var(--price-strikethrough)'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
            <button
              type='button'
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label='Siguiente'
              className='flex h-6 w-6 items-center justify-center rounded transition-opacity disabled:opacity-30'
            >
              <svg
                width='16'
                height='16'
                viewBox='0 0 16 16'
                fill='none'
                aria-hidden='true'
              >
                <path
                  d='M6 4L10 8L6 12'
                  stroke='var(--price-strikethrough)'
                  strokeWidth='1.5'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className='no-scrollbar flex gap-2 overflow-x-auto'
      >
        {items.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className='flex min-w-[120px] flex-shrink-0 flex-1 items-center gap-2 rounded-lg bg-grey-10 px-3 py-2'
          >
            <Icon
              aria-hidden='true'
              className='h-4 w-4 flex-shrink-0 text-gray-500'
              strokeWidth={1.5}
            />
            <div className='min-w-0'>
              <p className='text-gray-500 text-xs leading-tight'>{label}</p>
              <p className='truncate font-semibold text-gray-900 text-sm leading-tight'>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProductInformation
