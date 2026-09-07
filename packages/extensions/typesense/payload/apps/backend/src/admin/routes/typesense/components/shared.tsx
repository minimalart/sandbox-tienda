import { StatusBadge } from '@medusajs/ui';
import type { i18n as I18nInstance } from 'i18next';
import { registerTypesenseTranslations } from '../../../translations/typesense';

/** Espejo de `routes/erp/components/shared.tsx`, para las pantallas de logs. */

/** Registra el namespace 'typesense' una sola vez. */
export function useTypesenseTranslationsReady(i18n: I18nInstance): void {
  registerTypesenseTranslations(i18n);
}

/** Fecha corta es-AR para tablas/cards (ej. "31/7/26, 14:30"). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function formatDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  return `${Math.round(seconds / 60)}min`;
}

type BadgeColor = 'green' | 'red' | 'orange' | 'blue' | 'grey' | 'purple';

const STATUS_COLORS: Record<string, BadgeColor> = {
  // corridas
  running: 'blue',
  completed: 'green',
  completed_with_errors: 'orange',
  failed: 'red',
  // items
  deleted: 'grey',
  skipped: 'grey',
};

/** Clave i18n del estado (ST_RUNNING, ST_FAILED, ...). */
export function statusLabelKey(status: string): string {
  return `ST_${status.toUpperCase()}`;
}

export function TypesenseStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}): JSX.Element {
  return <StatusBadge color={STATUS_COLORS[status] ?? 'grey'}>{label}</StatusBadge>;
}
