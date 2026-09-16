'use client'

import {
  ArrowLeftOnRectangleIcon,
  ChatBubbleOvalLeftIcon,
  ChevronRightIcon,
  GiftIcon,
  HeartIcon,
  MapIcon,
  MapPinIcon,
  NewspaperIcon,
  ShoppingBagIcon,
  SwatchIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useHasActivePromotions } from '@lib/context/promotions-availability'
import { DEFAULT_LEGAL_LINKS } from '@lib/data/navigation-links'
import { useAuth } from '@lib/hooks/use-auth'
import { useScrollLock } from '@lib/hooks/use-scroll-lock'
import { useTenant, useTenantBrand, useTenantSections } from '@lib/site-config/context'
import { getCustomerAvatar } from '@lib/util/customer-avatar'
import type { HttpTypes } from '@medusajs/types'
import LocalizedClientLink from '@modules/common/components/localized-client-link'
import UserAvatar from '@modules/common/components/user-avatar'
import { useRouter } from 'next/navigation'
import { cloneElement, useEffect, useState } from 'react'
import type React from 'react'

type MobileMenuProps = {
  open: boolean
  onClose: () => void
  customer?: HttpTypes.StoreCustomer | null
  /** Tintométrico prendido y con carta cargada: lo resuelve el layout. */
  hasTinting?: boolean
  hasSpaceDesigner?: boolean
}

