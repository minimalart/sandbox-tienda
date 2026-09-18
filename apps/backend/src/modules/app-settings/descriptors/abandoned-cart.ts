import { defineSettings } from './types';
import { parseCron } from './fragments/cron';

export default defineSettings({
  namespace: 'extension:abandoned-cart',
  title: 'Carritos abandonados',
  defaultScope: 'site',
  envOnly: [
    ...[1, 2, 3].map(step => ({ key: `KAPSO_TEMPLATE_CART_ABANDONED_${step}`, reason: 'Compatibilidad de lectura: la configuración heredada pertenece a extension:whatsapp.' })),
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
    {
      key: 'ABANDONED_CART_SCAN_CRON',
      env: ['ABANDONED_CART_SCAN_CRON'],
      type: 'string',
      tier: 'runtime',
      group: 'Operación',
      label: 'Cron (UTC)',
      help: 'Cinco campos numéricos. Se aplica sin reiniciar.',
      default: '*/15 * * * *',
      refine: (value) => {
        try {
          parseCron(String(value));
          return null;
        } catch {
          return 'Cron inválido / Invalid cron (UTC).';
        }
      },
    },
    ...[1, 2, 3].flatMap((step) => [
      {
        key: `ABANDONED_CART_EMAIL_TEMPLATE_${step}`,
        env: [`ABANDONED_CART_EMAIL_TEMPLATE_${step}`],
        type: 'string' as const,
        tier: 'runtime' as const,
        group: 'Plantillas',
        label: `Paso ${step}: plantilla de email`,
        help: 'Identificador de plantilla. Usá none para desactivar este canal.',
        default: `cart-abandoned-${step}`,
        maxLength: 200,
      },
      {
        key: `ABANDONED_CART_WHATSAPP_TEMPLATE_${step}`,
        env: [`ABANDONED_CART_WHATSAPP_TEMPLATE_${step}`],
        type: 'string' as const,
        tier: 'runtime' as const,
        group: 'Plantillas',
        label: `Paso ${step}: plantilla de WhatsApp`,
        help: 'Nombre de una plantilla aprobada. Usá none para desactivar este canal.',
        default: 'none',
        maxLength: 200,
      },
    ]),
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
      help: 'También es el UMBRAL DE DETECCIÓN: un carrito no se trackea hasta llegar acá, así que subirlo no sólo demora el primer mail, achica cuántos carritos entran al embudo. Los canales dependen de las plantillas configuradas.',
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
      help: 'Tiene que ser mayor que el paso 1 (si no, la secuencia se reordena sola y el paso 1 no se manda nunca). Cada canal usa la plantilla configurada para este paso.',
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
