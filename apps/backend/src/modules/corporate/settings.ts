import corporateDescriptors from '../app-settings/descriptors/corporate';
import { resolveSettingSync } from '../app-settings/resolve';
import type { CorporateActivationMode } from './types';

/**
 * Configuración efectiva de Cuentas Corporativas, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * SINCRÓNICA, calcada de `modules/gift-card-experience/settings.ts`. Acá alcanza
 * y sobra: los tres consumidores son una ruta de store y un script de `medusa
 * exec`, o sea que el snapshot ya está lleno cuando leen, y ninguno tiene
 * presupuesto para un `SELECT` extra ni gana nada esperándolo.
 *
 * Lo que se pierde por ser sincrónica está documentado en
 * `app-settings/resolve.ts:resolveSettingSync`: se lee la fila GLOBAL, nunca la
 * de una tienda, aunque `CORPORATE_ACTIVATION_MODE` esté declarado `site`. No es
 * un leak — la global es config de la instancia, no de otra tienda —; lo que
 * falta es que `api/store/corporates/register` propague su `SiteResolution`, y
 * ese es el hilo del que hay que tirar cuando una tienda pida su propio modo de
 * activación.
 */

export const CORPORATE_SETTINGS_NAMESPACE = corporateDescriptors.namespace;

export type CorporateSettings = {
  /** Qué pasa cuando una empresa se registra sola desde el storefront. */
  activationMode: CorporateActivationMode;
  /** FRACCIÓN, no porcentaje: 0.2 = 20% off sobre el precio actual. */
  wholesaleDiscount: number;
  /** Título de la lista mayorista. Es la clave de idempotencia del script. */
  wholesalePriceListTitle: string;
};

const byKey = new Map(corporateDescriptors.settings.map((d) => [d.key, d]));

function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

/**
 * Estrecha el valor resuelto al union del módulo.
 *
 * Existe porque la fuente puede ser una env var, y `coerceFromEnv` NO valida
 * contra `options` a propósito (un entorno fuera de rango tiene que seguir
 * comportándose como antes de la migración). O sea: acá puede llegar cualquier
 * string. La regla es la MISMA que tenía la ruta antes —sólo el literal exacto
 * `'automatic'` activa solo, todo lo demás cae a `'manual'`—, así que un valor
 * basura falla del lado seguro en vez de activar empresas sin aprobación.
 */
function asActivationMode(value: unknown): CorporateActivationMode {
  return value === 'automatic' ? 'automatic' : 'manual';
}

export function getCorporateSettings(): CorporateSettings {
  return {
    activationMode: asActivationMode(read<string>('CORPORATE_ACTIVATION_MODE', 'manual')),
    wholesaleDiscount: read<number>('WHOLESALE_DISCOUNT', 0.2),
    wholesalePriceListTitle: read<string>('WHOLESALE_PRICE_LIST_TITLE', 'Mayorista -20%'),
  };
}

/**
 * Descuento mayorista ya saneado, listo para multiplicar un precio.
 *
 * El descriptor declara `min: 0` / `max: 0.9`, pero eso lo hace cumplir la card
 * del admin y NADIE MÁS: por el env puede llegar un `1`, un `-0.5`, un
 * `"veinte"` o un `NaN`. Esta función es el borde: sanea una sola vez y todos
 * los call sites usan el mismo número.
 *
 * Se recorta (clamp) en vez de tirar porque el consumidor es un script de
 * instalación: cortarle la corrida a alguien que puso `1.2` es peor que crearle
 * la lista con el tope, que además se ve en el log y en el título.
 */
export function resolveWholesaleDiscount(raw: number = getCorporateSettings().wholesaleDiscount): number {
  if (!Number.isFinite(raw)) return 0.2;
  return Math.min(0.9, Math.max(0, raw));
}
