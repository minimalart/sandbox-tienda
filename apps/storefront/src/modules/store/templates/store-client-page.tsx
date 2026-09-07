'use client'

import {
  Dialog,
  DialogPanel,
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from '@headlessui/react'
import {
  CheckIcon,
  ChevronRightIcon,
} from '@heroicons/react/20/solid'
import {
  AdjustmentsHorizontalIcon,
  BarsArrowDownIcon,
  MinusIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useTypesenseProducts } from '@lib/hooks/use-typesense-products'
import { useUIStore } from '@lib/stores'
import { useTenant } from '@lib/site-config/context/tenant-context'
import { isImpulseTemplate } from '@lib/site-config/template-helpers'
import type { SortOption, TypesenseFacetCount } from '@lib/typesense'
import {
  getCategoryDisplayName,
  toDisplayCase,
} from '@lib/util/category-display'
import { cn } from '@lib/util/cn'
import SkeletonProductGrid from '@modules/skeletons/templates/skeleton-product-grid'
import InfiniteScrollSentinel from '@modules/store/components/infinite-scroll-sentinel'
import ProductGridSkeleton from '@modules/store/components/product-grid-skeleton'
import type { SortOptions } from '@modules/store/components/refinement-list/sort-products'
import SortProducts from '@modules/store/components/refinement-list/sort-products'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import TypesenseProductGrid from './typesense-product-grid'

/**
 * Sticky "Filtros Activos" bar. While its scroll container is scrolled (i.e. the
 * bar is pinned and the filter list slides underneath it), it reveals a bottom
 * border + soft shadow so the boundary between the active-filters strip and the
 * content below it reads clearly. The 1px border is always reserved (transparent
 * when idle) to avoid a layout shift when the shadow toggles.
 */
function StickyActiveFilters({
  isMobile,
  children,
}: {
  isMobile: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Nearest scrollable ancestor (desktop sidebar / mobile drawer body).
    let parent: HTMLElement | null = el.parentElement
    while (parent) {
      const oy = getComputedStyle(parent).overflowY
      if (oy === 'auto' || oy === 'scroll') break
      parent = parent.parentElement
    }
    const target: HTMLElement | Window = parent ?? window
    const onScroll = () =>
      setStuck((parent ? parent.scrollTop : window.scrollY) > 0)
    onScroll()
    target.addEventListener('scroll', onScroll, { passive: true })
    return () => target.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        'sticky top-0 z-10 border-transparent border-b bg-white pb-2 transition-shadow',
        isMobile ? 'px-4 pt-4' : 'pt-5',
        stuck &&
          'border-gray-200 shadow-[0_6px_8px_-6px_rgba(0,0,0,0.18)]',
      )}
    >
      {children}
    </div>
  )
}

// Opciones de orden para el bottom sheet mobile (mismas que SortProducts).
const MOBILE_SORT_OPTIONS: { value: SortOptions; label: string }[] = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'created_at', label: 'Recientes' },
  { value: 'price_asc', label: 'Precio: Bajo → Alto' },
  { value: 'price_desc', label: 'Precio: Alto → Bajo' },
]

const DISNEY_SUB_BRANDS = [
  {
    id: 'disney',
    label: 'Disney',
    image: '/disney-sub-brands/disney.svg',
    tag: 'Disney',
  },
  {
    id: 'disney-princess',
    label: 'Disney Princess',
    image: '/disney-sub-brands/disney-princess.svg',
    tag: 'Disney Princess',
  },
  {
    id: 'pixar',
    label: 'Pixar',
    image: '/disney-sub-brands/pixar.svg',
    tag: 'Pixar',
  },
  {
    id: 'marvel',
    label: 'Marvel',
    image: '/disney-sub-brands/marvel.svg',
    tag: 'Marvel',
  },
  {
    id: 'star-wars',
    label: 'Star Wars',
    image: '/disney-sub-brands/star-wars.svg',
    tag: 'Star Wars',
  },
] as const

type FilterOption = {
  value: string
  label: string
  count?: number
  children?: FilterOption[]
}

type FilterSection = {
  id: string
  name: string
  options: FilterOption[]
  hasChildren?: boolean
}

const FACET_TO_FILTER_MAP: Record<string, string> = {
  'brand.name': 'brand',
  'family.name': 'familia',
  'categories.name': 'category',
  'collection.title': 'collection',
  'tags.value': 'tag',
  'promotions.campaign.name': 'promotion',
  'usage_suggestion.name': 'sugerenciaUso',
  'olfactory_family.name': 'familiaOlfativa',
  // Atributos del asesor. Los valores se guardan como slugs en inglés
  // (`wall`, `water`, `roof`) porque son la misma clave que usa el filtrado
  // guiado de WhatsApp; la etiqueta visible sale de ADVISOR_VALUE_LABELS.
  advisor_surface: 'superficie',
  advisor_product_type: 'tipoProducto',
  advisor_environment: 'ambiente',
  advisor_special_use: 'usoEspecial',
  advisor_base: 'base',
}

/**
 * Facetas que se PIDEN pero no se muestran como filtro.
 *
 * `categories.id` se pide para decidir qué categorías tienen productos en el
 * canal (las `product_category` de Medusa son globales, así que contar por
 * nombre mezcla ramas de otra tienda). Como sección de filtro no tiene ningún
 * sentido: se veía un grupo titulado "categories.id" con ULIDs crudos
 * (`pcat_01KYJ4MWA7ZDZE…`) a la vista del cliente.
 *
 * `price` se facetea sólo para leer `stats.min/max` y dimensionar el slider.
 */
const HIDDEN_FACET_FIELDS = new Set(['categories.id', 'price'])

const FILTER_DISPLAY_NAMES: Record<string, string> = {
  collection: 'Colecciones',
  brand: 'Marcas',
  // Familia del ERP. Distinta de `familiaOlfativa` ("Familia olfativa"), que es
  // de perfumería: son params distintos y pueden convivir en un mismo tenant.
  familia: 'Familia',
  promotion: 'Promociones',
  tag: 'Etiquetas',
  sugerenciaUso: 'Modo de uso',
  familiaOlfativa: 'Familia olfativa',
  superficie: 'Superficie',
  tipoProducto: 'Tipo de producto',
  ambiente: 'Ambiente',
  usoEspecial: 'Uso especial',
  base: 'Base',
}

/**
 * Etiquetas visibles de los valores del asesor. Sin esto el filtro mostraría
 * `wall`, `art_paint`, `water`. El orden de esta tabla NO importa: el orden de
 * las opciones lo define el conteo de la faceta.
 */
const ADVISOR_VALUE_LABELS: Record<string, string> = {
  // superficie
  wall: 'Pared, cemento o placa',
  metal: 'Metal',
  wood: 'Madera',
  plastic: 'Plástico',
  multi: 'Multisuperficie',
  // tipo de producto
  paint: 'Pintura',
  art_paint: 'Pintura artística',
  prep: 'Preparación o complemento',
  accessory: 'Accesorio',
  tool: 'Herramienta',
  // ambiente
  interior: 'Interior',
  exterior: 'Exterior',
  // uso especial
  floor: 'Piso',
  pool: 'Pileta',
  roof: 'Techo',
  // base
  water: 'Al agua',
  solvent: 'Al solvente',
}

/** Ids de filtro que vienen del asesor (valores con etiqueta propia). */
type AdvisorFilterId =
  | 'superficie'
  | 'tipoProducto'
  | 'ambiente'
  | 'usoEspecial'
  | 'base'

const ADVISOR_FILTER_ID_LIST: readonly AdvisorFilterId[] = [
  'superficie',
  'tipoProducto',
  'ambiente',
  'usoEspecial',
  'base',
]

const ADVISOR_FILTER_IDS = new Set<string>(ADVISOR_FILTER_ID_LIST)

/**
 * Etiqueta visible de un valor de filtro ya aplicado.
 *
 * Los filtros del asesor guardan el slug en inglés en la URL (`floor`, `water`)
 * porque es la misma clave que usa el filtrado guiado de WhatsApp. Mostrar el
 * valor crudo dejaba el idioma mezclado: la lista de opciones ofrecía "Piso" y,
 * al elegirla, la sección colapsada mostraba "Floor".
 */
function getFilterValueLabel(filterId: string, value: string): string {
  if (ADVISOR_FILTER_IDS.has(filterId)) {
    return ADVISOR_VALUE_LABELS[value] ?? toDisplayCase(value)
  }
  return toDisplayCase(value)
}

const buildFiltersFromFacets: (
  facetUniverse: TypesenseFacetCount[],
) => FilterSection[] = (
  facetUniverse: TypesenseFacetCount[],
): FilterSection[] => {
  const sectionMap: Record<string, FilterSection> = {}

  for (const facet of facetUniverse) {
    const filterId: string =
      FACET_TO_FILTER_MAP[facet.field_name] || facet.field_name

    if (filterId === 'category') {
      continue
    }

    if (HIDDEN_FACET_FIELDS.has(facet.field_name)) {
      continue
    }

    const isAdvisor = ADVISOR_FILTER_IDS.has(filterId)

    let options: FilterOption[] = facet.counts
      // `unknown` es el marcador interno de "no se pudo clasificar": sirve para
      // auditar cobertura, no para ofrecérselo al cliente como filtro.
      .filter((c) => !(isAdvisor && c.value === 'unknown'))
      .map((c) => {
        const normalized =
          filterId === 'tag' ? c.value.replace(/\+/g, ' ') : c.value
        return {
          value: normalized,
          // `label` es solo para mostrar; el filtro se arma con `value`.
          label: isAdvisor
            ? (ADVISOR_VALUE_LABELS[normalized] ?? toDisplayCase(normalized))
            : toDisplayCase(normalized),
          count: c.count,
        }
      })

    if (filterId === 'promotion') {
      options = options.filter((o) => o.value && o.value !== 'null')
    }

    if (options.length > 0) {
      sectionMap[filterId] = {
        id: filterId,
        name: FILTER_DISPLAY_NAMES[filterId] || filterId,
        options,
      }
    }
  }

  const ordered: FilterSection[] = []
  if (sectionMap.promotion) {
    ordered.push(sectionMap.promotion)
  }
  if (sectionMap.collection) {
    ordered.push(sectionMap.collection)
  }
  if (sectionMap.brand) {
    ordered.push(sectionMap.brand)
  }
  if (sectionMap.familia) {
    ordered.push(sectionMap.familia)
  }
  const {
    promotion: _p,
    collection: _c,
    brand: _b,
    familia: _f,
    ...rest
  } = sectionMap
  for (const section of Object.values(rest)) {
    ordered.push(section)
  }

  return ordered
}

type MedusaCategory = {
  id: string
  name: string
  handle: string
  category_children?: MedusaCategory[]
  parent_category?: { id: string; name: string } | null
  parent_category_id?: string | null
}

// Reconstruye el árbol desde la lista plana recibida como prop (initialCategories).
// Necesario porque las referencias anidadas dentro de `category_children` no
// siempre traen sus propios hijos populados — depende de cómo Medusa expande
// `fields`. Uniendo por `parent_category_id` garantizamos que cada nodo del
// árbol sea la versión canónica de la lista plana, así la navegación escala a
// 3+ niveles sin importar qué tan profundo expandió la API.
function buildCategoryTree(flat: MedusaCategory[]): MedusaCategory[] {
  if (flat.length === 0) {
    return []
  }
  const byId = new Map<string, MedusaCategory>()
  for (const cat of flat) {
    byId.set(cat.id, { ...cat, category_children: [] })
  }
  const roots: MedusaCategory[] = []
  for (const cat of flat) {
    const node = byId.get(cat.id)!
    const parentId = cat.parent_category_id ?? cat.parent_category?.id ?? null
    if (parentId) {
      const parent = byId.get(parentId)
      if (parent) {
        parent.category_children!.push(node)
        continue
      }
    }
    roots.push(node)
  }
  return roots
}