const MobileMenu = ({ open, onClose, customer, hasTinting = false, hasSpaceDesigner = false }: MobileMenuProps) => {
  const router = useRouter()
  const { logout, isLoading: isLoggingOut } = useAuth()
  const { logos, name } = useTenantBrand()
  const tenant = useTenant()
  const {
    blogSectionName,
    isBlogVisible,
    isContactVisible,
    isSucursalesVisible,
    isTintingHidden,
  } = useTenantSections()
  const legalLinks = tenant.assets.footer?.legal?.length
    ? tenant.assets.footer.legal
    : DEFAULT_LEGAL_LINKS
  const [visible, setVisible] = useState(false)
  const { avatarUrl, initials } = getCustomerAvatar(customer)
  const hasActivePromotions = useHasActivePromotions()

  // La direccion de envio del cliente: la marcada por defecto y, si no hay
  // ninguna marcada, la primera que tenga cargada. Sin direcciones el link
  // invita a agregar una en vez de mentir un destino.
  const shippingAddress =
    customer?.addresses?.find((address) => address.is_default_shipping) ??
    customer?.addresses?.[0]
  // address_1 y city son nullable: si no queda nada legible, mejor invitar a
  // completarla que mostrar un "Enviar a" pelado.
  const shippingSummary = [shippingAddress?.address_1, shippingAddress?.city]
    .filter(Boolean)
    .join(', ')
  const shippingLabel = shippingSummary
    ? `Enviar a ${shippingSummary}`
    : 'Agregar una dirección de envío'

  // Bloqueo de scroll del fondo mientras el drawer está abierto (ver hook).
  useScrollLock(open)

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [open])

  const closePanel = () => setVisible(false)

  const handleTransitionEnd = () => {
    if (!visible) onClose()
  }

  const handleLogout = async () => {
    const ok = await logout()
    if (ok) {
      closePanel()
      router.refresh()
    }
  }

  if (!open && !visible) return null

  return (
    <div className='fixed inset-0 z-[9998] lg:hidden'>
      <button
        aria-label='Cerrar menu'
        className='absolute inset-0 cursor-modal-close bg-black/65 transition-opacity duration-300'
        onClick={closePanel}
        style={{ opacity: visible ? 1 : 0 }}
        type='button'
      />

      <div
        className='relative z-10 flex h-full w-full flex-col overflow-y-auto overscroll-contain bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform'
        onTransitionEnd={handleTransitionEnd}
        style={{ transform: visible ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <div className='flex items-center justify-between px-5 pb-3 pt-7'>
          <LocalizedClientLink href='/' onClick={closePanel}>
            <span className='sr-only'>{name}</span>
            {/* El panel es blanco: va el logo positivo (como el nav), no la
                variante mobile que está pensada para el header con fondo. */}
            {/*
              Preserva aspect ratio para logos horizontales anchos: antes era
              `h-10 w-auto max-w-[180px]` — con logos 5:1 o más el max-w
              capaba el width sin ajustar el height, dejando la imagen
              comprimida. Ahora `object-contain` respeta el ratio dentro del
              max-h × max-w, y el max-w sube a 250px para no forzar logos
              horizontales a 180px.
            */}
            <img
              alt={`${name} Logo`}
              className='h-auto max-h-10 w-auto max-w-[250px] object-contain'
              src={logos.main || logos.mobile || '/logos-mercatto/logocompleto-verde.svg'}
            />
          </LocalizedClientLink>
          <button
            aria-label='Cerrar menu'
            className='flex h-10 w-10 items-center justify-center rounded-full text-[--primary-color] transition hover:bg-[--primary-color]/10'
            onClick={closePanel}
            type='button'
          >
            <XMarkIcon className='h-6 w-6' />
          </button>
        </div>

        <div className='px-5 pb-5'>
          {customer ? (
            <LocalizedClientLink
              className='flex items-center gap-4 rounded-2xl bg-[--primary-color] p-4 text-white'
              href='/account'
              onClick={closePanel}
            >
              <UserAvatar
                alt={`Foto de ${customer.first_name ?? 'perfil'}`}
                avatarUrl={avatarUrl}
                className='bg-white text-[--primary-color]'
                initials={initials}
                size={56}
              />
              <span className='min-w-0'>
                <span className='block truncate text-lg font-bold'>
                  {customer.first_name || customer.email || 'Mi cuenta'}
                </span>
                {customer.email && (
                  <span className='block truncate text-sm text-white/75'>
                    {customer.email}
                  </span>
                )}
              </span>
            </LocalizedClientLink>
          ) : (
            <div className='rounded-2xl bg-[--primary-color] p-4 text-white'>
              <div className='flex items-center gap-4'>
                <span className='flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/95 text-[--primary-color]'>
                  <UserIcon className='h-7 w-7' />
                </span>
                <span>
                  <span className='block text-2xl font-bold'>Hola!</span>
                  <span className='block max-w-[210px] text-sm leading-snug text-white/75'>
                    Ingresá para ver tus pedidos y beneficios
                  </span>
                </span>
              </div>
              <div className='mt-5 flex gap-3'>
                <LocalizedClientLink
                  className='inline-flex h-10 flex-1 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-[--primary-color]'
                  href='/account'
                  onClick={closePanel}
                >
                  Iniciar sesión
                </LocalizedClientLink>
                <LocalizedClientLink
                  className='inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white px-4 text-sm font-semibold text-white'
                  href='/account?view=register'
                  onClick={closePanel}
                >
                  Registrarme
                </LocalizedClientLink>
              </div>
            </div>
          )}

          {customer && (
            <>
              <LocalizedClientLink
                className='mt-4 flex min-h-[48px] items-center gap-3 text-sm font-semibold text-gray-600'
                href='/account/addresses'
                onClick={closePanel}
              >
                <MapPinIcon className='h-6 w-6 shrink-0 text-[--primary-color]' />
                <span className='truncate'>{shippingLabel}</span>
              </LocalizedClientLink>

              <div className='mt-5'>
                <p className='mb-3 text-xs font-bold uppercase tracking-wide text-gray-500'>
                  Mis atajos
                </p>
                <div className='grid grid-cols-4 gap-3 text-center'>
                  <Shortcut href='/account' icon={<UserIcon />} label='Mi perfil' onClick={closePanel} />
                  <Shortcut href='/account/orders' icon={<ShoppingBagIcon />} label='Pedidos' onClick={closePanel} />
                  <Shortcut href='/account/addresses' icon={<MapPinIcon />} label='Direcciones' onClick={closePanel} />
                  <Shortcut href='/account/wishlist' icon={<HeartIcon />} label='Favoritos' onClick={closePanel} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className='border-t border-gray-100'>
          {isSucursalesVisible && (
            <MenuRow
              description='Encontrá tu tienda más cercana'
              href='/sucursales'
              icon={<MapIcon />}
              label='Sucursales'
              onClick={closePanel}
            />
          )}
          {/* La sección se renombra por demo (Recetas, Blog, Notas...), así que
              la bajada y el icono tienen que servir para cualquiera. */}
          {isBlogVisible && (
            <MenuRow
              description='Notas, ideas y consejos'
              href='/blog'
              icon={<NewspaperIcon />}
              label={blogSectionName || 'Recetas'}
              onClick={closePanel}
            />
          )}
          {/* OPT-IN, igual que en el nav: sólo donde el tintométrico está
              prendido y con carta cargada. El flag del demo sirve para
              esconderlo, no para prenderlo. */}
          {hasSpaceDesigner && (
            <MenuRow
              description='Elegí un espacio equipado y personalizalo'
              href='/espacios'
              icon={<MapIcon />}
              label='Diseñá tu espacio'
              onClick={closePanel}
            />
          )}
          {hasTinting && !isTintingHidden && (
            <MenuRow
              description='Elegí un color y te decimos con qué se logra'
              href='/colores'
              icon={<SwatchIcon />}
              label='Buscá tu color'
              onClick={closePanel}
            />
          )}
        </div>

        {/* Sin promociones activas en el canal el acceso no se muestra: la PLP
            filtrada (?promos=1) saldría vacía. */}
        {hasActivePromotions && (
          <div className='px-5 py-5'>
            <LocalizedClientLink
              // Mismo color configurable que el boton "Promociones" del header
              // (`--promo-button-bg`); sin configurar conserva el acento de siempre.
              className='relative flex min-h-[110px] flex-col justify-center overflow-hidden rounded-2xl bg-[var(--promo-button-bg,var(--accent-color,#f97316))] px-5 text-[var(--promo-button-fg,#fff)]'
              href='/store?promos=1'
              onClick={closePanel}
            >
              <GiftIcon className='absolute -right-4 -top-4 h-24 w-24 opacity-20' />
              <span className='relative text-lg font-bold'>Aprovecha tus beneficios</span>
              <span className='relative mt-1 text-sm opacity-90'>
                Descuentos y promociones exclusivas
              </span>
              <span className='relative mt-4 inline-flex h-8 w-fit items-center rounded-full bg-white px-4 text-sm font-bold text-[var(--promo-button-bg,var(--accent-color,#f97316))]'>
                Ver más
                <ChevronRightIcon className='ml-1 h-4 w-4' />
              </span>
            </LocalizedClientLink>
          </div>
        )}

        {isContactVisible && (
          <div className='border-t border-gray-100'>
            <LocalizedClientLink
              className='flex min-h-[68px] items-center gap-4 px-5 text-gray-900'
              href='/contact'
              onClick={closePanel}
            >
              <ChatBubbleOvalLeftIcon className='h-6 w-6 shrink-0' />
              <span className='flex-1 font-medium'>Contacto</span>
              <ChevronRightIcon className='h-5 w-5 text-gray-500' />
            </LocalizedClientLink>
          </div>
        )}

        <div className='border-t border-gray-100 px-5 py-5'>
          <p className='mb-3 text-xs font-bold uppercase tracking-wide text-gray-500'>
            Legales
          </p>
          <div className='flex flex-col gap-3'>
            {legalLinks.map((item) => (
              <LocalizedClientLink
                className='text-sm text-gray-500'
                href={item.href}
                key={item.href}
                onClick={closePanel}
              >
                {item.name}
              </LocalizedClientLink>
            ))}
          </div>
        </div>

        {customer && (
          <div className='border-t border-gray-100 px-5 py-5'>
            <button
              className='flex items-center gap-3 text-sm font-semibold text-red-600 disabled:opacity-60'
              disabled={isLoggingOut}
              onClick={handleLogout}
              type='button'
            >
              <ArrowLeftOnRectangleIcon className='h-5 w-5' />
              {isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}
            </button>
          </div>
        )}

        <div className='mt-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-xs text-gray-900'>
          <span className='font-bold'>Minimalart</span>
          <span className='mx-1 text-gray-400'>|</span>
          <span>Evolution by design</span>
        </div>
      </div>
    </div>
  )
}

function Shortcut({
  href,
  icon,
  label,
  onClick,
}: {
  href: string
  icon: React.ReactElement<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <LocalizedClientLink className='min-w-0' href={href} onClick={onClick}>
      <span className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[--primary-color]/10 text-[--primary-color]'>
        {cloneElement(icon, { className: 'h-6 w-6' })}
      </span>
      <span className='mt-2 block truncate text-xs text-gray-600'>{label}</span>
    </LocalizedClientLink>
  )
}

function MenuRow({
  description,
  href,
  icon,
  label,
  onClick,
}: {
  description: string
  href: string
  icon: React.ReactElement<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <LocalizedClientLink
      className='flex min-h-[82px] items-center gap-4 border-b border-gray-100 px-5'
      href={href}
      onClick={onClick}
    >
      <span className='min-w-0 flex-1'>
        <span className='block text-lg font-semibold text-gray-950'>{label}</span>
        <span className='mt-1 block text-sm text-gray-500'>{description}</span>
      </span>
      <span className='flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[--primary-color]/10 text-[--primary-color]'>
        {cloneElement(icon, { className: 'h-7 w-7' })}
      </span>
      <ChevronRightIcon className='h-5 w-5 shrink-0 text-gray-500' />
    </LocalizedClientLink>
  )
}

export default MobileMenu
