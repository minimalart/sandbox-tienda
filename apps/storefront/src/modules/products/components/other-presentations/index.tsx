'use client'

import type { TypesenseProductDocument } from '@lib/typesense'
import ScrollCarousel from '@modules/common/components/scroll-carousel'
import PresentationCard from './presentation-card'

type OtherPresentationsProps = {
  products: TypesenseProductDocument[]
  countryCode: string
  isProductDetail?: boolean
  fragranceName?: string
}

export default function OtherPresentations({
  products,
  countryCode,
  isProductDetail = false,
  fragranceName,
}: OtherPresentationsProps) {
  if (!products.length) return null

  const showFragranceSuffix = isProductDetail && fragranceName

  return (
    <div className='mt-12'>
      <ScrollCarousel
        disableScrollForFew
        title={
          <h2 className='font-bold text-gray-900 text-lg'>
            Otras presentaciones
            {showFragranceSuffix ? ` de ${fragranceName}` : null}
          </h2>
        }
      >
        {products.map((product) => (
          <div className='w-[260px] flex-shrink-0' key={product.id}>
            <PresentationCard product={product} countryCode={countryCode} />
          </div>
        ))}
      </ScrollCarousel>
    </div>
  )
}