// Conteos del canal por id de categoría y, como respaldo, por nombre.
//
// El id es la clave correcta: las `product_category` de Medusa son GLOBALES (no
// están scopeadas por sales channel), así que dos tiendas del mismo backend
// pueden tener categorías homónimas — p. ej. "Complementos" existe como raíz del
// árbol de un ERP de pinturería y también bajo "Almacén > Repostería y postres"
// de un catálogo de supermercado. Contando por nombre, el conteo de una hacía
// visible la rama entera de la otra y la tienda ofrecía rubros de otro catálogo.
//
// `byName` queda para dos casos: la lista plana de fallback (sin árbol de
// Medusa, donde la clave ES la etiqueta) y las colecciones viejas sin
// `categories.id` faceteable, donde se prefiere el comportamiento anterior a
// esconder todas las categorías.
type CategoryCounts = {
  byId: Map<string, number>
  byName: Map<string, number>
}

const EMPTY_CATEGORY_COUNTS: CategoryCounts = {
  byId: new Map(),
  byName: new Map(),
}

const countOfCategory = (
  cat: MedusaCategory,
  counts: CategoryCounts,
): number =>
  counts.byId.size > 0
    ? (counts.byId.get(cat.id) ?? 0)
    : (counts.byName.get(cat.name) ?? 0)

function hasVisibleProducts(
  cat: MedusaCategory,
  counts: CategoryCounts,
): boolean {
  if (countOfCategory(cat, counts) > 0) {
    return true
  }
  if (cat.category_children) {
    return cat.category_children.some((child) =>
      hasVisibleProducts(child, counts),
    )
  }
  return false
}

// Suma el count de cada categoría con el de TODAS sus descendientes, para que
// las categorías padre muestren el total de su subárbol y no 0. El facet de
// Typesense solo cuenta categorías DIRECTAS (hojas), así que los padres
// quedaban en 0 aunque el filtro sí funcione (expande a hojas).
// El resultado va indexado por ID, igual que `countOfCategory`.
function buildRolledUpCounts(
  tree: MedusaCategory[],
  counts: CategoryCounts,
): Map<string, number> {
  const result = new Map<string, number>()
  const visit = (cat: MedusaCategory): number => {
    let total = countOfCategory(cat, counts)
    for (const child of cat.category_children || []) {
      total += visit(child)
    }
    result.set(cat.id, total)
    return total
  }
  for (const root of tree) {
    visit(root)
  }
  return result
}

function findCategoryInTree(
  name: string,
  tree: MedusaCategory[],
): MedusaCategory | null {
  for (const cat of tree) {
    if (cat.name === name) {
      return cat
    }
    if (cat.category_children) {
      const found = findCategoryInTree(name, cat.category_children)
      if (found) {
        return found
      }
    }
  }
  return null
}

function collectDescendantNames(cat: MedusaCategory): Set<string> {
  const acc = new Set<string>()
  const walk = (c: MedusaCategory) => {
    for (const child of c.category_children || []) {
      acc.add(child.name)
      walk(child)
    }
  }
  walk(cat)
  return acc
}

type FilterType =
  | 'brand'
  | 'collection'
  | 'category'
  | 'tag'
  | 'promotion'
  | 'fragancia'
  | 'sugerenciaUso'
  | 'familiaOlfativa'
  | 'familia'
  | 'price'
  | 'search'
  | AdvisorFilterId

function getFilterChipStyles(filterType: FilterType, label?: string): string {
  const disneySubBrands = [
    'Marvel',
    'Disney',
    'Pixar',
    'Disney Princess',
    'Star Wars',
  ]
  if (filterType === 'tag' && label && disneySubBrands.includes(label)) {
    return 'bg-[#DEEFF1] text-green-700'
  }

  switch (filterType) {
    case 'brand':
      return 'bg-[--filter-brand-bg] text-purple-700'
    case 'collection':
      return 'bg-[#DEEFF1] text-green-700'
    case 'category':
      return 'bg-[--filter-category-bg] text-green-700'
    case 'search':
      return 'bg-gray-100 text-gray-700'
    case 'tag':
    case 'promotion':
    case 'fragancia':
    case 'sugerenciaUso':
    case 'familiaOlfativa':
    case 'familia':
    case 'superficie':
    case 'tipoProducto':
    case 'ambiente':
    case 'usoEspecial':
    case 'base':
      return 'bg-[--filter-tag-bg] text-rose-500'
    default:
      return 'bg-[--filter-tag-bg] text-rose-500'
  }
}

function FilterChip({
  label,
  onRemove,
  filterType,
  isSportsTemplate = false,
}: {
  label: string
  onRemove: () => void
  filterType: FilterType
  isSportsTemplate?: boolean
}) {
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 font-medium text-xs',
        isSportsTemplate ? 'rounded-none border border-[--sp-hairline] bg-white text-[--sp-ink]' : 'rounded-lg',
        !isSportsTemplate && getFilterChipStyles(filterType, label),
      )}
      data-filter-chip
      exit={{ opacity: 0, scale: 0.9 }}
      initial={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
    >
      <span className='max-w-[120px] truncate'>{label}</span>
      <button
        aria-label={`Quitar filtro ${label}`}
        className={cn(
          'p-0.5 transition-colors hover:bg-black/10',
          isSportsTemplate ? 'rounded-none' : 'rounded-full',
        )}
        onClick={onRemove}
        type='button'
      >
        <XMarkIcon className='size-3' />
      </button>
    </motion.div>
  )
}

