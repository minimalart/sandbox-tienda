import b2bDescriptors from '../app-settings/descriptors/b2b';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración de entorno de B2B, con la precedencia **DB > env > default** de
 * `app-settings`.
 *
 * Una sola variable: el canal de ventas mayorista que se le estampa a cada
 * empresa nueva. No es cosmético — `company/site-scope.ts` usa esa columna para
 * decidir a qué TIENDA pertenece la empresa.
 *
 * SINCRÓNICA, calcada de `modules/gift-card-experience/settings.ts`. Los dos
 * consumidores son rutas HTTP (`api/store/companies/register` y
 * `api/admin/companies`), o sea que el snapshot ya está lleno.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LIMITACIÓN A TENER PRESENTE: el descriptor es `scope: 'site'` pero el      │
 * │ camino sincrónico sólo ve la fila GLOBAL.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Está documentado en `app-settings/resolve.ts:resolveSettingSync`. Traducido a
 * este caso: hoy todas las tiendas estampan el mismo canal mayorista, igual que
 * antes de la migración. Los dos call sites SON rutas y tienen `req`, así que
 * arreglarlo es propagar la `SiteResolution` y usar el camino async — el
 * descriptor ya está declarado `site` justamente para no tener que migrar el
 * scope de una fila viva ese día.
 */

export const B2B_SETTINGS_NAMESPACE = b2bDescriptors.namespace;

export type B2bSettings = {
  /**
   * `null` cuando no hay canal configurado, que es un estado NORMAL: la empresa
   * se crea igual y se le asigna el canal después. Es el mismo `?? null` que
   * tenían las dos rutas antes de esta migración.
   */
  salesChannelId: string | null;
};

const byKey = new Map(b2bDescriptors.settings.map((d) => [d.key, d]));

function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

export function getB2bSettings(): B2bSettings {
  // Un string en blanco cuenta como ausente: una fila creada sin valor en un
  // panel de deploy no tiene que producir empresas con `sales_channel_id: ''`,
  // que no matchea ningún canal y encima no es `null`, así que ni siquiera se
  // ve como "sin asignar" en el listado.
  const raw = read<string>('B2B_SALES_CHANNEL_ID', '').trim();
  return { salesChannelId: raw === '' ? null : raw };
}

/** Atajo para los call sites que sólo quieren el id. */
export function getB2bSalesChannelId(): string | null {
  return getB2bSettings().salesChannelId;
}
