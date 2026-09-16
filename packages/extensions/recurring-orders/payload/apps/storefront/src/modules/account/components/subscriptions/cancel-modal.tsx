'use client'

import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import {
  acceptRetention,
  cancelRecurringOrder,
  getSubscriptionCancellationReasons,
  type CancellationReason,
  type RecurringOrder,
} from '@lib/data/recurring-orders'
import { toast } from '@medusajs/ui'
import { PauseCircle, SkipForward, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const FALLBACK_REASONS: { value: CancellationReason; label: string }[] = [
  { value: 'precio', label: 'Me resulta caro' },
  { value: 'no_lo_necesito', label: 'Ya no lo necesito' },
  { value: 'problemas_entrega', label: 'Tuve problemas con las entregas' },
  { value: 'otro', label: 'Otro motivo' },
]

/**
 * Cancelación en 2 pasos: motivo → alternativas de retención (pausar, omitir
 * la próxima, descuento del canal si está configurado) antes de confirmar.
 */
export default function CancelSubscriptionModal({
  recurringOrder: ro,
  open,
  onClose,
}: {
  recurringOrder: RecurringOrder
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [step, setStep] = useState<'reason' | 'retention'>('reason')
  const [reason, setReason] = useState<CancellationReason | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [reasons, setReasons] = useState(FALLBACK_REASONS)

  useEffect(() => {
    if (!open) return
    void getSubscriptionCancellationReasons(ro.sales_channel_id).then((result) => {
      if (result.cancellation_reasons.length) {
        setReasons(
          result.cancellation_reasons.map((item) => ({ value: item.code, label: item.label })),
        )
      }
    })
  }, [open, ro.sales_channel_id])

  const retention = ro.retention_offer ?? null

  const close = () => {
    onClose()
    setStep('reason')
    setReason(null)
    setNote('')
  }

  const finish = (message: string) => {
    toast.success(message)
    close()
    router.refresh()
  }

  const handleRetention = async (action: 'pause' | 'skip' | 'discount') => {
    setBusy(action)
    const result = await acceptRetention(ro.id, {
      action,
      reason: reason ?? undefined,
      reason_note: note.trim() || undefined,
    })
    setBusy(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    finish(
      action === 'pause'
        ? 'Suscripción pausada. Podés reanudarla cuando quieras.'
        : action === 'skip'
          ? 'Listo: la próxima entrega se omite.'
          : `¡Descuento aplicado! ${retention?.percentage}% en tus próximas ${retention?.cycles} entregas.`,
    )
  }

  const handleCancel = async () => {
    setBusy('cancel')
    const result = await cancelRecurringOrder(
      ro.id,
      reason ?? undefined,
      note.trim() || undefined,
    )
    setBusy(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    finish('Suscripción cancelada.')
  }

  return (
    <Dialog className='relative z-50' onClose={close} open={open}>
      <DialogBackdrop className='fixed inset-0 bg-black/30 transition-opacity' />
      <div className='fixed inset-0 z-50 flex cursor-modal-close items-end justify-center sm:items-center sm:p-4'>
        <DialogPanel className='cursor-auto w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl'>
          {step === 'reason' ? (
            <div className='flex flex-col gap-4'>
              <div>
                <h3 className='font-bold text-gray-900 text-xl'>
                  ¿Por qué querés cancelar?
                </h3>
                <p className='mt-1 text-gray-500 text-sm'>
                  Nos ayuda a mejorar. Es un paso, nada más.
                </p>
              </div>
              <div className='flex flex-col gap-2'>
                {reasons.map((r) => (
                  <button
                    className={`rounded-xl border px-3 py-2.5 text-left font-medium text-sm transition-colors ${
                      reason === r.value
                        ? 'border-[--primary-color] bg-[--mc-green-soft] text-[--primary-color]'
                        : 'border-gray-200 text-gray-700 hover:border-[--primary-color]'
                    }`}
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    type='button'
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {reason && (
                <textarea
                  className='w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[--primary-color] focus:outline-none'
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='Comentario opcional…'
                  rows={2}
                  value={note}
                />
              )}
              <div className='flex flex-col gap-2'>
                <button
                  className='w-full rounded-xl bg-[--primary-color] px-4 py-3 font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                  disabled={!reason}
                  onClick={() => setStep('retention')}
                  type='button'
                >
                  Continuar
                </button>
                <button
                  className='w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-900 text-sm'
                  onClick={close}
                  type='button'
                >
                  Volver
                </button>
              </div>
            </div>
          ) : (
            <div className='flex flex-col gap-4'>
              <div>
                <h3 className='font-bold text-gray-900 text-xl'>
                  Antes de irte… ¿alguna de estas te sirve?
                </h3>
                <p className='mt-1 text-gray-500 text-sm'>
                  Podés frenar sin perder tu suscripción.
                </p>
              </div>

              <div className='flex flex-col gap-2'>
                {retention && ro.status !== 'paused' && (
                  <button
                    className='flex items-start gap-3 rounded-xl border-2 border-[--primary-color] bg-[--mc-green-soft] px-3 py-3 text-left transition-opacity hover:opacity-90 disabled:opacity-50'
                    disabled={busy !== null}
                    onClick={() => handleRetention('discount')}
                    type='button'
                  >
                    <Tag className='mt-0.5 h-5 w-5 shrink-0 text-[--primary-color]' />
                    <span>
                      <span className='block font-semibold text-[--primary-color] text-sm'>
                        {busy === 'discount'
                          ? 'Aplicando…'
                          : `Quedate con ${retention.percentage}% OFF`}
                      </span>
                      <span className='block text-gray-600 text-xs'>
                        En tus próximas {retention.cycles} entregas, además de las
                        promos vigentes.
                      </span>
                    </span>
                  </button>
                )}
                {ro.status !== 'paused' && (
                  <button
                    className='flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3 text-left transition-colors hover:border-[--primary-color] disabled:opacity-50'
                    disabled={busy !== null}
                    onClick={() => handleRetention('pause')}
                    type='button'
                  >
                    <PauseCircle className='mt-0.5 h-5 w-5 shrink-0 text-gray-400' />
                    <span>
                      <span className='block font-semibold text-gray-900 text-sm'>
                        {busy === 'pause' ? 'Pausando…' : 'Pausar por ahora'}
                      </span>
                      <span className='block text-gray-500 text-xs'>
                        No se generan entregas hasta que la reanudes.
                      </span>
                    </span>
                  </button>
                )}
                {ro.status === 'active' && !ro.skip_next_cycle && (
                  <button
                    className='flex items-start gap-3 rounded-xl border border-gray-200 px-3 py-3 text-left transition-colors hover:border-[--primary-color] disabled:opacity-50'
                    disabled={busy !== null}
                    onClick={() => handleRetention('skip')}
                    type='button'
                  >
                    <SkipForward className='mt-0.5 h-5 w-5 shrink-0 text-gray-400' />
                    <span>
                      <span className='block font-semibold text-gray-900 text-sm'>
                        {busy === 'skip' ? 'Guardando…' : 'Omitir solo la próxima entrega'}
                      </span>
                      <span className='block text-gray-500 text-xs'>
                        La suscripción sigue con la entrega siguiente.
                      </span>
                    </span>
                  </button>
                )}
              </div>

              <div className='flex flex-col gap-2 border-t pt-3'>
                <button
                  className='w-full rounded-xl border border-red-200 px-4 py-2.5 font-semibold text-red-600 text-sm transition-colors hover:bg-red-50 disabled:opacity-50'
                  disabled={busy !== null}
                  onClick={handleCancel}
                  type='button'
                >
                  {busy === 'cancel' ? 'Cancelando…' : 'Cancelar la suscripción igualmente'}
                </button>
                <button
                  className='w-full rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-900 text-sm'
                  onClick={() => setStep('reason')}
                  type='button'
                >
                  Volver
                </button>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
