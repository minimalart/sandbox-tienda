'use client'

import type { ComponentProps } from 'react'
import { usePathname } from 'next/navigation'
import type { NavigationLink } from '@lib/data/navigation-links'
import { useDemoHref, useTenantSections } from '@lib/site-config/context'
import LocalizedClientLink from '@modules/common/components/localized-client-link'

const ExternalArrow = () => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 10 10'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    className='ml-1 inline-block h-3 w-3 align-middle'
    aria-hidden='true'
  >
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      d='M1.5 8.5L8.5 1.5M3.5 1.5H8.5V6.5'
    />
  </svg>
)

type Props = {
  links: NavigationLink[]
  /** Relabela el link `/blog` con el nombre de sección de la demo. */
  relabelBlog?: boolean
} & Pick<ComponentProps<'ul'>, never>

/**
 * Lista de links del footer (client): usa `LocalizedClientLink` para mantener el
 * prefijo `/demo/{slug}` dentro de una demo, resalta el link de la página activa
 * en el color primario (no solo en hover), y relabela la sección de blog con el
 * override por demo. Renderiza `<li>` sueltos; el `<ul>` lo pone el footer.
 */
export default function FooterLinkList({ links, relabelBlog = false }: Props) {
  const pathname = usePathname() || '/'
  const toHref = useDemoHref()
  const {
    blogSectionName,
    isBlogVisible,
    isContactVisible,
    isSucursalesVisible,
    isCorporateVisible,
  } = useTenantSections()

  // Respetar los toggles de sección por demo: si una sección está oculta en el
  // nav, tampoco se muestra su link en el footer (misma regla que el header).
  const visibleLinks = links.filter((item) => {
    if (item.href === '/blog') return isBlogVisible
    if (item.href === '/contact') return isContactVisible
    if (item.href === '/sucursales') return isSucursalesVisible
    if (item.href === '/corporate/register') return isCorporateVisible
    return true
  })

  return (
    <>
      {visibleLinks.map((item) => {
        const label =
          relabelBlog && item.href === '/blog' && blogSectionName
            ? blogSectionName
            : item.name
        // href ya resuelto con el prefijo de demo (igual que LocalizedClientLink),
        // para comparar contra el pathname del browser y detectar el activo.
        const target = toHref(item.href)
        const isActive =
          !item.external &&
          (pathname === target ||
            (item.href !== '/' && pathname.startsWith(`${target}/`)))
        const className = `inline-flex items-center text-sm ${
          isActive
            ? 'font-medium text-[--primary-color]'
            : 'text-gray-600 hover:text-[--primary-color] dark:text-gray-400'
        }`

        return (
          <li key={item.name}>
            {item.external ? (
              <a
                className={className}
                href={item.href}
                target={item.target ?? '_blank'}
                rel='noopener noreferrer'
              >
                {label}
                <ExternalArrow />
              </a>
            ) : (
              <LocalizedClientLink
                className={className}
                href={item.href}
                target={item.target}
              >
                {label}
              </LocalizedClientLink>
            )}
          </li>
        )
      })}
    </>
  )
}
