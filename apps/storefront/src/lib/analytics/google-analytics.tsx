'use client'

import Script from 'next/script'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { GA_MEASUREMENT_ID, isGAEnabled, trackPageView } from './gtag'

// Trackea page_view en cada cambio de ruta. El App Router navega del lado del
// cliente sin recargar, así que el config de gtag va con send_page_view:false
// y nosotros disparamos el evento a mano acá. useSearchParams obliga a un
// límite de Suspense, por eso este componente va envuelto abajo.
function GAPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) {
      return
    }
    const query = searchParams?.toString()
    trackPageView(query ? `${pathname}?${query}` : pathname)
  }, [pathname, searchParams])

  return null
}

/**
 * Integración OPCIONAL de Google Analytics 4. Si no hay measurement id
 * (NEXT_PUBLIC_GA_MEASUREMENT_ID) no renderiza nada y la app funciona igual.
 * Se monta una sola vez en el root layout.
 */
export default function GoogleAnalytics() {
  if (!isGAEnabled) {
    return null
  }

  return (
    <>
      <Script
        id='ga4-loader'
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy='afterInteractive'
      />
      <Script id='ga4-init' strategy='afterInteractive'>
        {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });`}
      </Script>
      <Suspense fallback={null}>
        <GAPageView />
      </Suspense>
    </>
  )
}