function FilterPill({
  label,
  count,
  isSelected,
  onToggle,
  isSportsTemplate = false,
}: {
  label: string
  count?: number
  isSelected: boolean
  onToggle: () => void
  isSportsTemplate?: boolean
}) {
  return (
    <button
      className={cn(
        'inline-flex cursor-pointer select-none items-center gap-1.5 border px-3 py-1.5 font-medium text-xs transition-all',
        isSportsTemplate ? 'rounded-none shadow-none' : 'rounded-full',
        isSelected
          ? 'border-[--primary-color] bg-[--primary-color] text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-600 hover:border-[--primary-color]/40 hover:text-gray-900',
      )}
      data-filter-pill
      onClick={onToggle}
      type='button'
    >
      <span className='max-w-[120px] truncate'>{label}</span>
      {count != null && count > 0 && (
        <span
          className={cn(
            'tabular-nums',
            isSelected ? 'text-white/70' : 'text-gray-400',
          )}
          style={{ fontSize: '10px' }}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function CategoryNavigationItem({
  category,
  isSelected,
  onToggle,
  onNavigate,
  count,
  hasVisibleChildren,
  isSportsTemplate = false,
}: {
  category: MedusaCategory
  isSelected: boolean
  onToggle: () => void
  onNavigate: () => void
  count: number
  hasVisibleChildren: boolean
  isSportsTemplate?: boolean
}) {
  return (
    <button
      className={cn(
        'flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left transition-colors',
        isSportsTemplate ? 'rounded-none' : 'rounded-md',
        isSelected
          ? 'bg-[--primary-color]/10 hover:bg-[--primary-color]/15'
          : 'hover:bg-gray-50',
      )}
      data-filter-option
      onClick={() => {
        onToggle()
        if (hasVisibleChildren) {
          onNavigate()
        }
      }}
      type='button'
    >
      {isSelected && (
        <CheckIcon className='size-4 shrink-0 text-[--primary-color]' />
      )}
      <span
        className={cn(
          'line-clamp-2 min-w-0 flex-1 text-sm',
          isSelected ? 'font-semibold text-[--primary-color]' : 'text-gray-600',
        )}
      >
        {getCategoryDisplayName(category.name)}
        <span
          className={cn(
            'ml-1 text-xs',
            isSelected ? 'text-[--primary-color]/70' : 'text-gray-400',
          )}
        >
          ({count})
        </span>
      </span>
      {hasVisibleChildren && (
        <span className={cn('shrink-0 p-0.5 transition-colors hover:bg-gray-100', isSportsTemplate ? 'rounded-none' : 'rounded')}>
          <ChevronRightIcon
            className={cn(
              'size-4',
              isSelected ? 'text-[--primary-color]' : 'text-gray-400',
            )}
          />
        </span>
      )}
    </button>
  )
}

function FilterAccordion({
  title,
  children,
  defaultOpen = true,
  sectionKey,
  isMobile,
  isLast = false,
  openOnMobile = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  sectionKey: string
  isMobile: boolean
  isLast?: boolean
  /** En mobile las secciones arrancan colapsadas; con esto una sección
   *  puntual (ej: Promociones) arranca desplegada. */
  openOnMobile?: boolean
}) {
  return (
    <Disclosure
      as='div'
      className={
        isMobile
          ? 'border-gray-200 border-b'
          : `${isLast ? '' : 'border-gray-200 border-b'} pb-4`
      }
      // On mobile the sheet mirrors the reference: sections start collapsed and
      // expand on tap, except those flagged openOnMobile (e.g. Promociones).
      // Desktop keeps sections open.
      defaultOpen={isMobile ? openOnMobile : defaultOpen}
      key={sectionKey}
    >
      {({ open }) => (
        <>
          <h3 className='flow-root'>
            <DisclosureButton
              className={`group flex w-full items-center justify-between bg-white ${isMobile ? 'px-4 py-4' : 'py-3'} text-gray-400 hover:text-gray-500`}
            >
              <span className='font-semibold text-gray-900 text-sm'>
                {title}
              </span>
              <span className='ml-6 flex items-center'>
                {open ? (
                  <MinusIcon
                    aria-hidden='true'
                    className='size-5'
                    style={{ color: '#1E1E1E', strokeWidth: 1.33 }}
                  />
                ) : (
                  <PlusIcon
                    aria-hidden='true'
                    className='size-5'
                    style={{ color: '#1E1E1E', strokeWidth: 1.33 }}
                  />
                )}
              </span>
            </DisclosureButton>
          </h3>
          <DisclosurePanel className={isMobile ? 'px-4 pb-4' : 'pt-4'}>
            {children}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}

function extractFacetCategoryMap(
  facetCounts: TypesenseFacetCount[],
): CategoryCounts {
  const readFacet = (field: string): Map<string, number> => {
    const facet = facetCounts.find((f) => f.field_name === field)
    const map = new Map<string, number>()
    if (facet) {
      for (const c of facet.counts) {
        map.set(c.value, c.count)
      }
    }
    return map
  }
  return {
    byId: readFacet('categories.id'),
    byName: readFacet('categories.name'),
  }
}

function computeCategoryCounts(opts: {
  hasBrandFilter: boolean
  selectedCategoryNames: string[]
  brandOnlyCategoryCounts: CategoryCounts
  facetCounts: TypesenseFacetCount[]
  facetUniverse: TypesenseFacetCount[]
}): CategoryCounts {
  if (
    opts.hasBrandFilter &&
    opts.selectedCategoryNames.length > 0 &&
    (opts.brandOnlyCategoryCounts.byId.size > 0 ||
      opts.brandOnlyCategoryCounts.byName.size > 0)
  ) {
    return opts.brandOnlyCategoryCounts
  }
  const source = opts.hasBrandFilter ? opts.facetCounts : opts.facetUniverse
  return extractFacetCategoryMap(source)
}

function buildActiveFilters(params: {
  selectedCategoryNames: string[]
  collection?: string
  brand?: string
  tag?: string
  selectedTags: string[]
  promotion?: string
  fragancia?: string
  sugerenciaUso?: string
  familiaOlfativa?: string
  familia?: string
  superficie?: string
  tipoProducto?: string
  ambiente?: string
  usoEspecial?: string
  base?: string
  priceMin?: number
  priceMax?: number
}): Record<string, string> {
  const active: Record<string, string> = {}
  if (params.selectedCategoryNames.length > 0) {
    active.category = params.selectedCategoryNames.join(',')
  }
  if (params.collection) {
    active.collection = params.collection
  }
  if (params.brand) {
    active.brand = params.brand
  }
  if (params.tag) {
    active.tag = params.tag
  }
  if (params.selectedTags.length > 0) {
    active.tags = params.selectedTags.join(',')
  }
  if (params.promotion) {
    active.promotion = params.promotion
  }
  if (params.fragancia) {
    active.fragancia = params.fragancia
  }
  if (params.sugerenciaUso) {
    active.sugerenciaUso = params.sugerenciaUso
  }
  for (const key of [
    'superficie',
    'tipoProducto',
    'ambiente',
    'usoEspecial',
    'base',
  ] as const) {
    const value = params[key]
    if (value) active[key] = value
  }
  if (params.familiaOlfativa) {
    active.familiaOlfativa = params.familiaOlfativa
  }
  if (params.familia) {
    active.familia = params.familia
  }
  if (params.priceMin != null) {
    active.priceMin = String(params.priceMin)
  }
  if (params.priceMax != null) {
    active.priceMax = String(params.priceMax)
  }
  return active
}

function formatPriceFilter(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ── Escala logarítmica del slider de precio ──────────────────────────────────
// El catálogo se concentra en la zona barata: con escala lineal, una pinturería
// que va de $78 a $1,85M mete el 90% de los productos en el primer 5% del track
// y el filtro es inusable. La escala es *geométrica* (cada tramo del track
// multiplica el precio por lo mismo), así el recorrido se reparte por orden de
// magnitud: con esos extremos, la mitad del slider llega a ~$12.000.
// El mínimo se acota a 1 porque `log(0)` sería -Infinity; en la práctica el
// filtro base del tenant ya descarta `price:0`.
function priceGeoBase(min: number): number {
  return Math.max(min, 1)
}

function priceGeoRatio(min: number, max: number): number {
  return Math.log(max / priceGeoBase(min)) || 1
}

function logPriceToFraction(price: number, min: number, max: number): number {
  const clamped = Math.min(Math.max(price, min), max)
  return Math.log(clamped / priceGeoBase(min)) / priceGeoRatio(min, max)
}

function logFractionToPrice(
  fraction: number,
  min: number,
  max: number,
): number {
  const clamped = Math.min(Math.max(fraction, 0), 1)
  return priceGeoBase(min) * Math.exp(clamped * priceGeoRatio(min, max))
}

// En escala log el `step` fijo del slider no sirve (un paso de $50.000 no
// existe abajo y sobra arriba): se redondea a 2 cifras significativas, así el
// valor arrastrado cae en $1.200 / $25.000 / $1.900.000.
function roundNicePrice(value: number, min: number, max: number): number {
  if (value <= min) return min
  if (value >= max) return max
  const magnitude = Math.max(1, 10 ** (Math.floor(Math.log10(value)) - 1))
  const rounded = Math.round(value / magnitude) * magnitude
  return Math.min(Math.max(rounded, min), max)
}

/** Redondea para arriba a 2 cifras significativas ($1.847.320 → $1.900.000). */
function ceilNicePrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value
  const magnitude = Math.max(1, 10 ** (Math.floor(Math.log10(value)) - 1))
  return Math.ceil(value / magnitude) * magnitude
}

function formatCompactPrice(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `$${millions.toFixed(millions >= 10 ? 0 : 1).replace('.', ',')}M`
  }
  if (value >= 10_000) return `$${Math.round(value / 1000)}k`
  return `$${Math.round(value).toLocaleString('es-AR')}`
}

function formatPresetPrice(value: number): string {
  if (value >= 1_000_000) return formatCompactPrice(value)
  return `$${Math.round(value).toLocaleString('es-AR')}`
}

// Cortes "redondos" (1/2/5 × 10^n) dentro de los extremos del catálogo. Son los
// candidatos para los rangos rápidos y evitan chips tipo "$3.847 – $18.233".
function nicePriceLadder(min: number, max: number): number[] {
  const ladder: number[] = []
  const firstExp = Math.floor(Math.log10(Math.max(min, 1)))
  const lastExp = Math.ceil(Math.log10(Math.max(max, 10)))
  for (let exp = firstExp; exp <= lastExp; exp++) {
    for (const mantissa of [1, 2, 5]) {
      const value = mantissa * 10 ** exp
      if (value > min && value < max) ladder.push(value)
    }
  }
  return ladder
}

type PricePreset = { label: string; min: number; max: number }

// Múltiplos del precio promedio que definen los cortes. Repartir los cortes
// parejo entre los extremos NO sirve: los extremos son colas de un producto
// suelto ($78 abajo, $1,85M arriba) y el primer chip salía "Hasta $20", vacío.
// El promedio, en cambio, cae dentro de la zona densa: las distribuciones de
// precio son aproximadamente log-normales, así que anclando en él quedan tres
// de los cinco chips sobre el grueso del catálogo. Con un promedio de ~$20.000
// esto da 2.000 / 5.000 / 20.000 / 100.000.
const PRICE_PRESET_MULTIPLIERS = [0.1, 0.25, 1, 4]

/** Corte redondo (1/2/5 × 10^n) más cercano en escala log a `value`. */
function snapToNiceCut(value: number, ladder: number[]): number | null {
  let best: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of ladder) {
    const distance = Math.abs(Math.log(candidate / value))
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  return best
}

// Rangos rápidos anclados en el precio promedio del catálogo (ver
// PRICE_PRESET_MULTIPLIERS). `avg` viene en las mismas `stats` de Typesense que
// dan los extremos, sin queries extra. Sin `avg` se cae a cortes repartidos
// parejo en la escala geométrica, que es lo mejor que se puede hacer a ciegas.
function buildPricePresets(
  min: number,
  max: number,
  avg?: number,
): PricePreset[] {
  const ladder = nicePriceLadder(min, max)
  if (ladder.length < 2) return []

  const targets =
    avg != null && Number.isFinite(avg) && avg > 0
      ? PRICE_PRESET_MULTIPLIERS.map((multiplier) => avg * multiplier)
      : [1, 2, 3, 4].map((i) => logFractionToPrice(i / 5, min, max))

  const cuts: number[] = []
  for (const target of targets) {
    const snapped = snapToNiceCut(
      target,
      ladder.filter((candidate) => !cuts.includes(candidate)),
    )
    if (snapped != null) cuts.push(snapped)
  }
  cuts.sort((a, b) => a - b)

  const presets: PricePreset[] = []
  let lower = min
  for (const cut of cuts) {
    presets.push({ label: '', min: lower, max: cut })
    lower = cut
  }
  presets.push({ label: '', min: lower, max })

  return presets.map((preset, index) => {
    if (index === 0) {
      return { ...preset, label: `Hasta ${formatPresetPrice(preset.max)}` }
    }
    if (index === presets.length - 1) {
      return { ...preset, label: `Más de ${formatPresetPrice(preset.min)}` }
    }
    return {
      ...preset,
      label: `${formatPresetPrice(preset.min)} – ${formatPresetPrice(preset.max)}`,
    }
  })
}

// El slider trabaja en fracciones 0..1 discretizadas: 1000 posiciones alcanzan
// para que el arrastre se sienta continuo en cualquier orden de magnitud.
const PRICE_SLIDER_STEPS = 1000

function parseStoreSearchParams(searchParams: URLSearchParams) {
  const q = searchParams.get('q') || undefined
  const explicitSort = searchParams.get('sortBy') as SortOption | null
  const sortBy: SortOption = explicitSort || 'relevance'
  return {
    q,
    sortBy,
    categoryParam: searchParams.get('category') || undefined,
    collection: searchParams.get('collection') || undefined,
    brand: searchParams.get('brand') || undefined,
    tag: searchParams.get('tag') || undefined,
    tagsParam: searchParams.get('tags') || undefined,
    promotion: searchParams.get('promotion') || undefined,
    onlyPromotions: searchParams.get('promos') === '1',
    fragancia: searchParams.get('fragancia') || undefined,
    sugerenciaUso: searchParams.get('sugerenciaUso') || undefined,
    familiaOlfativa: searchParams.get('familiaOlfativa') || undefined,
    familia: searchParams.get('familia') || undefined,
    // Atributos del asesor. Los nombres de param van en castellano porque son
    // URLs que se comparten y que el equipo arma a mano para las cards del home.
    superficie: searchParams.get('superficie') || undefined,
    tipoProducto: searchParams.get('tipoProducto') || undefined,
    ambiente: searchParams.get('ambiente') || undefined,
    usoEspecial: searchParams.get('usoEspecial') || undefined,
    base: searchParams.get('base') || undefined,
    priceMinParam: searchParams.get('priceMin'),
    priceMaxParam: searchParams.get('priceMax'),
  }
}

type StoreClientPageProps = {
  countryCode: string
  initialCategories: MedusaCategory[]
}

export default function StoreClientPage({ countryCode, initialCategories }: StoreClientPageProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const tenant = useTenant()
  const { isMobileFiltersOpen, openMobileFilters, closeMobileFilters } =
    useUIStore()
  // Bottom sheet de orden en mobile (la barra flotante lo abre).
  const [isMobileSortOpen, setIsMobileSortOpen] = useState(false)
  const usesCustomTemplate = isImpulseTemplate(tenant.template)
  const isSportsTemplate = tenant.template === 'sports'

  // Force scroll to the top of the page. Overrides the global
  // `html { scroll-behavior: smooth }` (globals.css) inline, then sets scroll
  // via multiple methods because in production builds the immediate scroll
  // can be interrupted by scroll restoration, the infinite-scroll container
  // shrinking mid-animation, or browsers that don't honor `behavior: 'instant'`.
  const scrollProductsToTop = useCallback(() => {
    const html = document.documentElement
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    html.scrollTop = 0
    document.body.scrollTop = 0
    // Restore the default CSS scroll-behavior on the next frame.
    requestAnimationFrame(() => {
      html.style.scrollBehavior = ''
    })
  }, [])

  useEffect(() => {
    const brand = searchParams.get('brand')
    const category = searchParams.get('category')
    const filter = brand || category
    document.title = filter
      ? `${filter} | Tienda | ${tenant.name}`
      : `Tienda | ${tenant.name}`
  }, [searchParams, tenant.name])

  // Árbol de categorías inicializado sincrónicamente desde la prop SSR —
  // elimina el flash de estado vacío y el fetch cliente que se ejecutaba en cada montaje.
  const [categoryTree] = useState<MedusaCategory[]>(() => buildCategoryTree(initialCategories))

  // `buildCategoryTree` YA devuelve solo raíces. Filtrar de nuevo por
  // `!parent_category` perdía ramas enteras: un nodo cuyo padre no está en la
  // lista plana (porque está inactivo o es interno, y /store/product-categories
  // no lo devuelve) cae en las raíces CON `parent_category` poblado, y el
  // filtro lo descartaba junto con todos sus hijos.
  const rootCategories = categoryTree

  // Category navigation state (like selectio-b2b)
  const [categoryNavPath, setCategoryNavPath] = useState<MedusaCategory[]>([])

  // Track which filter sections are expanded ("Ver más")
  const [expandedFilters, setExpandedFilters] = useState<Record<string, boolean>>(
    {},
  )
  // Texto de búsqueda dentro de una sección con muchas opciones (marcas, familia).
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({})

  // URL params
  const {
    q,
    sortBy,
    categoryParam,
    collection,
    brand,
    tag,
    tagsParam,
    promotion,
    onlyPromotions,
    fragancia,
    sugerenciaUso,
    familiaOlfativa,
    familia,
    superficie,
    tipoProducto,
    ambiente,
    usoEspecial,
    base,
    priceMinParam,
    priceMaxParam,
  } = parseStoreSearchParams(searchParams)

  const selectedCategoryNames = useMemo(
    () => (categoryParam ? categoryParam.split(',').filter(Boolean) : []),
    [categoryParam],
  )

  const selectedCategoriesSet = useMemo(
    () => new Set(selectedCategoryNames),
    [selectedCategoryNames],
  )

  const selectedTags = useMemo(
    () => (tagsParam ? tagsParam.split(',').filter(Boolean) : []),
    [tagsParam],
  )

  const priceMin = priceMinParam ? Number(priceMinParam) : undefined
  const priceMax = priceMaxParam ? Number(priceMaxParam) : undefined

  // Mapea la selección de categorías al filtro de Typesense. Los productos viven
  // en las categorías HOJA (su `categories.name` no incluye a los ancestros), así
  // que seleccionar un PADRE debe expandirse a sus descendientes para mostrar lo
  // de todas las hijas (`categories.name:=[...]` es un OR).
  // - Si una seleccionada tiene una descendiente también seleccionada, es solo un
  //   breadcrumb ancestro: la descendiente (más específica) define el filtro.
  // - Si no, se incluye su nombre + TODAS sus descendientes.
  const effectiveCategoryNames = useMemo(() => {
    if (selectedCategoryNames.length === 0) {
      return undefined
    }
    if (categoryTree.length === 0) {
      return selectedCategoryNames
    }
    const selectedSet = new Set(selectedCategoryNames)
    const result = new Set<string>()
    for (const name of selectedCategoryNames) {
      const cat = findCategoryInTree(name, categoryTree)
      if (!cat) {
        result.add(name)
        continue
      }
      const descendants = Array.from(collectDescendantNames(cat))
      // Ancestro de otra selección más específica → lo maneja la descendiente.
      if (descendants.some((d) => selectedSet.has(d))) {
        continue
      }
      result.add(name)
      for (const d of descendants) {
        result.add(d)
      }
    }
    return result.size > 0 ? Array.from(result) : selectedCategoryNames
  }, [selectedCategoryNames, categoryTree])

  // Re-assert scroll-to-top after every filter param change. The immediate
  // scroll from the click handler can be overridden in production builds
  // (smooth-scroll CSS, scroll restoration, or the infinite-scroll list
  // shrinking mid-animation). Running again after the re-render guarantees we
  // land at the top regardless of the new list's height. Sort changes are
  // intentionally excluded — only filter selections and the committed search
  // term (?q=) trigger this, so searching from the header (which pushes with
  // scroll: false) always brings the results into view.
  const filterKey = [
    q,
    categoryParam,
    collection,
    brand,
    tag,
    tagsParam,
    promotion,
    fragancia,
    sugerenciaUso,
    familiaOlfativa,
    familia,
    superficie,
    tipoProducto,
    ambiente,
    usoEspecial,
    base,
    priceMinParam,
    priceMaxParam,
  ].join('|')
  const prevFilterKeyRef = useRef(filterKey)
  useEffect(() => {
    if (prevFilterKeyRef.current === filterKey) {
      return
    }
    prevFilterKeyRef.current = filterKey
    scrollProductsToTop()
  }, [filterKey, scrollProductsToTop])

  const {
    products,
    found,
    page,
    totalPages,
    facetCounts,
    facetUniverse,
    unfilteredFound,
    isLoading,
    error,
    loadMore,
  } = useTypesenseProducts({
    q,
    sortBy,
    categoryNames: effectiveCategoryNames,
    collection,
    brand,
    tag,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    promotion,
    onlyPromotions,
    fragancia,
    sugerenciaUso,
    familiaOlfativa,
    family: familia,
    advisorSurface: superficie,
    advisorProductType: tipoProducto,
    advisorEnvironment: ambiente,
    advisorSpecialUse: usoEspecial,
    advisorBase: base,
    priceMin,
    priceMax,
    limit: 12,
    facets: true,
  })
  const formattedFound = useMemo(
    () => new Intl.NumberFormat('es-AR').format(found),
    [found],
  )

  // Build filters from facetCounts (filtered) so promotions/etiquetas/etc.
  // narrow down based on currently applied filters (brand, category, etc.).
  // Fall back to facetUniverse before facets load.
  const filters = useMemo(
    () =>
      buildFiltersFromFacets(
        facetCounts.length > 0 ? facetCounts : facetUniverse,
      ),
    [facetCounts, facetUniverse],
  )

  const promotionFilter = filters.find((f) => f.id === 'promotion')
  const collectionsFilter = filters.find((f) => f.id === 'collection')
  const brandsFilter = filters.find((f) => f.id === 'brand')
  const familiaFilter = filters.find((f) => f.id === 'familia')
  const tagsFilter = filters.find((f) => f.id === 'tag')
  const otherFilters = filters.filter(
    (f) =>
      f.id !== 'promotion' &&
      f.id !== 'collection' &&
      f.id !== 'brand' &&
      f.id !== 'familia' &&
      f.id !== 'tag',
  )

  const hasBrandFilter = !!brand

  const [brandOnlyCategoryCounts, setBrandOnlyCategoryCounts] =
    useState<CategoryCounts>(EMPTY_CATEGORY_COUNTS)

  useEffect(() => {
    if (hasBrandFilter && selectedCategoryNames.length === 0) {
      setBrandOnlyCategoryCounts(extractFacetCategoryMap(facetCounts))
    } else if (!hasBrandFilter) {
      setBrandOnlyCategoryCounts(EMPTY_CATEGORY_COUNTS)
    }
  }, [facetCounts, hasBrandFilter, selectedCategoryNames.length])

  const categoryCounts = useMemo(
    () =>
      computeCategoryCounts({
        hasBrandFilter,
        selectedCategoryNames,
        brandOnlyCategoryCounts,
        facetCounts,
        facetUniverse,
      }),
    [
      facetCounts,
      facetUniverse,
      hasBrandFilter,
      selectedCategoryNames,
      brandOnlyCategoryCounts,
    ],
  )

  // Counts acumulados por subárbol: los padres muestran el total de sus hijas.
  const rolledUpCounts = useMemo(
    () => buildRolledUpCounts(categoryTree, categoryCounts),
    [categoryTree, categoryCounts],
  )

  // ── Rango de precio: extremos reales del catálogo ────────────────────────
  // Salen de `facet_counts[].stats` de la query de facet-universe, que aplica
  // SOLO los filtros base del tenant (canal, hidden_from_store, price>0) y no
  // los del usuario: si usara los del usuario, el slider se colapsaría contra
  // la selección en cuanto se moviera.
  const priceStats = useMemo(() => {
    const source = facetUniverse.length > 0 ? facetUniverse : facetCounts
    return source.find((facet) => facet.field_name === 'price')?.stats
  }, [facetUniverse, facetCounts])

  // Con precio activo los bounds se congelan: la query de universo SÍ incluye
  // `q`, así que sin esto los extremos podrían moverse bajo los pies del
  // usuario mientras arrastra. Se resetean al cambiar la búsqueda.
  const priceBoundsRef = useRef<{
    min: number
    max: number
    avg?: number
  } | null>(null)
  useEffect(() => {
    priceBoundsRef.current = null
  }, [q])

  const priceRange = useMemo(() => {
    const hasUserPrice = priceMin != null || priceMax != null
    if (hasUserPrice && priceBoundsRef.current) {
      return priceBoundsRef.current
    }
    const min = priceStats?.min
    const max = priceStats?.max
    // Sin stats (colección sin la faceta `price`) o con un único precio no se
    // renderiza el slider: un track de ancho cero divide por cero al posicionar.
    if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) {
      return null
    }
    // El extremo inferior es el precio real más barato, sin redondear: con un
    // paso grueso (el span pide $50.000) un catálogo que arranca en $78 mostraba
    // "$0" y el primer chip quedaba vacío. El superior sí se redondea para
    // arriba a un número presentable ($1.847.320 → $1.900.000).
    const rounded = {
      min: Math.floor(min),
      max: ceilNicePrice(max),
      avg: priceStats?.avg,
    }
    if (rounded.max <= rounded.min) return null
    priceBoundsRef.current = rounded
    return rounded
  }, [priceStats, priceMin, priceMax])

  const [localPriceRange, setLocalPriceRange] = useState<[number, number]>([
    0, 0,
  ])
  const [priceInputText, setPriceInputText] = useState<{
    min: string
    max: string
  }>({
    min: '',
    max: '',
  })
  const [priceInputFocused, setPriceInputFocused] = useState<
    'min' | 'max' | null
  >(null)
  const priceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!priceRange) return
    const newMin = priceMin ?? priceRange.min
    const newMax = priceMax ?? priceRange.max
    setLocalPriceRange([newMin, newMax])
    if (!priceInputFocused) {
      setPriceInputText({
        min: newMin.toLocaleString('es-AR'),
        max: newMax.toLocaleString('es-AR'),
      })
    }
  }, [priceMin, priceMax, priceRange, priceInputFocused])

  // Active filters
  const activeFilters = useMemo(
    () =>
      buildActiveFilters({
        selectedCategoryNames,
        collection,
        brand,
        tag,
        selectedTags,
        promotion,
        fragancia,
        sugerenciaUso,
        familiaOlfativa,
        familia,
        superficie,
        tipoProducto,
        ambiente,
        usoEspecial,
        base,
        priceMin,
        priceMax,
      }),
    [
      selectedCategoryNames,
      collection,
      brand,
      tag,
      selectedTags,
      promotion,
      fragancia,
      sugerenciaUso,
      familiaOlfativa,
      familia,
      superficie,
      tipoProducto,
      ambiente,
      usoEspecial,
      base,
      priceMin,
      priceMax,
    ],
  )

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || !!q

  // Filtros del asesor activos, para la barra de "Filtros Activos". Se arma por
  // lista y no chip a chip como el resto: son cinco params homogéneos y
  // enumerarlos a mano fue justamente lo que los dejó afuera de la barra.
  const activeAdvisorFilters = useMemo(
    () =>
      ADVISOR_FILTER_ID_LIST.map(
        (id) => [id, activeFilters[id]] as const,
      ).filter(
        (entry): entry is readonly [AdvisorFilterId, string] => !!entry[1],
      ),
    [activeFilters],
  )

  // Handlers
  const handleFilterChange = useCallback(
    (sectionId: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const currentValue = params.get(sectionId)
      if (currentValue === value) {
        params.delete(sectionId)
        if (sectionId === 'collection') {
          params.delete('tag')
          params.delete('tags')
        }
      } else {
        params.set(sectionId, value)
        if (sectionId === 'collection') {
          params.delete('tag')
          params.delete('tags')
        }
      }
      params.delete('page')
      scrollProductsToTop()
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, pathname, router, scrollProductsToTop],
  )

  const handleTagToggle = useCallback(
    (tagValue: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const currentTags = new Set(
        (params.get('tags') || '').split(',').filter(Boolean),
      )
      const isAdding = !currentTags.has(tagValue)
      if (isAdding) {
        currentTags.add(tagValue)
      } else {
        currentTags.delete(tagValue)
      }
      if (currentTags.size > 0) {
        params.set('tags', Array.from(currentTags).join(','))
      } else {
        params.delete('tags')
      }
      // Tag + category can have no overlapping products. When adding a tag,
      // drop any active category so the grid never goes empty by combination.
      if (isAdding && params.has('category')) {
        params.delete('category')
        setCategoryNavPath([])
      }
      params.delete('page')
      scrollProductsToTop()
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, pathname, router, scrollProductsToTop],
  )

  const handlePriceRangeChange = useCallback(
    (min: number | null, max: number | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (min != null) {
        params.set('priceMin', String(min))
      } else {
        params.delete('priceMin')
      }
      if (max != null) {
        params.set('priceMax', String(max))
      } else {
        params.delete('priceMax')
      }
      params.delete('page')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, pathname, router],
  )

  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (sortBy && sortBy !== 'created_at' && sortBy !== 'relevance') {
      params.set('sortBy', sortBy)
    }
    setCategoryNavPath([])
    scrollProductsToTop()
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }, [sortBy, pathname, router, scrollProductsToTop])

  // Mirrors the search-sort-bar's behavior when the user clears the search
  // input: dropping the query also clears the facet filters so the grid never
  // shows a mixed state. Keeps "X on search chip" equivalent to "empty the
  // search box" per the ticket acceptance criteria.
  const handleClearSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('q')
    params.delete('category')
    params.delete('collection')
    params.delete('brand')
    params.delete('tag')
    params.delete('tags')
    params.delete('promotion')
    params.delete('fragancia')
    params.delete('sugerenciaUso')
    params.delete('familiaOlfativa')
    params.delete('familia')
    for (const id of ADVISOR_FILTER_ID_LIST) {
      params.delete(id)
    }
    params.delete('priceMin')
    params.delete('priceMax')
    params.delete('page')
    setCategoryNavPath([])
    scrollProductsToTop()
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, pathname, router, scrollProductsToTop])

  const handleSortChange = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(name, value)
      params.delete('page')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, pathname, router],
  )

  const handleCategoryToggle = useCallback(
    (categoryName: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const currentCategories = new Set(
        (params.get('category') || '').split(',').filter(Boolean),
      )
      const wasSelected = currentCategories.has(categoryName)
      if (wasSelected) {
        // Cascade: remove this category and all descendants. Without a back
        // button, removing a chip is the only way to leave a deeper level, so
        // descendants must follow or they'd be orphaned.
        currentCategories.delete(categoryName)
        const cat = findCategoryInTree(categoryName, categoryTree)
        if (cat) {
          for (const d of Array.from(collectDescendantNames(cat))) {
            currentCategories.delete(d)
          }
        }
      } else {
        // Keep ancestors so the chips show the full navigation hierarchy.
        currentCategories.add(categoryName)
        // Category + tag can have no overlapping products, leaving the grid
        // empty. Latest category selection still wins over tags, but
        // promotions are intentionally preserved so users can combine both.
        params.delete('tag')
        params.delete('tags')
      }
      if (currentCategories.size > 0) {
        params.set('category', Array.from(currentCategories).join(','))
      } else {
        params.delete('category')
      }
      params.delete('page')
      // Prune nav path to items still selected, so the visible list mirrors
      // the active selection branch after a chip removal.
      setCategoryNavPath((prev) =>
        prev.filter((c) => currentCategories.has(c.name)),
      )
      scrollProductsToTop()
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, pathname, router, categoryTree, scrollProductsToTop],
  )

  // Rangos rápidos del catálogo (ver `buildPricePresets`): resuelven el caso
  // común en un clic y dejan el slider para afinar.
  const pricePresets = useMemo(
    () =>
      priceRange
        ? buildPricePresets(priceRange.min, priceRange.max, priceRange.avg)
        : [],
    [priceRange],
  )

  // El chip activo se deriva de la URL (no de estado propio) para que sobreviva
  // al back/forward y a los chips de filtros activos.
  const activePresetIndex = useMemo(() => {
    if (!priceRange) return null
    if (priceMin == null && priceMax == null) return null
    const currentMin = priceMin ?? priceRange.min
    const currentMax = priceMax ?? priceRange.max
    const index = pricePresets.findIndex(
      (preset) => preset.min === currentMin && preset.max === currentMax,
    )
    return index === -1 ? null : index
  }, [pricePresets, priceMin, priceMax, priceRange])

  // Etiquetas de la escala: 4 marcas equiespaciadas *en log*, así el usuario ve
  // que el primer tercio del track cubre precios bajos.
  const priceScaleTicks = useMemo(() => {
    if (!priceRange) return []
    return [0, 1 / 3, 2 / 3, 1].map((fraction) =>
      formatCompactPrice(
        fraction === 0
          ? priceRange.min
          : fraction === 1
            ? priceRange.max
            : roundNicePrice(
                logFractionToPrice(fraction, priceRange.min, priceRange.max),
                priceRange.min,
                priceRange.max,
              ),
      ),
    )
  }, [priceRange])

  const handlePricePresetClick = useCallback(
    (index: number) => {
      if (!priceRange) return
      // Volver a tocar el chip activo limpia el filtro: es el único gesto de
      // salida obvio cuando el chip queda pintado.
      if (activePresetIndex === index) {
        setLocalPriceRange([priceRange.min, priceRange.max])
        handlePriceRangeChange(null, null)
        return
      }
      const preset = pricePresets[index]
      if (!preset) return
      if (priceDebounceRef.current) {
        clearTimeout(priceDebounceRef.current)
      }
      setLocalPriceRange([preset.min, preset.max])
      handlePriceRangeChange(preset.min, preset.max)
    },
    [activePresetIndex, pricePresets, priceRange, handlePriceRangeChange],
  )

  const handlePriceSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, bound: 'min' | 'max') => {
      if (!priceRange) return
      // El input entrega una fracción del track (escala log), no pesos.
      const val = roundNicePrice(
        logFractionToPrice(
          Number(e.target.value) / PRICE_SLIDER_STEPS,
          priceRange.min,
          priceRange.max,
        ),
        priceRange.min,
        priceRange.max,
      )
      setLocalPriceRange((prev) => {
        const next: [number, number] =
          bound === 'min'
            ? [Math.min(val, prev[1]), prev[1]]
            : [prev[0], Math.max(val, prev[0])]
        setPriceInputText({
          min: next[0].toLocaleString('es-AR'),
          max: next[1].toLocaleString('es-AR'),
        })
        if (priceDebounceRef.current) {
          clearTimeout(priceDebounceRef.current)
        }
        priceDebounceRef.current = setTimeout(() => {
          const isFullRange =
            next[0] <= priceRange.min && next[1] >= priceRange.max
          handlePriceRangeChange(
            isFullRange ? null : next[0],
            isFullRange ? null : next[1],
          )
        }, 400)
        return next
      })
    },
    [priceRange, handlePriceRangeChange],
  )

  const handleClearPriceFilter = useCallback(() => {
    if (priceRange) setLocalPriceRange([priceRange.min, priceRange.max])
    handlePriceRangeChange(null, null)
  }, [priceRange, handlePriceRangeChange])

  // Category navigation
  const handleCategoryNavigate = useCallback((cat: MedusaCategory) => {
    setCategoryNavPath((prev) => [...prev, cat])
  }, [])

  const visibleCategories = useMemo(() => {
    const cats =
      categoryNavPath.length > 0
        ? categoryNavPath.at(-1)?.category_children || []
        : rootCategories
    const filtered = cats.filter((cat) =>
      hasVisibleProducts(cat, categoryCounts),
    )
    // Con una categoría elegida se muestra SOLO la rama que la contiene, en
    // cualquier nivel: los hermanos no combinan con la selección (el filtro es
    // un OR de nombres, no una intersección), así que dejarlos a la vista
    // sugiere que se pueden sumar cuando en realidad reemplazan.
    if (selectedCategoryNames.length > 0) {
      const containsSelected = (cat: MedusaCategory): boolean => {
        if (selectedCategoriesSet.has(cat.name)) return true
        return (cat.category_children || []).some(containsSelected)
      }
      const narrowed = filtered.filter(containsSelected)
      if (narrowed.length > 0) return narrowed
    }
    return filtered
  }, [
    categoryNavPath,
    rootCategories,
    categoryCounts,
    selectedCategoryNames,
    selectedCategoriesSet,
  ])

  // Render filter section - collapses on select, shows only selected item
  const renderFilterSection = (
    section: FilterSection,
    isMobile: boolean,
    isLast = false,
    openOnMobile = false,
  ) => {
    const activeValue = activeFilters[section.id]
    const isActive = !!activeValue

    const COLLAPSED_COUNT = 6
    const isExpanded = expandedFilters[section.id]
    // Buscador local a partir de 20 opciones: el catálogo del ERP trae 125
    // marcas, y "Ver más (119)" sobre una lista sin filtrar es inusable. Las
    // opciones ya están en memoria, así que no vuelve a pegarle a Typesense.
    const SEARCHABLE_FROM = 20
    const isSearchable = section.options.length >= SEARCHABLE_FROM
    const searchTerm = (filterSearch[section.id] ?? '').trim().toLowerCase()
    const matchingOptions = searchTerm
      ? section.options.filter((option) =>
          option.label.toLowerCase().includes(searchTerm),
        )
      : section.options
    const hasMore = matchingOptions.length > COLLAPSED_COUNT
    const visibleOptions =
      hasMore && !isExpanded
        ? matchingOptions.slice(0, COLLAPSED_COUNT)
        : matchingOptions

    return (
      <FilterAccordion
        isMobile={isMobile}
        isLast={isLast}
        openOnMobile={openOnMobile}
        key={section.id}
        sectionKey={section.id}
        title={section.name}
      >
        <div className='space-y-1'>
          {isActive ? (
            <div
              className={cn(
                'flex items-center justify-between bg-gray-50 px-3 py-2',
                isSportsTemplate ? 'rounded-none' : 'rounded-md',
              )}
              data-filter-selected
            >
              <span className='font-medium text-gray-900 text-sm'>
                {getFilterValueLabel(section.id, activeValue)}
              </span>
              <button
                className={cn(
                  'p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600',
                  isSportsTemplate ? 'rounded-none' : 'rounded-full',
                )}
                disabled={isPending}
                onClick={() => handleFilterChange(section.id, activeValue)}
                type='button'
              >
                <XMarkIcon className='size-4' />
              </button>
            </div>
          ) : (
            <>
              {isSearchable && (
                <input
                  className='mb-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-gray-700 text-sm focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]'
                  onChange={(e) =>
                    setFilterSearch((prev) => ({
                      ...prev,
                      [section.id]: e.target.value,
                    }))
                  }
                  placeholder={`Buscar en ${section.name.toLowerCase()}`}
                  type='search'
                  value={filterSearch[section.id] ?? ''}
                />
              )}
              {visibleOptions.length === 0 && (
                <p className='px-2 py-1.5 text-gray-400 text-sm'>
                  Sin resultados
                </p>
              )}
              {visibleOptions.map((option) => (
                <button
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-1.5 text-left text-gray-600 text-sm transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50',
                    isSportsTemplate ? 'rounded-none' : 'rounded-md',
                  )}
                  data-filter-option
                  disabled={isPending}
                  key={option.value}
                  onClick={() => {
                    // Se limpia el buscador de la sección: si no, al sacar el
                    // filtro la lista volvería filtrada por un término viejo
                    // que ya no está visible en ningún lado.
                    setFilterSearch((prev) => ({ ...prev, [section.id]: '' }))
                    handleFilterChange(section.id, option.value)
                  }}
                  type='button'
                >
                  <span className='min-w-0 flex-1 truncate'>
                    {option.label}
                  </span>
                  {option.count != null && (
                    <span className='text-gray-400 text-xs'>
                      ({option.count})
                    </span>
                  )}
                </button>
              ))}
              {hasMore && (
                <button
                  className='px-2 py-1.5 text-left font-medium text-gray-900 text-sm underline-offset-2 transition-colors hover:underline'
                  onClick={() =>
                    setExpandedFilters((prev) => ({
                      ...prev,
                      [section.id]: !prev[section.id],
                    }))
                  }
                  type='button'
                >
                  {isExpanded
                    ? 'Ver menos'
                    : `Ver más (${matchingOptions.length - COLLAPSED_COUNT})`}
                </button>
              )}
            </>
          )}
        </div>
      </FilterAccordion>
    )
  }

  // Render tags as pills (multi-select)
  const renderTagsPillSection = (section: FilterSection, isMobile: boolean) => (
    <FilterAccordion
      isLast
      isMobile={isMobile}
      key={section.id}
      sectionKey={section.id}
      title={section.name}
    >
      <div className='flex flex-wrap gap-2'>
        {section.options.map((option) => (
          <FilterPill
            count={option.count}
            isSelected={selectedTags.includes(option.value)}
            isSportsTemplate={isSportsTemplate}
            key={option.value}
            label={option.label}
            onToggle={() => handleTagToggle(option.value)}
          />
        ))}
      </div>
    </FilterAccordion>
  )

  // Render category navigation section (hierarchical from Medusa, or flat from Typesense facets as fallback)
  const renderCategorySection = (isMobile: boolean, isLast = false) => {
    const renderFlatCategoryList = () => {
      // Fallback sin árbol de Medusa: acá la clave del map ES la etiqueta y el
      // valor que se togglea, así que este listado sigue yendo por nombre.
      if (categoryCounts.byName.size === 0) {
        return null
      }
      const sorted = Array.from(categoryCounts.byName.entries()).sort(
        (a, b) => b[1] - a[1],
      )
      return (
        <FilterAccordion
          isLast={isLast}
          isMobile={isMobile}
          sectionKey='category-tree'
          title='Categorías'
        >
          <div className='space-y-0.5'>
            {sorted.map(([name, count]) => (
              <button
                className={cn(
                  'flex w-full items-center justify-between px-2 py-1.5 text-sm transition-colors hover:bg-gray-50',
                  isSportsTemplate ? 'rounded-none' : 'rounded-md',
                  selectedCategoriesSet.has(name)
                    ? 'font-semibold text-[--primary-color]'
                    : 'text-gray-700',
                )}
                data-filter-option
                key={name}
                onClick={() => handleCategoryToggle(name)}
                type='button'
              >
                <span className='truncate'>{getCategoryDisplayName(name)}</span>
                <span className='ml-2 shrink-0 text-gray-400 text-xs'>
                  ({count})
                </span>
              </button>
            ))}
          </div>
        </FilterAccordion>
      )
    }

    // Fallback: flat list from Typesense facets when Medusa categories API fails
    // or when the current demo catalog has facet categories that are absent from
    // the global Medusa category tree loaded for the storefront.
    if (rootCategories.length === 0) {
      return renderFlatCategoryList()
    }

    if (visibleCategories.length === 0 && categoryNavPath.length === 0) {
      return renderFlatCategoryList()
    }

    return (
      <FilterAccordion
        isLast={isLast}
        isMobile={isMobile}
        sectionKey='category-tree'
        title='Categorías'
      >
        {/* Category list with slide animation */}
        <div className='relative overflow-hidden'>
          <AnimatePresence initial={false} mode='wait'>
            <motion.div
              animate={{ x: 0, opacity: 1 }}
              className='space-y-0.5'
              exit={{ x: '-100%', opacity: 0 }}
              initial={{ x: '-100%', opacity: 0 }}
              // La `key` DEBE incluir la selección, no solo el drill-down:
              // `AnimatePresence mode="wait"` no renderiza los children vivos
              // sino un snapshot interno que recién refresca cuando cambia la
              // key. Con la key vieja, elegir una categoría dejaba la lista
              // congelada en las 10 raíces (el resto de la barra —chips, Familia,
              // el grid— sí se actualizaba, porque están fuera de este bloque).
              key={[
                categoryNavPath.map((p) => p.id).join('-') || 'root',
                selectedCategoryNames.join(','),
              ].join('|')}
              transition={{ type: 'tween', duration: 0.2, ease: 'easeInOut' }}
            >
              {visibleCategories.length > 0 &&
                visibleCategories.map((cat) => {
                  const visibleChildren = (cat.category_children || []).filter(
                    (child) => hasVisibleProducts(child, categoryCounts),
                  )
                  return (
                    <CategoryNavigationItem
                      category={cat}
                      count={
                        rolledUpCounts.get(cat.id) ??
                        countOfCategory(cat, categoryCounts)
                      }
                      hasVisibleChildren={visibleChildren.length > 0}
                      isSelected={selectedCategoriesSet.has(cat.name)}
                      isSportsTemplate={isSportsTemplate}
                      key={cat.id}
                      onNavigate={() => handleCategoryNavigate(cat)}
                      onToggle={() => handleCategoryToggle(cat.name)}
                    />
                  )
                })}
              {visibleCategories.length === 0 && categoryNavPath.length > 0 && (
                <p className='py-2 text-gray-500 text-sm'>
                  No hay subcategorías
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </FilterAccordion>
    )
  }

  // Handle manual price input change — allow free typing, no clamping
  const handlePriceInputChange = useCallback(
    (value: string, bound: 'min' | 'max') => {
      const raw = value.replace(/[^\d]/g, '')
      setPriceInputText((prev) => ({ ...prev, [bound]: raw }))
    },
    [],
  )

  // Commit price range to URL on Enter or blur — clamp, then push
  const commitPriceRange = useCallback(
    (bound?: 'min' | 'max') => {
      if (priceDebounceRef.current) {
        clearTimeout(priceDebounceRef.current)
      }
      if (!priceRange) return

      /**
       * El valor tipeado se respeta TAL CUAL (solo se acota al rango del
       * catálogo). NO se redondea al paso del slider: ese paso se calcula sobre
       * el span del catálogo y en una pinturería que va de $78 a $1,85M vale
       * $50.000, así que redondear convertía un "4000" tipeado a mano en 0 y el
       * filtro devolvía cero productos. El `step` es para arrastrar el slider,
       * no para lo que el usuario escribe.
       */
      const parsePrice = (text: string, fallback: number) => {
        const num = Number(text.replace(/\D/g, ''))
        if (!num || Number.isNaN(num)) {
          return fallback
        }
        return num
      }

      let newMin = parsePrice(priceInputText.min, priceRange.min)
      let newMax = parsePrice(priceInputText.max, priceRange.max)

      newMin = Math.max(priceRange.min, Math.min(newMin, priceRange.max))
      newMax = Math.max(priceRange.min, Math.min(newMax, priceRange.max))

      if (newMin > newMax) {
        if (bound === 'min') {
          newMin = newMax
        } else {
          newMax = newMin
        }
      }

      setLocalPriceRange([newMin, newMax])
      setPriceInputText({
        min: newMin.toLocaleString('es-AR'),
        max: newMax.toLocaleString('es-AR'),
      })
      setPriceInputFocused(null)

      const isFullRange = newMin <= priceRange.min && newMax >= priceRange.max
      handlePriceRangeChange(
        isFullRange ? null : newMin,
        isFullRange ? null : newMax,
      )
    },
    [priceInputText, priceRange, handlePriceRangeChange],
  )

  const handlePriceInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur()
      }
    },
    [],
  )

  // Render price filter - single row with overlapping range thumbs + editable inputs
  const renderPriceFilter = (isMobile: boolean) => {
    // Sin bounds (colección sin faceta `price`, catálogo vacío o un solo precio)
    // no hay slider posible: el track tendría ancho cero.
    if (!priceRange) return null
    const minFraction = logPriceToFraction(
      localPriceRange[0],
      priceRange.min,
      priceRange.max,
    )
    const maxFraction = logPriceToFraction(
      localPriceRange[1],
      priceRange.min,
      priceRange.max,
    )
    const leftPercent = minFraction * 100
    const rightPercent = maxFraction * 100

    return (
      <FilterAccordion
        isMobile={isMobile}
        sectionKey='price-filter'
        title='Precio'
      >
        <div className='space-y-3 px-1'>
          {pricePresets.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {pricePresets.map((preset, index) => (
                <button
                  aria-pressed={activePresetIndex === index}
                  className={`rounded-full border px-2.5 py-1 font-medium text-[11px] transition-colors ${
                    activePresetIndex === index
                      ? 'border-[--primary-color] bg-[--primary-color] text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-[--primary-color] hover:text-[--primary-color]'
                  }`}
                  key={preset.label}
                  onClick={() => handlePricePresetClick(index)}
                  type='button'
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          <div className='relative h-6'>
            {/* Track background */}
            <div className='-translate-y-1/2 absolute top-1/2 right-0 left-0 h-1 rounded-full bg-gray-200' />
            {/* Active track */}
            <div
              className='-translate-y-1/2 absolute top-1/2 h-1 rounded-full bg-[--primary-color]'
              style={{
                left: `${leftPercent}%`,
                right: `${100 - rightPercent}%`,
              }}
            />
            <input
              className='pointer-events-none absolute inset-0 w-full [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:z-10 [&::-moz-range-thumb]:h-[16px] [&::-moz-range-thumb]:w-[16px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[--primary-color] [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-[4px] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10 [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-[16px] [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[--primary-color] [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md'
              max={PRICE_SLIDER_STEPS}
              min={0}
              onChange={(e) => handlePriceSliderChange(e, 'min')}
              step={1}
              style={{ WebkitAppearance: 'none', background: 'transparent' }}
              type='range'
              value={Math.round(minFraction * PRICE_SLIDER_STEPS)}
            />
            <input
              className='pointer-events-none absolute inset-0 w-full [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:relative [&::-moz-range-thumb]:z-20 [&::-moz-range-thumb]:h-[16px] [&::-moz-range-thumb]:w-[16px] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[--primary-color] [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-solid [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-[4px] [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20 [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-[16px] [&::-webkit-slider-thumb]:w-[16px] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[--primary-color] [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md'
              max={PRICE_SLIDER_STEPS}
              min={0}
              onChange={(e) => handlePriceSliderChange(e, 'max')}
              step={1}
              style={{ WebkitAppearance: 'none', background: 'transparent' }}
              type='range'
              value={Math.round(maxFraction * PRICE_SLIDER_STEPS)}
            />
          </div>
          <div className='-mt-1 flex justify-between text-[10px] text-gray-400 tabular-nums'>
            {priceScaleTicks.map((tick, index) => (
              <span key={`${index}-${tick}`}>{tick}</span>
            ))}
          </div>
          <div className='flex items-center gap-2'>
            <label className='flex-1'>
              <span className='mb-1 block text-[10px] text-gray-400'>Mín</span>
              <input
                className='w-full rounded-md border border-gray-200 px-2 py-1.5 text-center text-gray-700 text-xs focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]'
                inputMode='numeric'
                onBlur={() => commitPriceRange('min')}
                onChange={(e) => handlePriceInputChange(e.target.value, 'min')}
                onFocus={(e) => {
                  e.target.select()
                  setPriceInputFocused('min')
                }}
                onKeyDown={handlePriceInputKeyDown}
                type='text'
                value={
                  priceInputFocused === 'min'
                    ? priceInputText.min
                    : `$ ${localPriceRange[0].toLocaleString('es-AR')}`
                }
              />
            </label>
            <span className='mt-4 text-gray-300'>—</span>
            <label className='flex-1'>
              <span className='mb-1 block text-[10px] text-gray-400'>Máx</span>
              <input
                className='w-full rounded-md border border-gray-200 px-2 py-1.5 text-center text-gray-700 text-xs focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color]'
                inputMode='numeric'
                onBlur={() => commitPriceRange('max')}
                onChange={(e) => handlePriceInputChange(e.target.value, 'max')}
                onFocus={(e) => {
                  e.target.select()
                  setPriceInputFocused('max')
                }}
                onKeyDown={handlePriceInputKeyDown}
                type='text'
                value={
                  priceInputFocused === 'max'
                    ? priceInputText.max
                    : `$ ${localPriceRange[1].toLocaleString('es-AR')}`
                }
              />
            </label>
          </div>
        </div>
      </FilterAccordion>
    )
  }

  // Skeleton for filters while loading
  const hasAnyFilter =
    filters.length > 0 ||
    rootCategories.length > 0 ||
    categoryCounts.byName.size > 0

  const renderFiltersSkeleton = () => (
    <div className='animate-pulse space-y-5'>
      {[1, 2, 3, 4].map((i) => (
        <div className='border-gray-200 border-b pb-4' key={i}>
          <div className='mb-3 h-4 w-24 rounded bg-gray-200' />
          <div className='space-y-2'>
            {[1, 2, 3].map((j) => (
              <div
                className='h-3 rounded bg-gray-100'
                key={j}
                style={{ width: `${70 - j * 10}%` }}
              />
            ))}
          </div>
        </div>
      ))}
      {/* Price skeleton */}
      <div className='pb-4'>
        <div className='mb-3 h-4 w-16 rounded bg-gray-200' />
        <div className='mb-2 h-1 w-full rounded-full bg-gray-200' />
        <div className='flex justify-between'>
          <div className='h-8 w-20 rounded-md bg-gray-100' />
          <div className='h-8 w-20 rounded-md bg-gray-100' />
        </div>
      </div>
    </div>
  )

  // Render all filters (reusable for sidebar and mobile)
  const renderAllFilters = (isMobile: boolean) => (
    <>
      {/* Skeleton while loading */}
      {!hasAnyFilter && isLoading && renderFiltersSkeleton()}

      {/* Active filter chips - sticky at top so they stay visible while scrolling.
          On desktop, the parent sidebar drops its pt-5 when active filters exist,
          so this bar sits flush at the top with its own pt-5 for inner spacing. */}
      {hasActiveFilters && (
        <StickyActiveFilters isMobile={isMobile}>
          <div className='mb-3 flex items-center justify-between'>
            {/* h2, no h3: es la primera sección del listado y viene inmediatamente después del
                h1 de la página, así que en h3 dejaba un salto h1→h3. Sólo se renderiza con
                filtros activos, o sea en las 22 URLs de faceta de la auditoría del 19/08. */}
            <h2 className='font-semibold text-gray-900 text-sm'>
              Filtros Activos
            </h2>
            {/* En mobile el botón "Borrar filtros" del footer ya cubre esto;
                evitamos el duplicado. Solo se muestra en desktop. */}
            {!isMobile && (
              <button
                className='flex items-center gap-1 text-gray-500 text-xs transition-colors hover:text-gray-900'
                onClick={clearAllFilters}
                type='button'
              >
                <XMarkIcon className='size-3' />
                Limpiar todo
              </button>
            )}
          </div>
          <div className='flex flex-wrap gap-1'>
            <AnimatePresence>
              {q && (
                <FilterChip
                  filterType='search'
                  isSportsTemplate={isSportsTemplate}
                  key={`search-${q}`}
                  label={q}
                  onRemove={handleClearSearch}
                />
              )}
              {selectedCategoryNames.map((name) => (
                <FilterChip
                  filterType='category'
                  isSportsTemplate={isSportsTemplate}
                  key={`cat-${name}`}
                  label={getCategoryDisplayName(name)}
                  onRemove={() => handleCategoryToggle(name)}
                />
              ))}
              {collection && (
                <FilterChip
                  filterType='collection'
                  isSportsTemplate={isSportsTemplate}
                  key={`col-${collection}`}
                  label={toDisplayCase(collection)}
                  onRemove={() => handleFilterChange('collection', collection)}
                />
              )}
              {brand && (
                <FilterChip
                  filterType='brand'
                  isSportsTemplate={isSportsTemplate}
                  key={`brand-${brand}`}
                  label={toDisplayCase(brand)}
                  onRemove={() => handleFilterChange('brand', brand)}
                />
              )}
              {tag && (
                <FilterChip
                  filterType='tag'
                  isSportsTemplate={isSportsTemplate}
                  key={`tag-${tag}`}
                  label={toDisplayCase(tag)}
                  onRemove={() => handleFilterChange('tag', tag)}
                />
              )}
              {selectedTags.map((t) => (
                <FilterChip
                  filterType='tag'
                  isSportsTemplate={isSportsTemplate}
                  key={`tags-${t}`}
                  label={t}
                  onRemove={() => handleTagToggle(t)}
                />
              ))}
              {promotion && (
                <FilterChip
                  filterType='promotion'
                  isSportsTemplate={isSportsTemplate}
                  key={`promo-${promotion}`}
                  label={toDisplayCase(promotion)}
                  onRemove={() => handleFilterChange('promotion', promotion)}
                />
              )}
              {fragancia && (
                <FilterChip
                  filterType='fragancia'
                  isSportsTemplate={isSportsTemplate}
                  key={`fragancia-${fragancia}`}
                  label={toDisplayCase(fragancia)}
                  onRemove={() => handleFilterChange('fragancia', fragancia)}
                />
              )}
              {sugerenciaUso && (
                <FilterChip
                  filterType='sugerenciaUso'
                  isSportsTemplate={isSportsTemplate}
                  key={`sugerenciaUso-${sugerenciaUso}`}
                  label={toDisplayCase(sugerenciaUso)}
                  onRemove={() =>
                    handleFilterChange('sugerenciaUso', sugerenciaUso)
                  }
                />
              )}
              {familiaOlfativa && (
                <FilterChip
                  filterType='familiaOlfativa'
                  isSportsTemplate={isSportsTemplate}
                  key={`familiaOlfativa-${familiaOlfativa}`}
                  label={toDisplayCase(familiaOlfativa)}
                  onRemove={() =>
                    handleFilterChange('familiaOlfativa', familiaOlfativa)
                  }
                />
              )}
              {familia && (
                <FilterChip
                  filterType='familia'
                  isSportsTemplate={isSportsTemplate}
                  key={`familia-${familia}`}
                  label={toDisplayCase(familia)}
                  onRemove={() => handleFilterChange('familia', familia)}
                />
              )}
              {activeAdvisorFilters.map(([id, value]) => (
                <FilterChip
                  filterType={id}
                  isSportsTemplate={isSportsTemplate}
                  key={`${id}-${value}`}
                  label={getFilterValueLabel(id, value)}
                  onRemove={() => handleFilterChange(id, value)}
                />
              ))}
              {(priceMin != null || priceMax != null) && (
                <FilterChip
                  filterType='price'
                  isSportsTemplate={isSportsTemplate}
                  key='price'
                  label={`${formatPriceFilter(priceMin ?? priceRange?.min ?? 0)} - ${formatPriceFilter(priceMax ?? priceRange?.max ?? 0)}`}
                  onRemove={handleClearPriceFilter}
                />
              )}
            </AnimatePresence>
          </div>
        </StickyActiveFilters>
      )}

      {/* Push first filter section down 10px when active-filters bar is shown,
          so it doesn't sit flush against the sticky chip strip while scrolling. */}
      <div className={hasActiveFilters ? 'mt-2.5' : ''}>
        {/* Promociones arranca desplegada también en mobile (openOnMobile). */}
        {promotionFilter &&
          renderFilterSection(promotionFilter, isMobile, true, true)}
        {collectionsFilter && renderFilterSection(collectionsFilter, isMobile)}
        {brandsFilter && renderFilterSection(brandsFilter, isMobile)}
        {familiaFilter && renderFilterSection(familiaFilter, isMobile)}
        {renderCategorySection(isMobile, otherFilters.length === 0)}
        {renderPriceFilter(isMobile)}
        {/* {tagsFilter && renderTagsPillSection(tagsFilter, isMobile)} */}
        {otherFilters.map((section, idx) =>
          renderFilterSection(
            section,
            isMobile,
            idx === otherFilters.length - 1,
          ),
        )}
      </div>
    </>
  )

  return (
    <div className='store-template-page bg-white'>
      {/* Mobile filters drawer. Uses Framer Motion (matches wishlist drawer)
          because Tailwind 3 here has no `data-closed:` variant configured —
          Headless UI's transition prop wouldn't animate. */}
      <AnimatePresence>
        {isMobileFiltersOpen && (
          <Dialog
            className='relative z-[9999] lg:hidden'
            onClose={closeMobileFilters}
            open={isMobileFiltersOpen}
          >
            <motion.div
              animate={{ opacity: 1 }}
              className='fixed inset-0 bg-black/30'
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <div className='fixed inset-0 z-[9999] flex items-end'>
              <DialogPanel
                as='div'
                className='pointer-events-auto w-full'
              >
                <motion.div
                  animate={{ y: 0 }}
                  className={cn(
                    'flex max-h-[85vh] flex-col overflow-hidden bg-white',
                    isSportsTemplate
                      ? 'rounded-none border-[--sp-ink] border-t-2 shadow-none'
                      : 'rounded-t-2xl shadow-xl',
                  )}
                  data-mobile-filter-panel
                  exit={{ y: '100%' }}
                  initial={{ y: '100%' }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >
                  {/* Drag handle + header */}
                  <div className='shrink-0'>
                    <div className='flex justify-center pt-2.5 pb-1'>
                      <span
                        className={cn(
                          'h-1.5 w-10 bg-gray-300',
                          isSportsTemplate ? 'rounded-none' : 'rounded-full',
                        )}
                      />
                    </div>
                    <div className='flex items-center justify-between px-4 pt-1 pb-3'>
                      <h2 className='font-semibold text-gray-900 text-lg'>
                        Filtros
                      </h2>
                      <button
                        className={cn(
                          '-mr-2 flex size-10 items-center justify-center bg-white p-2 text-gray-400',
                          isSportsTemplate ? 'rounded-none' : 'rounded-md',
                        )}
                        onClick={closeMobileFilters}
                        type='button'
                      >
                        <span className='sr-only'>Cerrar menú</span>
                        <XMarkIcon aria-hidden='true' className='size-6' />
                      </button>
                    </div>
                  </div>

                  <div className='flex-1 overflow-y-auto overscroll-contain'>
                    {renderAllFilters(true)}
                  </div>

                  {/* Sticky footer (matches the reference layout) */}
                  <div
                    className='shrink-0 space-y-2 border-gray-100 border-t px-4 pt-3'
                    style={{
                      paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
                    }}
                  >
                    <button
                      className={cn(
                        'w-full bg-[--primary-color] py-3 text-center font-semibold text-sm text-white transition hover:opacity-90',
                        isSportsTemplate ? 'rounded-none uppercase tracking-[0.06em]' : 'rounded-full',
                      )}
                      onClick={closeMobileFilters}
                      type='button'
                    >
                      Mostrar {formattedFound} {found === 1 ? 'producto' : 'productos'}
                    </button>
                    <button
                      className={cn(
                        'w-full border border-gray-300 py-3 text-center font-semibold text-gray-700 text-sm transition hover:bg-gray-50 disabled:opacity-50',
                        isSportsTemplate ? 'rounded-none uppercase tracking-[0.06em]' : 'rounded-full',
                      )}
                      disabled={!hasActiveFilters}
                      onClick={clearAllFilters}
                      type='button'
                    >
                      Borrar filtros
                    </button>
                  </div>
                </motion.div>
              </DialogPanel>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Bottom sheet de ORDEN (mobile) — se despliega desde abajo, igual que
          filtros. Marca con check el orden elegido. */}
      <AnimatePresence>
        {isMobileSortOpen && (
          <Dialog
            className='relative z-[9999] lg:hidden'
            onClose={() => setIsMobileSortOpen(false)}
            open={isMobileSortOpen}
          >
            <motion.div
              animate={{ opacity: 1 }}
              className='fixed inset-0 bg-black/30'
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <div className='fixed inset-0 z-[9999] flex items-end'>
              <DialogPanel as='div' className='pointer-events-auto w-full'>
                <motion.div
                  animate={{ y: 0 }}
                  className={cn(
                    'flex max-h-[85vh] flex-col overflow-hidden bg-white',
                    isSportsTemplate
                      ? 'rounded-none border-[--sp-ink] border-t-2 shadow-none'
                      : 'rounded-t-2xl shadow-xl',
                  )}
                  data-mobile-sort-panel
                  exit={{ y: '100%' }}
                  initial={{ y: '100%' }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className='shrink-0'>
                    <div className='flex justify-center pt-2.5 pb-1'>
                      <span
                        className={cn(
                          'h-1.5 w-10 bg-gray-300',
                          isSportsTemplate ? 'rounded-none' : 'rounded-full',
                        )}
                      />
                    </div>
                    <div className='flex items-center justify-between px-4 pt-1 pb-2'>
                      <h2 className='font-semibold text-gray-900 text-lg'>
                        Ordenar por
                      </h2>
                      <button
                        className={cn(
                          '-mr-2 flex size-10 items-center justify-center bg-white p-2 text-gray-400',
                          isSportsTemplate ? 'rounded-none' : 'rounded-md',
                        )}
                        onClick={() => setIsMobileSortOpen(false)}
                        type='button'
                      >
                        <span className='sr-only'>Cerrar</span>
                        <XMarkIcon aria-hidden='true' className='size-6' />
                      </button>
                    </div>
                  </div>
                  <div
                    className='flex-1 overflow-y-auto overscroll-contain pb-[max(0.5rem,env(safe-area-inset-bottom))]'
                  >
                    {MOBILE_SORT_OPTIONS.map((opt) => {
                      const active = (sortBy as SortOptions) === opt.value
                      return (
                        <button
                          className={`flex w-full items-center justify-between border-gray-100 border-b px-4 py-3.5 text-left transition-colors last:border-b-0 ${
                            active
                              ? 'bg-[color-mix(in_srgb,var(--primary-color)_10%,white)]'
                              : ''
                          }`}
                          key={opt.value}
                          onClick={() => {
                            handleSortChange('sortBy', opt.value)
                            setIsMobileSortOpen(false)
                          }}
                          type='button'
                        >
                          <span
                            className={
                              active
                                ? 'font-bold text-[--primary-color] text-sm'
                                : 'text-gray-700 text-sm'
                            }
                          >
                            {opt.label}
                          </span>
                          {active && (
                            <CheckIcon className='size-5 text-[--primary-color]' />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              </DialogPanel>
            </div>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Barra flotante (mobile): Filtrar / Ordenar. Cada botón abre su bottom
          sheet; "Ordenar" muestra el orden elegido para que siempre sea visible.
          Se ubica por encima del bottom-nav (64px + safe-area) con holgura para
          que no se pise con la navegación. */}
      <div
        className='fixed inset-x-0 z-40 flex justify-center px-4 lg:hidden'
        style={{
          bottom: usesCustomTemplate
            ? 'calc(1rem + env(safe-area-inset-bottom))'
            : 'calc(5.75rem + env(safe-area-inset-bottom))',
        }}
      >
        <div
          className={cn(
            'pointer-events-auto flex items-stretch overflow-hidden bg-[--primary-color] text-white',
            isSportsTemplate ? 'rounded-none shadow-none' : 'rounded-full shadow-xl',
          )}
          data-mobile-filter-bar
        >
          <button
            className='flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-opacity active:opacity-80'
            onClick={openMobileFilters}
            type='button'
          >
            <AdjustmentsHorizontalIcon className='size-5' />
            Filtrar por
          </button>
          <span className='my-2 w-px bg-white/30' />
          <button
            className='flex items-center gap-2 px-5 py-3 text-sm transition-opacity active:opacity-80'
            onClick={() => setIsMobileSortOpen(true)}
            type='button'
          >
            <BarsArrowDownIcon className='size-5' />
            <span className='flex flex-col items-start leading-tight'>
              <span className='font-semibold'>Ordenar por</span>
              <span className='font-normal text-[11px] text-white/80'>
                {MOBILE_SORT_OPTIONS.find(
                  (o) => o.value === (sortBy as SortOptions),
                )?.label ?? 'Relevancia'}
              </span>
            </span>
          </button>
        </div>
      </div>

      <main
        className={cn(
          'mx-auto px-4',
          isSportsTemplate ? 'max-w-[1600px] sm:px-6 lg:px-10' : 'max-w-7xl lg:px-8',
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-6 pb-32 lg:flex-row lg:pb-6',
            isSportsTemplate ? 'pt-6 lg:gap-4' : 'pt-8 lg:gap-10',
          )}
        >
          {/* Sidebar - sticky with its own scroll */}
          <aside
            className={cn(
              'hidden lg:block lg:flex-shrink-0',
              isSportsTemplate ? 'lg:w-[260px] xl:w-[260px]' : 'lg:w-64 xl:w-72',
            )}
            style={{ minHeight: 1600 }}
          >
            <div
              className={cn(
                // max-h se calcula contra el peor caso (tope de la página con el
                // header completo visible: topbar + 2 filas de nav ≈ 9rem, más el
                // pt-8 del contenido). Si solo restáramos la altura del sticky
                // (top-24), el panel se desborda por debajo del viewport al inicio
                // y el scroll interno no alcanza a mostrar todos los filtros,
                // forzando a scrollear la página entera.
                'sticky top-24 max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain bg-white pb-5 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:rgba(0,0,0,0.2)_transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5',
                isSportsTemplate
                  ? 'rounded-none border-0 px-0 shadow-none'
                  : 'rounded-2xl border border-gray-100 px-5',
                hasActiveFilters ? 'pt-0' : 'pt-5',
              )}
            >
              {renderAllFilters(false)}
            </div>
          </aside>

          {/* Products section - NO overflow, uses page scroll */}
          <section
            aria-labelledby='product-heading'
            className='mt-0 min-w-0 flex-1 bg-white'
          >
            <h2 className='sr-only' id='product-heading'>
              Productos
            </h2>

            {/* Mobile: conteo de resultados (los controles viven en la barra
                flotante inferior — ver FloatingFilterSortBar abajo). */}
            <div className='mb-4 lg:hidden'>
              <p className='text-gray-500 text-sm'>
                <span className='font-semibold text-gray-900'>
                  {formattedFound}
                </span>{' '}
                productos
              </p>
            </div>

            {/* Desktop toolbar */}
            <div
              className={cn(
                'mb-6 hidden items-center justify-between gap-3 lg:flex',
                isSportsTemplate ? 'pb-2' : '',
              )}
            >
              <p
                className={cn(
                  'text-sm',
                  isSportsTemplate ? 'text-[--sp-muted]' : 'text-gray-500',
                )}
              >
                <span
                  className={cn(
                    'font-semibold',
                    isSportsTemplate ? 'text-[--sp-ink]' : 'text-gray-900',
                  )}
                >
                  {formattedFound}
                </span>{' '}
                productos
              </p>
              <div className='w-44'>
                <SortProducts
                  hideLabel
                  isSearching={Boolean(q)}
                  setQueryParams={handleSortChange}
                  sortBy={sortBy as SortOptions}
                />
              </div>
            </div>

            {/* Disney sub-brands */}
            {(collection === 'Disney' || brand === 'Disney') && (
              <div className='mb-6'>
                <div className='grid grid-cols-5 gap-3'>
                  {DISNEY_SUB_BRANDS.map((subBrand) => (
                    <button
                      className={cn(
                        'relative flex h-16 items-center justify-center rounded-2xl border transition-all hover:shadow-md',
                        selectedTags.includes(subBrand.tag)
                          ? 'border-[--primary-color] shadow-sm ring-1 ring-[--primary-color]'
                          : 'border-gray-200 bg-white',
                      )}
                      disabled={isPending}
                      key={subBrand.id}
                      onClick={() => handleTagToggle(subBrand.tag)}
                      type='button'
                    >
                      <div className='w-full h-full flex items-center justify-center'>
                        <img
                          src={subBrand.image}
                          alt={subBrand.label}
                          className='w-full h-full object-contain'
                        />
                      </div>
                      {selectedTags.includes(subBrand.tag) && (
                        <span className='absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[--primary-color] shadow-sm'>
                          <CheckIcon className='size-3 text-white' />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className='rounded-md bg-red-50 p-4 text-red-700 text-sm'>
                {error}
              </div>
            )}

            {isLoading && products.length === 0 && <SkeletonProductGrid />}

            {products.length > 0 && (
              <TypesenseProductGrid
                countryCode={countryCode}
                products={products}
              />
            )}

            {!isLoading && products.length === 0 && !error && (
              <div className='py-12 text-center'>
                {/* En un PLP faceteado, el cero-resultados más común NO es un
                    typo: es la query combinada con marca y rango de precio. El
                    conteo sin filtros ya viene en la respuesta (la query de
                    universo de facetas), así que ofrecer la salida no cuesta un
                    request extra — y evita el callejón sin salida de antes. */}
                {hasActiveFilters && unfilteredFound && unfilteredFound > 0 ? (
                  <>
                    <p className='text-gray-500'>
                      {q
                        ? `Sin resultados para «${q}» con estos filtros`
                        : 'Sin resultados con estos filtros'}
                    </p>
                    <button
                      className='mt-4 text-[--primary-color] underline'
                      onClick={clearAllFilters}
                      type='button'
                    >
                      Ver{' '}
                      {new Intl.NumberFormat('es-AR').format(unfilteredFound)}{' '}
                      {unfilteredFound === 1 ? 'producto' : 'productos'} sin
                      filtros
                    </button>
                  </>
                ) : (
                  <>
                    <p className='text-gray-500'>
                      {q
                        ? `No encontramos productos para «${q}»`
                        : 'No se encontraron productos'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        className='mt-4 text-[--primary-color] underline'
                        onClick={clearAllFilters}
                        type='button'
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* `products.length === 0` deja el centinela afuera durante la
                carga inicial y los cambios de filtro: ahí manda el skeleton de
                pantalla completa de arriba, y si no se verían los dos. */}
            <InfiniteScrollSentinel
              disabled={products.length === 0 || page >= totalPages}
              isLoading={isLoading}
              onIntersect={loadMore}
              rootMargin='0px 0px 400px 0px'
            >
              <ProductGridSkeleton
                variant={isSportsTemplate ? 'sports' : 'default'}
              />
            </InfiniteScrollSentinel>
          </section>
        </div>
      </main>
    </div>
  )
}
