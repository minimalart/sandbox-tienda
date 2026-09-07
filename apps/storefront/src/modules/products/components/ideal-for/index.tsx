'use client'

import {
  Home,
  Car,
  Zap,
  Shirt,
  SprayCan,
  Leaf,
  Briefcase,
  Baby,
  Dog,
  Minimize2,
  Hand,
  Fingerprint,
  HardHat,
  Wrench,
  Layers,
  TreePine,
  Gem,
  Grid3X3,
  Package,
  Droplets,
  ChefHat,
  Shield,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type IconConfig = {
  label: string
  icon: LucideIcon
}

type ResolvedItem = {
  label: string
  key: string
  icon?: LucideIcon
}

export type AttributeItem = {
  id?: string | null
  name?: string | null
}

export type AttributeInput =
  | string
  | AttributeItem
  | ReadonlyArray<AttributeItem>
  | null
  | undefined

export type IdealForVariant = 'icon' | 'tag'

const DEFAULT_ICON_CONFIG: Omit<IconConfig, 'label'> = { icon: Tag }

const USAGE_MAP: Record<string, IconConfig> = {
  hogar: { label: 'Hogar', icon: Home },
  ambiente: { label: 'Ambientes', icon: Home },
  ambientes: { label: 'Ambientes', icon: Home },
  'ambientes pequeños': { label: 'Amb. pequeños', icon: Minimize2 },
  'espacios pequeños': { label: 'Esp. pequeños', icon: Minimize2 },
  auto: { label: 'Autos', icon: Car },
  autos: { label: 'Autos', icon: Car },
  vehiculos: { label: 'Vehículos', icon: Car },
  vehículos: { label: 'Vehículos', icon: Car },
  'uso rápido': { label: 'Uso rápido', icon: Zap },
  'uso rapido': { label: 'Uso rápido', icon: Zap },
  ropa: { label: 'Ropa', icon: Shirt },
  textil: { label: 'Textil', icon: Shirt },
  telas: { label: 'Telas', icon: Shirt },
  'telas trabajo': { label: 'Telas trabajo', icon: HardHat },
  spray: { label: 'Spray', icon: SprayCan },
  natural: { label: 'Natural', icon: Leaf },
  oficina: { label: 'Oficina', icon: Briefcase },
  bebe: { label: 'Bebé', icon: Baby },
  bebé: { label: 'Bebé', icon: Baby },
  mascota: { label: 'Mascotas', icon: Dog },
  mascotas: { label: 'Mascotas', icon: Dog },
  'manos y pies': { label: 'Manos y pies', icon: Hand },
  piel: { label: 'Piel', icon: Fingerprint },
  acero: { label: 'Acero', icon: Wrench },
  cuero: { label: 'Cuero', icon: Layers },
  madera: { label: 'Madera', icon: TreePine },
  marmol: { label: 'Mármol', icon: Gem },
  mármol: { label: 'Mármol', icon: Gem },
  pisos: { label: 'Pisos', icon: Grid3X3 },
  plasticos: { label: 'Plásticos', icon: Package },
  plásticos: { label: 'Plásticos', icon: Package },
  'superficie de baños': { label: 'Baños', icon: Droplets },
  'superficies de baños': { label: 'Baños', icon: Droplets },
  'superficies de cocina': { label: 'Cocina', icon: ChefHat },
  'superficie de cocina': { label: 'Cocina', icon: ChefHat },
  'superficies protegidas': { label: 'Sup. protegidas', icon: Shield },
  'superficie protegida': { label: 'Sup. protegidas', icon: Shield },
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function isAttributeItem(v: unknown): v is AttributeItem {
  return typeof v === 'object' && v !== null && 'name' in (v as object)
}

function toRawEntries(
  value: AttributeInput,
): Array<{ id?: string; name: string }> {
  if (!value) return []

  if (typeof value === 'string') {
    return value.split(',').map((name) => ({ name }))
  }

  if (Array.isArray(value)) {
    return value.filter(isAttributeItem).map((item) => ({
      id: item.id ?? undefined,
      name: item.name ?? '',
    }))
  }

  if (isAttributeItem(value)) {
    return [{ id: value.id ?? undefined, name: value.name ?? '' }]
  }

  return []
}

function parseIconItems(value: AttributeInput): ResolvedItem[] {
  const entries = toRawEntries(value)
    .map(({ id, name }) => ({ id, key: name.trim().toLowerCase() }))
    .filter((e) => e.key.length > 0)

  if (entries.length === 0) return []

  const result: ResolvedItem[] = []
  const seen = new Set<string>()

  for (const { id, key } of entries) {
    const mapped = USAGE_MAP[key]
    const config: IconConfig = mapped ?? {
      label: capitalize(key),
      ...DEFAULT_ICON_CONFIG,
    }

    if (seen.has(config.label)) continue
    seen.add(config.label)

    result.push({
      label: config.label,
      icon: config.icon,
      key: id ?? config.label,
    })
  }

  return result
}

function parseTagItems(value: AttributeInput): ResolvedItem[] {
  const entries = toRawEntries(value)
    .map(({ id, name }) => ({ id, rawName: name.trim() }))
    .filter((e) => e.rawName.length > 0)

  if (entries.length === 0) return []

  const result: ResolvedItem[] = []
  const seen = new Set<string>()

  for (const { id, rawName } of entries) {
    const dedupKey = id ?? rawName.toLowerCase()
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)
    result.push({ label: rawName, key: id ?? rawName })
  }

  return result
}

export function hasIdealForItems(
  value: AttributeInput,
  variant: IdealForVariant = 'icon',
): boolean {
  return variant === 'tag'
    ? parseTagItems(value).length > 0
    : parseIconItems(value).length > 0
}

type IdealForProps = {
  title: string
  value: AttributeInput
  variant?: IdealForVariant
}

const MIN_ITEM_PX = 68

const IdealFor = ({ title, value, variant = 'icon' }: IdealForProps) => {
  const items = useMemo(
    () => (variant === 'tag' ? parseTagItems(value) : parseIconItems(value)),
    [value, variant],
  )
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

  if (items.length === 0) {
    return null
  }

  const trackGap = variant === 'tag' ? 'gap-2' : 'gap-6'

  return (
    <div className='mt-4'>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <h2 className='font-semibold text-gray-900 text-sm'>{title}</h2>
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
        className={`no-scrollbar flex overflow-x-auto ${trackGap}`}
      >
        {items.map((item) =>
          variant === 'tag' ? (
            <span
              key={item.key}
              className='flex-shrink-0 whitespace-nowrap rounded-[8px] bg-[--primary-color] px-3 py-1.5 font-medium text-white text-xs'
            >
              {item.label}
            </span>
          ) : (
            <IconItem key={item.key} item={item} />
          ),
        )}
      </div>
    </div>
  )
}

const IconItem = ({ item }: { item: ResolvedItem }) => {
  const Icon = item.icon
  return (
    <div
      className='flex flex-shrink-0 flex-col items-center gap-1.5'
      style={{ minWidth: `${MIN_ITEM_PX}px` }}
    >
      {Icon && (
        <div className='flex h-10 w-10 items-center justify-center rounded-full border border-gray-200'>
          <Icon
            className='h-5 w-5 text-[--primary-color]'
            strokeWidth={1.5}
          />
        </div>
      )}
      <span className='text-center text-gray-600 text-xs'>{item.label}</span>
    </div>
  )
}

export default IdealFor
