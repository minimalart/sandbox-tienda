import { StatusBadge } from '@medusajs/ui';
import type { i18n as I18nInstance } from 'i18next';
import { registerErpTranslations } from '../../../translations/erp';

/** Registra el namespace 'erp' una sola vez (patrón store-config). */
export function useErpTranslationsReady(i18n: I18nInstance): void {
  registerErpTranslations(i18n);
}

/** Fecha corta es-AR para tablas/cards (ej. "4/7/26, 14:30"). */
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
  // sync logs
  running: 'blue',
  completed: 'green',
  completed_with_errors: 'orange',
  failed: 'red',
  // outbox
  pending: 'orange',
  processing: 'blue',
  sent: 'green',
  dead_letter: 'red',
  skipped: 'grey',
  duplicate: 'grey',
  // items
  updated: 'green',
  not_found: 'orange',
  duplicate_sku: 'red',
  invalid_quantity: 'red',
  // items del catalog sync
  created: 'green',
  // "sin cambio" es el caso normal de un delta idempotente, no un problema
  price_unchanged: 'grey',
  no_price_set: 'red',
  variant_not_found: 'orange',
  not_published: 'grey',
};

/**
 * Clave i18n del estado (ST_RUNNING, ST_SENT, ...).
 *
 * La guarda no es defensa por si acaso: sin ella, un `status` ausente tira
 * `Cannot read properties of undefined (reading 'toUpperCase')` y se lleva la
 * PANTALLA ENTERA, no la celda — porque esto se llama desde el render de las
 * columnas y del header. Pasó en producción con el drawer del log: `onRowClick`
 * de `@medusajs/ui` entrega el `Row` de TanStack en lugar del item (su propio
 * tipo dice `TData`), así que `status` venía undefined y el detalle del sync
 * quedó inaccesible.
 *
 * `ST_UNKNOWN` está definido en las dos traducciones: el fallback de i18next
 * pinta el NOMBRE de la clave cuando no existe, y "ST_UNKNOWN" en un badge es
 * casi tan malo como el crash.
 */
export function statusLabelKey(status: string | null | undefined): string {
  if (!status) return 'ST_UNKNOWN';
  return `ST_${status.toUpperCase()}`;
}

export function ErpStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}): JSX.Element {
  return <StatusBadge color={STATUS_COLORS[status] ?? 'grey'}>{label}</StatusBadge>;
}

/**
 * Alias de `SettingLabel`, que es este mismo componente después de subir a
 * `components/common/`.
 *
 * ERP fue la primera extensión que se comió el problema de las ayudas largas,
 * pero no es la única: hay ~100 `help` de más de 140 caracteres repartidos en
 * los 37 descriptores. Al subirlo, `SettingField` lo cablea una vez y las
 * arregla a todas; acá queda el alias para no tocar los 15 call sites de ERP,
 * que no ganan nada con el rename.
 *
 * Nuevo código: importar `SettingLabel` de `components/common/setting-label`.
 */
export { SettingLabel as ErpSettingLabel } from '../../../components/common/setting-label';
