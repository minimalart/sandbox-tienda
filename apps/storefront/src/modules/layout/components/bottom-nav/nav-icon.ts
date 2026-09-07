import type { TenantAssets } from "@lib/site-config/types"

/**
 * Isotipo por defecto del boilerplate. `logo-verde` es el ISOTIPO de Mercatto;
 * los `logocompleto-*` son el logotipo (con la palabra) y acá no van nunca.
 */
const FALLBACK_ISOTYPE = "/logos-mercatto/logo-verde.svg"

/**
 * Qué archivo muestra el botón de home de la barra inferior mobile.
 *
 * Es SIEMPRE el isotipo POSITIVO, y no hay variante que elegir. Dos razones,
 * en este orden:
 *
 *  1. Nunca `logos.main`, que es el logotipo completo: aplastado a 28px no se
 *     lee, y hacía que el botón cambiara de dibujo entre activo e inactivo.
 *  2. Nunca el negativo. El círculo es `bg-white` por diseño (decisión del
 *     ticket DESDEELSUR-29), y un isotipo negativo es blanco: sobre ese fondo
 *     desaparece. Hubo un selector en el backoffice para elegir la variante,
 *     con un texto de ayuda que avisaba del riesgo — no alcanzó: desdeelsur
 *     eligió la negativa y el botón quedó vacío en producción. Un aviso no es
 *     un gate, así que la opción ya no existe.
 *
 * Las filas que quedaron guardadas con `mobile_nav_icon: 'negative'` no
 * necesitan migración: acá esa preferencia ya no se lee.
 */
export function resolveNavIcon(
  logos: Partial<TenantAssets["logos"]> | undefined
): string {
  return logos?.mobile || FALLBACK_ISOTYPE
}
