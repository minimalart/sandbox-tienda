import { defineSettings } from './types';

/**
 * Ajustes de recuperación de carritos abandonados.
 *
 * El manifest declaraba `environment: []` y el código lee 10 variables: hasta
 * este archivo, la cadencia de la secuencia de mails —lo más obviamente de
 * negocio que tiene la extensión— sólo se podía cambiar con un deploy.
 *
 * TRES DECISIONES QUE NO SON OBVIAS, y que hay que respetar al editar esto:
 *
 * 1. `defaultScope: 'instance'` para las siete, aunque "la cadencia de mails por
 *    tienda" suene a lo más `site` del mundo. El motivo es la invariante "se
 *    escribe donde se lee" de `precedence.ts:192`: el único lector es
 *    `getAbandonedCartSettings()`, que va por el camino SINCRÓNICO
 *    (`resolveSettingSync`), y ese camino resuelve con `SiteKind = 'none'` — lee
 *    la fila GLOBAL y NUNCA la de la tienda. Con `scope: 'site'`, el admin con
 *    una tienda activa escribiría en la fila de esa tienda y el barrido seguiría
 *    corriendo con la global: la perilla giraría y no gobernaría nada, sin un
 *    error en ningún lado.
 *
 *    Y no alcanza con "propagar la `SiteResolution`", que es el arreglo de fondo
 *    que documenta `resolve.ts:250-257`: `scan-abandoned-carts.ts` calcula UNA
 *    ventana de detección con UNA config y hace UNA query paginada sobre los
 *    carritos de todas las tiendas. Honrar tres cadencias distintas no es pasar
 *    un parámetro, es rehacer el barrido por tienda. El día que se haga, esto
 *    pasa a `site` y este comentario se borra; hasta entonces, `instance` es lo
 *    único que no miente.
 *
 * 2. EL ORDEN DE LOS TRES PASOS NO SE PUEDE VALIDAR ACÁ, y hace falta saberlo.
 *    La secuencia sólo tiene sentido con `PASO 1 < PASO 2 < PASO 3` (son horas
 *    de inactividad ACUMULADAS, no entre pasos). Ni el descriptor declarativo ni
 *    `refine` alcanzan:
 *
 *      - `min`/`max` son por campo y rangos disjuntos serían una jaula arbitraria
 *        (obligarían a que el paso 2 no pueda ser a las 12 h).
 *      - `refine(value)` recibe UN valor y nada más (`validate.ts:42-45`), y
 *        `buildWritePlan` valida clave por clave: no hay forma de mirar a los
 *        hermanos del mismo POST.
 *      - Un `refine` que leyera el valor guardado del hermano tendría que
 *        importar el resolver, y este archivo lo importa TAMBIÉN el bundle del
 *        admin (ver la nota de `types.ts`): metería `node:crypto` en el browser.
 *        Además compararía contra lo GUARDADO, no contra lo que se está
 *        guardando, así que daría errores falsos y dejaría pasar los reales.
 *
 *    Entonces el orden se garantiza donde SÍ se ven los tres juntos:
 *    `abandoned-cart/settings.ts:orderedStepHours()`, que es pura y está
 *    testeada. Un orden inválido no rompe: se normaliza. Lo que importa es que
 *    ese es el lugar, y no éste.
 *
 * 3. `ABANDONED_CART_SCAN_CRON` va en `envOnly` y `ABANDONED_CART_ENABLED` no.
 *    La diferencia es de MOMENTO: el `schedule:` lo hornea el job loader al
 *    arrancar (`job-loader.js:69-78`), cuando la base todavía no se consultó; el
 *    `enabled` se evalúa DENTRO del cuerpo del job
 *    (`jobs/scan-abandoned-carts.ts:71`), o sea en cada corrida, así que apagarlo
 *    desde el admin tiene efecto en la corrida siguiente sin reiniciar.
 */
