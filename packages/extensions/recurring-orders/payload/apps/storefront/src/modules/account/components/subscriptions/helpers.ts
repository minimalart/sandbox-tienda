import type {
  RecurringFrequencyInterval,
  RecurringOrderStatus,
} from '@lib/data/recurring-orders'

export function frequencyLabel(
  interval: RecurringFrequencyInterval,
  count: number,
): string {
  const n = Math.max(1, count || 1)
  switch (interval) {
    case 'day':
      return n === 1 ? 'Todos los días' : `Cada ${n} días`
    case 'week':
      return n === 1 ? 'Todas las semanas' : `Cada ${n} semanas`
    case 'month':
      return n === 1 ? 'Todos los meses' : `Cada ${n} meses`
  }
}

export const STATUS_LABELS: Record<
  RecurringOrderStatus,
  { label: string; className: string }
> = {
  active: { label: 'Activa', className: 'bg-green-50 text-green-700' },
  paused: { label: 'Pausada', className: 'bg-amber-50 text-amber-700' },
  pending_payment: {
    label: 'Esperando tu pago',
    className: 'bg-blue-50 text-blue-700',
  },
  failed: { label: 'Requiere atención', className: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600' },
  completed: { label: 'Finalizada', className: 'bg-gray-100 text-gray-600' },
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return '—'
  }
}
