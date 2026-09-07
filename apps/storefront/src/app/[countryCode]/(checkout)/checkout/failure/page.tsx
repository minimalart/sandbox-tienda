import { getTenant } from '@lib/site-config/resolver'
import PaymentResultOverlay from '@modules/common/components/payment-result-overlay'
import type { Metadata } from 'next'
import FailureClient from './failure-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant()

  return {
    title: `Pago Fallido | ${tenant.name}`,
    description: 'Hubo un problema con tu pago',
  }
}

/**
 * Retorno de MercadoPago con el pago rechazado.
 *
 * La página es SÓLO el overlay animado rojo. Es una de las TRES pantallas de
 * retorno; la tarjeta blanca que estaba detrás se eliminó porque repetía el
 * mismo mensaje y los mismos botones con otro estilo.
 */
export default async function CheckoutFailure() {
  return (
    <>
      <FailureClient />
      <PaymentResultOverlay
        primary={{ label: 'INTENTAR NUEVAMENTE', kind: 'link', href: '/checkout' }}
        secondary={{ label: 'Seguir comprando', href: '/' }}
        variant='error'
      />
    </>
  )
}
