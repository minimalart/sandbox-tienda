import { ConsentPreferencesLink } from '@lib/consent/context'
import type { ComponentProps } from 'react'
import { COMPANY_LINKS, DEFAULT_LEGAL_LINKS } from '@lib/data/navigation-links'
import { getActiveTenant } from '@lib/site-config/active-tenant'
import NewsletterForm from '@modules/layout/components/newsletter-form'
import FooterLinkList from './footer-link-list'

// Iconos SVG para redes sociales
const SocialIcons = {
  facebook: (props: ComponentProps<'svg'>) => (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='18'
      height='18'
      viewBox='0 0 18 18'
      fill='currentColor'
      {...props}
    >
      <path d='M10.5 10.125H12.375L13.125 7.125H10.5V5.625C10.5 4.8525 10.5 4.125 12 4.125H13.125V1.605C12.8805 1.57275 11.9572 1.5 10.9822 1.5C8.946 1.5 7.5 2.74275 7.5 5.025V7.125H5.25V10.125H7.5V16.5H10.5V10.125Z' />
    </svg>
  ),
  instagram: (props: ComponentProps<'svg'>) => (
    <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
      <path
        clipRule='evenodd'
        d='M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z'
        fillRule='evenodd'
      />
    </svg>
  ),
  twitter: (props: ComponentProps<'svg'>) => (
    <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
      <path d='M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84' />
    </svg>
  ),
  linkedin: (props: ComponentProps<'svg'>) => (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='18'
      height='18'
      viewBox='0 0 18 18'
      fill='currentColor'
      {...props}
    >
      <path d='M5.20313 3.75002C5.20293 4.14784 5.0447 4.52929 4.76326 4.81046C4.48181 5.09162 4.1002 5.24947 3.70238 5.24927C3.30455 5.24907 2.9231 5.09084 2.64193 4.8094C2.36077 4.52795 2.20293 4.14634 2.20313 3.74852C2.20332 3.35069 2.36155 2.96924 2.643 2.68808C2.92444 2.40691 3.30605 2.24907 3.70388 2.24927C4.1017 2.24947 4.48315 2.40769 4.76432 2.68914C5.04548 2.97058 5.20332 3.35219 5.20313 3.75002ZM5.24813 6.36002H2.24813V15.75H5.24813V6.36002ZM9.98813 6.36002H7.00313V15.75H9.95813V10.8225C9.95813 8.07752 13.5356 7.82252 13.5356 10.8225V15.75H16.4981V9.80252C16.4981 5.17502 11.2031 5.34752 9.95813 7.62002L9.98813 6.36002Z' />
    </svg>
  ),
  youtube: (props: ComponentProps<'svg'>) => (
    <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
      <path d='M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' />
    </svg>
  ),
  tiktok: (props: ComponentProps<'svg'>) => (
    <svg fill='currentColor' viewBox='0 0 24 24' {...props}>
      <path d='M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z' />
    </svg>
  ),
}

// Los legales reales salen de `footerConfig.legal` (site-config) o del fallback
// DEFAULT_LEGAL_LINKS; NO de acá. `brands` solo lo usa el bloque comentado de
// "Nuestras marcas". Ver navigation-links.ts para los hrefs de legales válidos.
const getFooterContent = () => ({
  brands: [
    { name: 'Indumentaria', href: '/categories/indumentaria' },
    { name: 'Calzado', href: '/categories/calzado' },
    { name: 'Accesorios', href: '/categories/accesorios' },
  ],
  company: COMPANY_LINKS,
})

