import type { RecurringOrder } from '../../hooks/api/recurring-orders';

export const STATUS: Record<
  RecurringOrder['status'],
  { label: string; color: 'green' | 'orange' | 'red' | 'grey' | 'blue' | 'purple' }
> = {
  active: { label: 'Activa', color: 'green' },
  paused: { label: 'Pausada', color: 'orange' },
  pending_payment: { label: 'Esperando pago', color: 'blue' },
  failed: { label: 'Fallida', color: 'red' },
  cancelled: { label: 'Cancelada', color: 'grey' },
  completed: { label: 'Finalizada', color: 'grey' },
};

export function frequencyLabel(interval: string, count: number): string {
  const n = Math.max(1, count || 1);
  switch (interval) {
    case 'day':
      return n === 1 ? 'Diaria' : `Cada ${n} días`;
    case 'week':
      return n === 1 ? 'Semanal' : `Cada ${n} semanas`;
    default:
      return n === 1 ? 'Mensual' : `Cada ${n} meses`;
  }
}

export function fmtMoney(amount?: number | null, currency?: string | null): string {
  const value = Number(amount) || 0;
  return `${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}${currency ? ` ${currency.toUpperCase()}` : ''}`;
}

export function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}
