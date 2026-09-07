import type { MedusaRequest } from '@medusajs/framework';

import { STORE_CONFIG_MODULE } from '../store-config';
import type StoreConfigModuleService from '../store-config/service';
import { hexToRgba } from '../email/templates/email-helpers';
import type { SiteResolution } from '../../lib/multistore/types';

/**
 * VIVE EN EL MÓDULO Y NO EN `api/admin/email-templates/`, DONDE ESTUVO PRIMERO.
 *
 * El motivo es de diseño y nada más: `src/api/` es la capa de rutas, y esto no es una
 * ruta — es la preparación de los datos con los que se renderiza, al lado de
 * `render.ts` y `render-email.ts`, de donde esas mismas rutas ya importan.
 *
 * La primera versión de este comentario afirmaba que un `.ts` que no es ruta ahí
 * rompía cinco tests de scoping. ES FALSO y quedó escrito acá porque se movió el
 * archivo y los fallos desaparecieron en la misma tanda en que `main` avanzó: se
 * atribuyó al movimiento lo que había traído el rebase. Comprobado después con un
 * archivo señuelo bajo `api/admin/email-templates/`: los tests de
 * `admin-id-mutation-scope` fallan 4 de 7 con él y 4 de 7 sin él. Se deja anotado
 * porque la conclusión equivocada era mucho más creíble que la verdadera.
 *
 * Los campos de presentación que el operador NUNCA escribe en `sample_data`: los
 * inyecta el provider de email desde `email_branding` en cada envío real.
 *
 * ESTE ARCHIVO EXISTE PORQUE LA VISTA PREVIA Y EL "ENVIAR PRUEBA" NO COINCIDÍAN.
 *
 * `preview/route.ts` inyectaba el branding y `test-send/route.ts` no, así que la
 * MISMA plantilla se veía bien en la pantalla y llegaba sin estilos al buzón: con
 * `primary_color` vacío, el `style="background-color: {{primary_color}}"` del botón
 * renderiza `background-color:;` —CSS inválido que el cliente de mail descarta— y el
 * botón sale sin color. Reportado por el operador como "no tiene ni los estilos que
 * aparecen en la vista previa", que es exactamente lo que pasaba.
 *
 * Lo peor no era el bug sino la conclusión que invitaba: el envío de prueba es el
 * único ensayo antes de mandarle un mail a un cliente, y mentía en la dirección
 * MENOS conveniente — mostraba peor de lo que era. El comentario que había en
 * `test-send` afirmaba que la prueba salía con el branding de la tienda activa, y
 * pasaba `site_id` en la notificación para lograrlo; pero el HTML ya estaba
 * renderizado a esa altura, así que el `fillEmpty` del provider llegaba tarde
 * (`modules/email/service.ts` resuelve `__inline__` devolviendo `__subject`/`__html`
 * tal cual vinieron). Declaraba el requisito que no cumplía.
 */
const BRANDING_KEYS = [
  'primary_color',
  'text_color',
  'logo_url',
  'cde_display_name',
  'sales_channel_name',
  'year',
  'primary_color_bg',
] as const;

/** Las claves que este helper puebla. Se exporta para que la UI pueda distinguirlas. */
export const INJECTED_PRESENTATION_KEYS: readonly string[] = BRANDING_KEYS;

/**
 * La tienda de la que hay que leer el branding, o `null` para el global.
 *
 * `getEmailBranding()` SIN argumento devuelve el global, y así lo llamaba la vista
 * previa: en una instalación multitienda el operador de la tienda B veía el logo y
 * los colores de la instancia en vez de los suyos. La tienda ya estaba resuelta en
 * las dos rutas para el guard de scope — sólo no se usaba.
 */
export function siteIdOf(resolution: SiteResolution): string | null {
  return resolution.status === 'site' || resolution.status === 'singleSite'
    ? resolution.site.id
    : null;
}

/**
 * Devuelve una copia de `data` con el branding de la tienda como DEFAULTS.
 *
 * Es la MISMA precedencia que el provider aplica en el envío real
 * (`modules/email/service.ts send`): lo que el emisor manda gana, y esto sólo
 * rellena lo que falta. Por eso la comparación con lo que recibe el cliente es
 * honesta, que es el único punto de una vista previa.
 *
 * `''` cuenta como ausente, no como valor: el `sample_data` del seed viaja con
 * `logo_url: ''`, y un `??=` lo dejaría pasar y renderizaría el mail sin logo.
 *
 * BEST-EFFORT A PROPÓSITO. Una fila de branding ausente o ilegible no puede tumbar
 * la vista previa ni el envío de prueba: se devuelve `data` como vino y la pantalla
 * sigue sirviendo. Es el mismo criterio que el provider, que jamás bloquea un mail
 * por el branding.
 */
export async function withBrandingDefaults(
  req: MedusaRequest,
  resolution: SiteResolution,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const merged: Record<string, unknown> = { ...data };

  const fillEmpty = (key: string, value: unknown) => {
    const cur = merged[key];
    if (cur === undefined || cur === null || cur === '') merged[key] = value;
  };

  try {
    const storeConfig = req.scope.resolve<StoreConfigModuleService>(STORE_CONFIG_MODULE);
    const branding = await storeConfig.getEmailBranding(siteIdOf(resolution));

    fillEmpty('primary_color', branding.primary_color);
    fillEmpty('text_color', branding.text_color);
    fillEmpty('logo_url', branding.logo_url);
    fillEmpty('cde_display_name', branding.cde_display_name);
    /**
     * `sales_channel_name` encabeza el subject de media docena de plantillas
     * (`[{{sales_channel_name}}] Restablecer tu contraseña`) y no la manda ningún
     * emisor: los asuntos salían como `[] Restablecer tu contraseña`. El provider
     * ahora la rellena con el nombre de la tienda en el envío real, y acá va lo
     * mismo — si no, la pantalla seguiría mostrando los corchetes vacíos después de
     * que el mail de verdad ya salió bien, que es la peor combinación posible: el
     * operador ve un bug que ya no existe y vuelve a reportarlo.
     */
    fillEmpty('sales_channel_name', branding.cde_display_name);
    fillEmpty('year', new Date().getFullYear());
    fillEmpty(
      'primary_color_bg',
      hexToRgba(String(merged.primary_color || branding.primary_color), 0.1),
    );
  } catch {
    // Ver BEST-EFFORT arriba: se renderiza con lo que haya en `sample_data`.
  }

  return merged;
}
