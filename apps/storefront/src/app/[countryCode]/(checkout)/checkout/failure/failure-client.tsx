'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

// Preserve the cart on failure so the user can retry payment with the same
// items. Only clear MP-specific session state.
export default function FailureClient() {
  const searchParams = useSearchParams()

  useEffect(() => {
    document.cookie = 'mp_payment_pending=; Path=/; Max-Age=0; SameSite=Lax'
    document.cookie = 'mp_pending_order_id=; Path=/; Max-Age=0; SameSite=Lax'

    const externalReference = searchParams.get('external_reference')
    if (externalReference) {
      try {
        window.sessionStorage.removeItem(`mp_order_${externalReference}`)
      } catch {
        /* ignore */
      }
    }
  }, [searchParams])

  return null
}
