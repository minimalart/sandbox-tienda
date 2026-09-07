import type { DemoStoreLike } from './types';

const DEFAULT_LOGO = '/logo_full.webp';

export function buildBaseAssets(demo: DemoStoreLike) {
  const theme = demo.theme ?? {};
  // `icon` reemplaza a `mobile_logo` (compat: se lee el viejo si no hay `icon`).
  const icon = theme.icon || theme.mobile_logo;
  return {
    logos: {
      main: theme.logo || DEFAULT_LOGO,
      footer: theme.logo || DEFAULT_LOGO,
      mobile: icon || theme.logo || DEFAULT_LOGO,
      // Variantes negativo, para fondos OSCUROS. Solo se exponen; hoy no las
      // consume nadie. La barra inferior mobile NO es un consumidor: su círculo
      // es blanco y usa siempre el isotipo positivo (DESDEELSUR-29).
      mainNegative: theme.logo_negative || undefined,
      iconNegative: theme.icon_negative || undefined,
    },
    favicon: theme.favicon || undefined,
    faviconNegative: theme.favicon_negative || undefined,
  };
}

/**
 * Assets de la tienda PRINCIPAL: sólo la marca que el usuario cargó, SIN defaults.
 *
 * `buildBaseAssets` no sirve para ella porque cae a `DEFAULT_LOGO`
 * (`/logo_full.webp`) cuando el theme no trae logo, y el sitio real usa
 * `/logos-mercatto/logocompleto-verde.svg`. El merge del storefront es shallow por
 * clave (`{...defaultConfig.assets, ...demo.assets}`), así que una clave presente
 * gana ENTERA: para que gane el default hay que dejarla AUSENTE, no en `undefined`.
 *
 * Vive acá y no en `main-store.ts` para no crear un ciclo
 * (templates/index → main-store → index → service).
 */
export function buildMainStoreBrandAssets(demo: DemoStoreLike): Record<string, unknown> {
  const theme = demo.theme ?? {};
  const icon = theme.icon || theme.mobile_logo;
  const logos: Record<string, string> = {};
  if (theme.logo) {
    logos.main = theme.logo;
    logos.footer = theme.logo;
  }
  const mobile = icon || theme.logo;
  if (mobile) logos.mobile = mobile;
  if (theme.logo_negative) logos.mainNegative = theme.logo_negative;
  if (theme.icon_negative) logos.iconNegative = theme.icon_negative;

  return {
    ...(Object.keys(logos).length ? { logos } : {}),
    ...(theme.favicon ? { favicon: theme.favicon } : {}),
    ...(theme.favicon_negative ? { faviconNegative: theme.favicon_negative } : {}),
  };
}
