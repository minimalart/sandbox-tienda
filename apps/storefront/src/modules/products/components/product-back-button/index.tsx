'use client'

import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import { useSiteHref } from '@lib/site-config/context'
import { useRouter } from 'next/navigation'

const ProductBackButton = () => {
  const router = useRouter()
  const siteHref = useSiteHref()

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.push(siteHref('/store'))
  }

  return (
    <button
      aria-label='Volver atrás'
      className='mb-6 hidden items-center gap-2 font-medium text-gray-600 text-sm transition-colors hover:text-[--primary-color] lg:inline-flex'
      onClick={handleBack}
      type='button'
    >
      <ChevronLeftIcon aria-hidden className='h-5 w-5' />
      Volver atrás
    </button>
  )
}

export default ProductBackButton