export default defineSettings({
  namespace: 'extension:abandoned-cart',
  title: 'Carritos abandonados',
  /** Ver la nota 1 del encabezado antes de poner un `scope: 'site'` acá. */
  defaultScope: 'instance',
  envOnly: [
    {
      key: 'ABANDONED_CART_SCAN_CRON',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): un valor en base no se podría aplicar sin reiniciar. Para apagar el barrido usá "Recuperación activa", que se evalúa en cada corrida.',
    },
    {
      key: 'NEXT_PUBLIC_BASE_URL',
      reason:
        'Es de INSTALACIÓN, no de esta extensión: el storefront la necesita en build time para armar los links absolutos, así que tiene que estar en el entorno antes de que exista base alguna. La leen también recurring-orders, checkout-links y ai-assistant; ninguna es la dueña. Acá sólo se usa como base del link de recuperación del carrito (abandoned-cart/lib.ts:186).',
    },
    {
      key: 'STOREFRONT_DEFAULT_COUNTRY',
      reason:
        'Es de INSTALACIÓN: la resuelve la configuración regional del proyecto y la comparten todas las extensiones que arman URLs del storefront. Acá sólo tapa el hueco cuando el carrito no tiene país propio (abandoned-cart/lib.ts:189). Ponerla en esta card daría a entender que cambiarla acá cambia el prefijo de país de todo el sitio, y no es así.',
    },
  ],
  settings: [
    // ─── Operación ───────────────────────────────────────────────────────────
    {
      key: 'ABANDONED_CART_ENABLED',
      env: ['ABANDONED_CART_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Recuperación activa',
      help: 'Apagado, el barrido corta al principio: no detecta carritos nuevos, no manda recordatorios y TAMPOCO reconcilia los que ya se compraron — o sea que la tasa de recuperación se congela, no baja. Los trackings existentes quedan donde están. Se evalúa en cada corrida, así que aplica sin reiniciar.',
      default: true,
    },

    // ─── Secuencia ───────────────────────────────────────────────────────────
    // Horas de inactividad ACUMULADAS desde la última actividad del carrito, no
    // entre pasos. El orden lo garantiza `settings.ts` — ver la nota 2.
    {
      key: 'ABANDONED_CART_STEP1_HOURS',
      env: ['ABANDONED_CART_STEP1_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Secuencia',
      label: 'Paso 1: horas de inactividad',
      help: 'También es el UMBRAL DE DETECCIÓN: un carrito no se trackea hasta llegar acá, así que subirlo no sólo demora el primer mail, achica cuántos carritos entran al embudo. El paso 1 manda sólo email.',
      min: 1,
      max: 720,
      step: 1,
      default: 1,
    },
    {
      key: 'ABANDONED_CART_STEP2_HOURS',
      env: ['ABANDONED_CART_STEP2_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Secuencia',
      label: 'Paso 2: horas de inactividad',
      help: 'Tiene que ser mayor que el paso 1 (si no, la secuencia se reordena sola y el paso 1 no se manda nunca). Es el único paso que además manda WhatsApp, y sólo si la plantilla `KAPSO_TEMPLATE_CART_ABANDONED_2` tiene valor.',
      min: 1,
      max: 720,
      step: 1,
      default: 24,
    },
    {
      key: 'ABANDONED_CART_STEP3_HOURS',
      env: ['ABANDONED_CART_STEP3_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Secuencia',
      label: 'Paso 3: horas de inactividad',
      help: 'El último de la secuencia, el del incentivo. Tiene que ser mayor que el paso 2 y menor que la ventana de recuperación: por encima de ella el carrito ya salió de la ventana y el paso 3 no se manda nunca.',
      min: 1,
      max: 720,
      step: 1,
      default: 72,
    },
    {
      key: 'ABANDONED_CART_MAX_AGE_HOURS',
      env: ['ABANDONED_CART_MAX_AGE_HOURS'],
      type: 'number',
      tier: 'runtime',
      group: 'Secuencia',
      label: 'Ventana de recuperación (horas)',
      help: 'Los carritos más viejos que esto dejan de molestarse: quedan fuera de la detección y de la notificación. Bajarlo por debajo del paso 3 lo deja inalcanzable. El default son 14 días.',
      min: 1,
      max: 8760,
      step: 1,
      default: 336,
    },

    // ─── Rendimiento ─────────────────────────────────────────────────────────
    // No son de negocio: acotan cuánto trabajo hace UNA corrida del barrido.
    {
      key: 'ABANDONED_CART_BATCH_SIZE',
      env: ['ABANDONED_CART_BATCH_SIZE'],
      type: 'number',
      tier: 'runtime',
      group: 'Rendimiento',
      label: 'Carritos por página',
      help: 'Tamaño de página de la detección, y también el tope de trackings a reconciliar y a notificar por corrida. Subirlo baja la cantidad de queries y sube el pico de memoria.',
      min: 1,
      max: 1000,
      step: 1,
      default: 100,
    },
    {
      key: 'ABANDONED_CART_MAX_PAGES',
      env: ['ABANDONED_CART_MAX_PAGES'],
      type: 'number',
      tier: 'runtime',
      group: 'Rendimiento',
      label: 'Páginas por corrida',
      help: 'Junto con el tamaño de página define el techo de trabajo: se revisan como mucho `páginas × carritos` por corrida. Al llegar al tope se loguea un warning con el truncamiento — nunca se corta en silencio. Si ese warning aparece seguido, subí esto o acortá la ventana de recuperación.',
      min: 1,
      max: 500,
      step: 1,
      default: 20,
    },
  ],
});