export default async function Footer() {
  const tenant = await getActiveTenant()
  const footerLogo =
    tenant.assets.logos?.footer ||
    tenant.assets.logos?.main ||
    '/logos-mercatto/logocompleto-verde.svg'
  const footerConfig = tenant.assets.footer
  const footerContent = getFooterContent()

  /**
   * ─── NADA DE DATOS DE NEGOCIO INVENTADOS ──────────────────────────────────
   *
   * Acá había fallbacks hardcodeados con un teléfono que no existe
   * (`+54 11 1234-5678`), `hola@mercatto.com`, "Buenos Aires, Argentina" y una
   * descripción sobre FRAGANCIAS — en un footer que hoy usa, entre otras, una
   * pinturería. No era decorativo: el merge de `assets` es shallow POR CLAVE, así
   * que un guardado parcial del footer borraba `contact` y la página caía justo en
   * esos valores. O sea: editar una cosa publicaba un teléfono falso.
   *
   * La regla ahora es que un dato de negocio que no está NO SE INVENTA, se omite.
   * Un footer sin teléfono se ve incompleto, y eso es correcto — es la verdad. Un
   * footer con un teléfono falso se ve completo, y ahí es donde alguien llama.
   *
   * Lo que SÍ sobrevive como default son las etiquetas de interfaz (los textos del
   * newsletter) y los legales, porque no afirman nada sobre el negocio: son copy
   * de UI y rutas que existen en el propio sitio.
   */
  const description = footerConfig?.description
  const newsletter = footerConfig?.newsletter || {
    title: 'Newsletter',
    placeholder: 'ejemplo@correo.com',
    buttonText: 'Suscribirse',
  }
  const contact = footerConfig?.contact ?? {}
  const hasContact = Boolean(
    contact.phone || contact.email || contact.hours || contact.location,
  )
  const social = footerConfig?.social || []
  // Legales: los del tenant/demo si los configuró; si no, los default de Mercatto.
  const legal = footerConfig?.legal?.length ? footerConfig.legal : DEFAULT_LEGAL_LINKS
  /**
   * `{year}` se reemplaza al renderizar. Sin eso, el copyright de una tienda que
   * nadie tocó desde diciembre sigue diciendo el año pasado — y es el tipo de
   * detalle que un cliente sí mira.
   */
  const copyright = footerConfig?.copyright?.replace(
    '{year}',
    String(new Date().getFullYear()),
  )

  return (
    <footer className='border-gray-200 border-t bg-[color:var(--footer-bg,#f9fafb)] dark:bg-[color:var(--footer-bg,#111827)]'>
      <div className='mx-auto max-w-7xl px-6 pt-12 pb-8 sm:pt-16 lg:px-8 lg:pt-20 lg:pb-20'>
        <div className='hidden lg:grid lg:grid-cols-[26%_74%] lg:gap-10'>
          <div className='space-y-6'>
            <img
              alt={tenant.name}
              className='max-h-[35px] md:max-h-[40px]'
              src={footerLogo}
            />
            {description && (
              <p className='text-gray-600 text-sm leading-relaxed dark:text-gray-400'>
                {description}
              </p>
            )}
            {newsletter && (
              <div>
                <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                  {newsletter.title}
                </h2>
                <div className='mt-3'>
                  <NewsletterForm
                    placeholder={newsletter.placeholder}
                    buttonText={newsletter.buttonText}
                    variant='desktop'
                  />
                </div>
              </div>
            )}
            {social.length > 0 && (
              <div className='flex gap-4'>
                {social.map((item) => {
                  const IconComponent = item.icon
                    ? SocialIcons[item.icon]
                    : null
                  if (!IconComponent) return null

                  return (
                    <a
                      className='flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-gray-600 transition-colors duration-200 hover:border-[--primary-color] hover:bg-[--primary-color] hover:text-white dark:text-gray-400'
                      href={item.href}
                      key={item.name}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <span className='sr-only'>{item.name}</span>
                      <IconComponent aria-hidden='true' className='h-5 w-5' />
                    </a>
                  )
                })}
              </div>
            )}
          </div>
          <div className='grid grid-cols-3 gap-8'>
            {/* Ver el guard equivalente del layout mobile para el porqué. */}
            {hasContact && (
              <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                Contacto
              </h2>
              <ul className='mt-6 space-y-3' role='list'>
                {contact.phone && (
                  <li>
                    <a
                      className='text-gray-600 text-sm hover:text-[--primary-color] dark:text-gray-400'
                      href={contact.phone.href}
                    >
                      <span className='font-medium'>
                        {contact.phone.label}:
                      </span>{' '}
                      {contact.phone.value}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a
                      className='text-gray-600 text-sm hover:text-[--primary-color] dark:text-gray-400'
                      href={contact.email.href}
                    >
                      <span className='font-medium'>
                        {contact.email.label}:
                      </span>{' '}
                      {contact.email.value}
                    </a>
                  </li>
                )}
                {contact.hours && (
                  <li className='text-gray-600 text-sm dark:text-gray-400'>
                    <span className='font-medium'>
                      {contact.hours.label || 'Horario de atención'}:
                    </span>{' '}
                    {contact.hours.value}
                  </li>
                )}
                {contact.location && (
                  <li className='text-gray-600 text-sm dark:text-gray-400'>
                    <span className='font-medium'>
                      {contact.location.label}:
                    </span>{' '}
                    {contact.location.value}
                  </li>
                )}
              </ul>
              </div>
            )}
            <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                {tenant.name}
              </h2>
              <ul className='mt-6 space-y-3' role='list'>
                <FooterLinkList links={footerContent.company} relabelBlog />
              </ul>
            </div>

            {/* Legales */}
            <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                Legales
              </h2>
              <ul className='mt-6 space-y-3' role='list'>
                <FooterLinkList links={legal} />
              </ul>
            </div>

            {/* <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                Nuestras marcas
              </h2>
              <ul className='mt-6 space-y-3' role='list'>
                {footerContent.brands.map((item) => (
                  <li key={item.name}>
                    <a
                      className='text-gray-600 text-sm hover:text-[--primary-color] dark:text-gray-400'
                      href={item.href}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div> */}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className='lg:hidden'>
          <div className='space-y-8'>
            {/* Logo y descripción */}
            <div className='space-y-4'>
              <img
                alt={tenant.name}
                className='max-h-[35px] md:max-h-[40px]'
                src={footerLogo}
              />
              {description && (
                <p className='text-gray-600 text-sm leading-relaxed dark:text-gray-400'>
                  {description}
                </p>
              )}
            </div>

            {/* Newsletter */}
            {newsletter && (
              <div>
                <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                  {newsletter.title}
                </h2>
                <div className='mt-3'>
                  <NewsletterForm
                    placeholder={newsletter.placeholder}
                    buttonText={newsletter.buttonText}
                    variant='mobile'
                  />
                </div>
              </div>
            )}

            {/* Redes sociales */}
            {social.length > 0 && (
              <div className='flex gap-4'>
                {social.map((item) => {
                  const IconComponent = item.icon
                    ? SocialIcons[item.icon]
                    : null
                  if (!IconComponent) return null

                  return (
                    <a
                      className='flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E7EB] text-gray-600 transition-colors duration-200 hover:bg-[--primary-color] hover:text-white dark:text-gray-400'
                      href={item.href}
                      key={item.name}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      <span className='sr-only'>{item.name}</span>
                      <IconComponent aria-hidden='true' className='h-5 w-5' />
                    </a>
                  )
                })}
              </div>
            )}

            {/*
              Contacto — la columna entera se esconde si no hay ningún dato. Antes
              no hacía falta el guard porque los fallbacks inventados garantizaban
              que siempre hubiera algo; sin ellos, un `<ul>` vacío bajo un título
              "Contacto" se lee como que la tienda no tiene forma de contacto.
            */}
            {hasContact && (
              <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                Contacto
              </h2>
              <ul className='mt-4 space-y-3' role='list'>
                {contact.phone && (
                  <li>
                    <span className='block font-medium text-gray-900 text-xs dark:text-white'>
                      {contact.phone.label || 'Teléfono'}:{' '}
                    </span>
                    {contact.phone.href ? (
                      <a
                        className='text-gray-600 text-sm hover:text-[--primary-color] dark:text-gray-400'
                        href={contact.phone.href}
                      >
                        {contact.phone.value}
                      </a>
                    ) : (
                      <p className='text-gray-600 text-sm dark:text-gray-400'>
                        {contact.phone.value}
                      </p>
                    )}
                  </li>
                )}
                {contact.email && (
                  <li>
                    <span className='block font-medium text-gray-900 text-xs dark:text-white'>
                      {contact.email.label || 'Correo electrónico'}:{' '}
                    </span>
                    <a
                      className='text-gray-600 text-sm hover:text-[--primary-color] dark:text-gray-400'
                      href={
                        contact.email.href || `mailto:${contact.email.value}`
                      }
                    >
                      {contact.email.value}
                    </a>
                  </li>
                )}
                {contact.hours && (
                  <li>
                    <span className='block font-medium text-gray-900 text-xs dark:text-white'>
                      {contact.hours.label || 'Horario de atención'}:{' '}
                    </span>
                    <p className='text-gray-600 text-sm dark:text-gray-400'>
                      {contact.hours.value}
                    </p>
                  </li>
                )}
                {contact.location && (
                  <li>
                    <span className='block font-medium text-gray-900 text-xs dark:text-white'>
                      {contact.location.label || 'Ubicación'}:{' '}
                    </span>
                    <p className='text-gray-600 text-sm dark:text-gray-400'>
                      {contact.location.value}
                    </p>
                  </li>
                )}
              </ul>
              </div>
            )}

            {/* Tenant Name */}
            <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                {tenant.name}
              </h2>
              <ul className='mt-4 space-y-3' role='list'>
                <FooterLinkList links={footerContent.company} relabelBlog />
              </ul>
            </div>

            {/* Legales */}
            <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                Legales
              </h2>
              <ul className='mt-4 space-y-3' role='list'>
                <FooterLinkList links={legal} />
              </ul>
            </div>

            {/* Nuestras marcas */}
            {/* <div>
              <h2 className='font-semibold text-gray-900 text-sm dark:text-white'>
                Nuestras marcas
              </h2>
              <ul className='mt-4 space-y-3' role='list'>
                {footerContent.brands.map((item) => (
                  <li key={item.name}>
                    <a
                      className='text-gray-600 text-sm hover:text-[--primary-color] dark:text-gray-400'
                      href={item.href}
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div> */}
          </div>
        </div>
        <div className='mt-16 border-gray-900/10 border-t pt-8 pb-[140px] sm:pb-0 sm:mt-20 lg:mt-6 dark:border-white/10'>
          <div className='flex flex-col gap-3 text-gray-600 text-sm/6 md:flex-row md:items-center md:justify-between dark:text-gray-400'>
            <ConsentPreferencesLink />
            {/* El copyright editable gana; si no hay, queda el de siempre. */}
            <span>
              {copyright ?? (
                <>
                  <strong>{tenant.name.toUpperCase()}</strong> &copy;{' '}
                  {new Date().getFullYear()} Todos los derechos reservados.
                </>
              )}
            </span>
            <a
              href='https://minimalart.co/?utm_source=website&utm_medium=ecommerce&utm_campaign=storefront'
              rel='noreferrer'
              target='_blank'
              className='flex items-center gap-2 hover:opacity-80 transition-opacity'
            >
              <img
                src='/minimalart/logo-minimalart.svg'
                alt='Minimalart'
                className='h-3'
              />
              <span className='text-gray-600 text-sm dark:text-gray-400'>
                | Evolution by design
              </span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
