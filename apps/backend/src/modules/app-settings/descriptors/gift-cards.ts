import { defineSettings } from './types';

/**
 * Ajustes de Gift Card Experience.
 *
 * El manifest declara 4 variables y el código usa exactamente esas 4 — sin
 * deriva. Pero dos de ellas NO pueden vivir en la tabla, cada una por un motivo
 * distinto y por motivos que valen para toda la migración; están en `envOnly`.
 *
 * ACTUALIZACIÓN — apareció una QUINTA: `DEFAULT_COUNTRY_CODE`. No está en el
 * `environment[]` del manifest y el código la lee en tres lugares, así que la
 * auditoría de `env-coverage.test.ts` la encontró como deriva. También va
 * `envOnly`, por la regla "si es de infraestructura o de instalación, no es de
 * nadie" (`docs/recipes/migrar-env-vars-a-app-settings.md`); el detalle está en
 * su `reason`.
 *
 * PENDIENTE DE ENSAMBLAJE: mientras el manifest siga declarando 4, el cruce
 * `descriptores ↔ environment[]` de `manifest-drift.test.ts` la va a marcar, y
 * la entrada `'gift-cards': ['DEFAULT_COUNTRY_CODE']` de `PENDING_UNDECLARED_ENV`
 * queda muerta. Se cierra agregándola a `mercatto-component.json` y a
 * `component-metadata.js` (`pnpm site:components:extract`) y borrando esa
 * entrada del ratchet.
 *
 * Sobre el kill switch: `GIFT_CARD_EXPERIENCE_ENABLED` es el interruptor de
 * DESPLIEGUE y se combina con AND contra `gift_card_settings.enabled`, que es el
 * interruptor de NEGOCIO que ya se edita más arriba en esta misma pantalla. Los
 * dos tienen que estar prendidos. No es redundancia: el de negocio lo maneja
 * quien opera la tienda, y éste es el que deja apagada la extensión entera en un
 * entorno donde todavía no se quiere que emita nada.
 */
export default defineSettings({
  namespace: 'extension:gift-cards',
  title: 'Gift Card Experience',
  /**
   * main puso `site_id` en `gift_card_settings` y en `gift_card_design`: los diseños
   * son branding y el mail hereda la tienda de la orden.
   */
  defaultScope: 'site',
  envOnly: [
    {
      key: 'GIFT_CARD_TOKEN_SECRET',
      reason:
        'Deriva las claves AES de los links seguros de gift card (gift-card-experience/crypto.ts:6-15, scrypt + aes-256-gcm); una KEK no puede vivir cifrada en la misma tabla que protege. Misma categoría que JWT_SECRET y APP_SETTINGS_ENC_KEY. Mínimo 32 caracteres o el módulo tira.',
    },
    {
      key: 'STOREFRONT_URL',
      reason:
        'URL compartida por todo el backend (invitaciones, reset de contraseña, carritos abandonados, SEO, OAuth del MCP); se gestiona en un namespace propio. Si la declarara esta extensión, se pisaría con las otras ~15 que la usan.',
    },
    {
      key: 'DEFAULT_COUNTRY_CODE',
      reason:
        'Configuración REGIONAL de la instalación, no de gift cards: es el segmento de país de las URLs del storefront (/ar/...) y la leen también el importador de tiendas, el ERP y Typesense. Acá sólo se usa para armar el link de la gift card (gift-card-experience/delivery.ts:22, lifecycle.ts:20 y api/admin/gift-card-experience/deliveries/[id]/secure-link/route.ts:15), siempre con "ar" de respaldo. Se configura en el entorno junto con el dominio y las regiones; dos cards editando el país es cómo se termina con links a un país y precios en otro.',
    },
  ],
  settings: [
    {
      key: 'GIFT_CARD_EXPERIENCE_ENABLED',
      scope: 'instance',
      env: ['GIFT_CARD_EXPERIENCE_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Extensión habilitada en este entorno',
      // Una oración. Que se combine con "Extensión operativa" con AND es de la
      // extensión —dos interruptores en pantallas distintas— y es literalmente la
      // primera sección del drawer, "Dos interruptores, y hacen falta los dos".
      help: 'Interruptor general: apagado, no se emite ni se entrega nada y el job de reconciliación no corre.',
      default: false,
    },
    {
      key: 'SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY',
      scope: 'instance',
      env: ['SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Entregas',
      label: 'Clave del webhook de eventos de SendGrid',
      // Una oración, y la que se conserva es la operativa: de DÓNDE se copia el valor
      // es lo único que no se puede adivinar parado frente al campo. Qué pasa sin ella
      // está en "El webhook de eventos de SendGrid" del drawer.
      help: 'Se copia tal cual de SendGrid (Settings → Mail Settings → Signed Event Webhook), en base64 y una sola línea.',
    },
  ],
});
