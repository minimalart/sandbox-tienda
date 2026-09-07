import LocalizedClientLink from '@modules/common/components/localized-client-link'
import ScrollCarousel from '@modules/common/components/scroll-carousel'
import Image from 'next/image'

export type KitSlide = {
  id: string
  title: string
  subtitle: string
  image: string
  video: string
  poster: string
  bgColor: string
  href: string
}

const KitBannerCard = ({ kit }: { kit: KitSlide }) => (
  <article
    // En desktop (>1140px, el mismo breakpoint que usa ScrollCarousel para su
    // modo estático) las dos cards dejan de tener ancho fijo y comparten la
    // fila al 50% cada una, quedando completamente visibles sin flechas. En
    // mobile/tablet conservan el ancho fijo y el carousel se mantiene.
    className='relative flex h-[170px] w-[78vw] max-w-[420px] flex-shrink-0 overflow-hidden rounded-2xl sm:h-[180px] sm:w-[640px] sm:max-w-none [@media(min-width:1141px)]:w-auto [@media(min-width:1141px)]:max-w-none [@media(min-width:1141px)]:flex-1'
    style={{ backgroundColor: kit.bgColor }}
  >
    {/* Imagen del combo (izquierda) */}
    <div className='relative h-full w-[96px] flex-shrink-0 sm:w-[150px]'>
      <Image
        alt={kit.title}
        className='object-contain p-2 sm:p-3'
        fill
        sizes='(max-width: 640px) 96px, 150px'
        src={kit.image}
      />
    </div>

    {/* Texto + CTA (centro) */}
    <div className='flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-4 sm:gap-2 sm:px-4'>
      <h3 className='truncate font-bold text-[var(--text-dark)] text-lg leading-tight sm:text-xl'>
        {kit.title}
      </h3>
      <p className='line-clamp-2 text-[var(--text-muted)] text-xs leading-snug sm:text-sm'>
        {kit.subtitle}
      </p>
      <LocalizedClientLink
        className='mt-1 inline-flex w-fit items-center justify-center rounded-full bg-white px-4 py-1.5 font-semibold text-gray-900 text-xs shadow-sm transition-all hover:shadow-md sm:px-5 sm:py-2 sm:text-sm'
        href={kit.href}
      >
        Ver productos
      </LocalizedClientLink>
    </div>

    {/* Imagen ambiente (derecha) */}
    <div className='relative hidden h-full w-[200px] flex-shrink-0 sm:block'>
      <Image
        alt=''
        className='object-cover'
        fill
        sizes='200px'
        src={kit.poster}
      />
    </div>
  </article>
)

const EntrepreneurCarouselClient = ({
  kits,
  title,
  description,
}: {
  kits: KitSlide[]
  title?: string
  description?: string
}) => {
  if (!kits.length) return null

  return (
    <section className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <ScrollCarousel
        headerClassName='mb-6 flex items-end justify-between gap-4'
        containerClassName='gap-4 pb-4'
        disableScrollForFew
        snap
        title={
          <div>
            {title && <p className='home-section-heading'>{title}</p>}
            {description && (
              <p className='mt-1 text-sm font-normal text-gray-500 sm:text-base'>
                {description}
              </p>
            )}
          </div>
        }
      >
        {kits.map((kit) => (
          <KitBannerCard key={kit.id} kit={kit} />
        ))}
      </ScrollCarousel>
    </section>
  )
}

export default EntrepreneurCarouselClient
