'use client'

import {
  CardNumber,
  ExpirationDate,
  SecurityCode,
  createCardToken,
  initMercadoPago,
} from '@mercadopago/sdk-react'
import { updateRecurringPaymentMethod } from '@lib/data/recurring-orders'
import { CreditCard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from '@medusajs/ui'

const secureFieldStyle = {
  color: '#111827',
  fontSize: '14px',
  fontFamily: 'system-ui, sans-serif',
  padding: '10px 12px',
}

/**
 * Tokeniza la nueva tarjeta directamente en Mercado Pago. Mercatto recibe sólo
 * el token efímero y nunca guarda PAN, vencimiento ni código de seguridad.
 */
export default function PaymentMethodEditor({
  recurringOrderId,
  publicKey,
}: {
  recurringOrderId: string
  publicKey: string
}) {
  const initialized = useRef(false)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cardholderName, setCardholderName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')

  useEffect(() => {
    if (!open || initialized.current || !publicKey) return
    initialized.current = true
    initMercadoPago(publicKey, { locale: 'es-AR' })
    setReady(true)
  }, [open, publicKey])

  const save = async () => {
    if (!cardholderName.trim() || !documentNumber.trim()) {
      toast.error('Completá el nombre y el DNI del titular.')
      return
    }
    setSubmitting(true)
    try {
      const token = await createCardToken({
        cardholderName: cardholderName.trim(),
        identificationType: 'DNI',
        identificationNumber: documentNumber.replace(/\D/g, ''),
      })
      if (!token?.id) throw new Error('Revisá los datos de la tarjeta.')
      const result = await updateRecurringPaymentMethod(recurringOrderId, token.id)
      if ('error' in result && result.error) throw new Error(result.error)
      toast.success('Medio de pago actualizado.')
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la tarjeta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='rounded-2xl border border-gray-200 bg-white p-4 sm:p-5'>
      <div className='flex items-center justify-between gap-4'>
        <div>
          <h3 className='flex items-center gap-2 font-semibold text-gray-900 text-sm'>
            <CreditCard className='h-4 w-4 text-gray-400' /> Medio de pago
          </h3>
          <p className='mt-1 text-gray-500 text-xs'>
            Los datos sensibles se cargan y tokenizan en Mercado Pago.
          </p>
        </div>
        <button
          className='rounded-xl border border-gray-300 px-3 py-2 font-semibold text-gray-700 text-sm hover:border-[--primary-color] hover:text-[--primary-color]'
          onClick={() => setOpen((value) => !value)}
          type='button'
        >
          {open ? 'Cerrar' : 'Cambiar tarjeta'}
        </button>
      </div>

      {open && ready && (
        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
          <label className='sm:col-span-2 text-gray-700 text-xs'>
            Número de tarjeta
            <div className='mt-1 h-11 rounded-xl border border-gray-300 bg-white'>
              <CardNumber placeholder='Número de tarjeta' style={secureFieldStyle} />
            </div>
          </label>
          <label className='text-gray-700 text-xs'>
            Vencimiento
            <div className='mt-1 h-11 rounded-xl border border-gray-300 bg-white'>
              <ExpirationDate mode='short' placeholder='MM/AA' style={secureFieldStyle} />
            </div>
          </label>
          <label className='text-gray-700 text-xs'>
            Código de seguridad
            <div className='mt-1 h-11 rounded-xl border border-gray-300 bg-white'>
              <SecurityCode placeholder='CVV' style={secureFieldStyle} />
            </div>
          </label>
          <label className='text-gray-700 text-xs'>
            Nombre del titular
            <input
              className='mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm'
              onChange={(event) => setCardholderName(event.target.value)}
              value={cardholderName}
            />
          </label>
          <label className='text-gray-700 text-xs'>
            DNI del titular
            <input
              className='mt-1 h-11 w-full rounded-xl border border-gray-300 px-3 text-sm'
              inputMode='numeric'
              onChange={(event) => setDocumentNumber(event.target.value)}
              value={documentNumber}
            />
          </label>
          <button
            className='sm:col-span-2 rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white disabled:opacity-50'
            disabled={submitting}
            onClick={save}
            type='button'
          >
            {submitting ? 'Guardando…' : 'Guardar nueva tarjeta'}
          </button>
        </div>
      )}
    </div>
  )
}
