import { getStoreBrands } from '@lib/data/brands'
import { getActiveTenant } from '@lib/site-config/active-tenant'
import Reveal from '@modules/common/components/reveal'
import BrandsDots from './brands-dots'
import BrandsMarquee from './brands-marquee'
import BrandsRow from './brands-row'

/**
 * Sección "Nuestras marcas" del home. El diseño se elige POR DEMO desde el
 * admin (Demos → Contenido → "Diseño de la sección de marcas") y llega acá como
 * `assets.brandsLayout`. Ausente (o store principal) = `carousel`, el histórico.
 *  - `carousel`: fila con flechas, tarjetas grises que se levantan al hover.
 *  - `marquee`: marquesina infinita en escala de grises, color al hover.
 *  - `dots`: páginas limpias con indicadores de puntos.
 */
const LogoShowcase = async ({
  countryCode: _countryCode,
  title,
  subtitle,
}: {
  countryCode: string
  /**
   * Textos del bloque del editor de home ("Personalizar home"). Ausentes = el
   * título histórico; `title: ""` oculta el encabezado de la sección.
   */
  title?: string
  subtitle?: string
}) => {
  const [brands, tenant] = await Promise.all([getStoreBrands(), getActiveTenant()])

  if (!brands.length) {
    return null
  }

  const layout = tenant.assets.brandsLayout ?? 'carousel'
  const heading = title ?? 'Nuestras marcas'

  return (
    <Reveal as='section' className='bg-white py-10 sm:py-10'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {heading || subtitle ? (
          <div className='mb-8 text-center'>
            {heading ? (
              <Reveal as='h2' className='brand-section-title'>
                {heading}
              </Reveal>
            ) : null}
            {subtitle ? (
              <p className='mt-1 text-sm font-normal text-gray-500 sm:text-base'>
                {subtitle}
              </p>
            ) : null}
          </div>
        ) : null}
        {layout === 'marquee' && <BrandsMarquee brands={brands} />}
        {layout === 'dots' && <BrandsDots brands={brands} />}
        {layout === 'carousel' && <BrandsRow brands={brands} />}
      </div>
    </Reveal>
  )
}

export default LogoShowcase
