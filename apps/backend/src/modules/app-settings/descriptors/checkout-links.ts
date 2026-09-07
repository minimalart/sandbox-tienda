import { defineSettings } from './types';

/**
 * Ajustes de Links de Venta.
 *
 * Un namespace sin un solo ajuste editable. No es un archivo vacío: es lo que
 * hace que la única variable de esta extensión APAREZCA en el buscador central
 * de ajustes con su razón escrita al lado, en vez de seguir siendo invisible.
 * Mismo criterio que `descriptors/mercadopago.ts`.
 *
 * ─── POR QUÉ `NEXT_PUBLIC_BASE_URL` NO ES DE NADIE ───────────────────────────
 *
 * Es el segundo eslabón de una cascada que empieza en `STOREFRONT_URL`
 * (`api/admin/checkout-links/helpers.ts:10-14`): el link público de un carrito
 * armado se construye con el origen del storefront, y si no hay ninguno queda
 * relativo.
 *
 * No la posee esta extensión por dos razones independientes:
 *
 *  1. NO ES SUYA. `STOREFRONT_URL` es una env del CORE (está en el App Spec que
 *     `project-composer` le genera a todo proyecto) y `NEXT_PUBLIC_BASE_URL` es
 *     su alias; las leen también abandoned-cart, recurring-orders, ai-assistant
 *     y el SEO. Si la declarara acá como ajuste editable, esta card sería un
 *     editor del origen de TODO el backend escondido en "Links de Venta", y
 *     chocaría con el test que prohíbe la misma env en dos namespaces.
 *
 *  2. ES DE INSTALACIÓN, NO DE OPERACIÓN. El prefijo `NEXT_PUBLIC_` no es
 *     decorativo: Next la hornea en el bundle del storefront en tiempo de build.
 *     Una fila en `site_setting` cambiaría el link que arma el backend y NO el
 *     dominio que sirve la página — o sea, se podrían generar links a un host
 *     que el storefront no conoce. Se configura junto con el dominio, en el
 *     panel de deploy, y ahí se queda.
 */
export default defineSettings({
  namespace: 'extension:checkout-links',
  title: 'Links de Venta',
  /** Sin ajustes editables, el scope no resuelve nada; se declara el honesto. */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'NEXT_PUBLIC_BASE_URL',
      /**
       * UNA oración. Las tres cosas que decía de más —la cascada desde
       * `STOREFRONT_URL`, que el link queda RELATIVO si no hay origen, y que
       * guardarla en la base cambiaría el link que genera el backend pero no el
       * dominio que sirve la página— están completas en el drawer, sección "El
       * dominio del link sale del entorno, no de esta pantalla". El encabezado de
       * este archivo las conserva para quien edita el descriptor.
       */
      reason:
        'Origen público del storefront, y sólo como fallback de `STOREFRONT_URL` (`api/admin/checkout-links/helpers.ts:10-14`): es infraestructura de la instalación, no configuración de esta extensión.',
    },
  ],
  settings: [],
});
