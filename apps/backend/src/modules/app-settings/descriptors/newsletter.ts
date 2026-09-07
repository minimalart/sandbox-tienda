import { defineSettings } from './types';

/**
 * Ajustes de Newsletter (Brevo).
 *
 * ─── POR QUÉ TODO ES `runtime` Y NADA ES `envOnly` ──────────────────────────
 *
 * No hay un solo consumidor de estas variables antes del contenedor: la única
 * lectura pasa en `POST /store/newsletter-subscriptions`, que corre con `req.scope`
 * completo y resuelve por tienda. Nada de esto es opción de boot de un provider
 * ni vive en `medusa-config.ts`, así que no hay ningún motivo para bloquear la
 * edición desde el admin — que es justamente lo que este ticket necesitaba:
 * cargar la key de un cliente sin un deploy.
 *
 * ─── POR QUÉ `scope: 'site'` (Y POR QUÉ IMPORTA TANTO ACÁ) ──────────────────
 *
 * La API key de Brevo identifica LA CUENTA DE UN CLIENTE, y la lista es un número
 * chico y reusado — casi todas las cuentas tienen una lista 2. Resolver esto por
 * instancia significa que la tienda B, sin configurar nada, hereda la cuenta de la
 * tienda A y le empieza a escribir contactos adentro. No falla: sincroniza
 * perfectamente contra la base de datos de otra empresa.
 *
 * El fail-closed de `site` es exactamente la protección que hace falta: una tienda
 * que no cargó lo suyo queda APAGADA (`sync_status: 'skipped'`, visible en la
 * pantalla de Suscriptores), no heredando.
 *
 * `BREVO_API_URL` es la excepción declarada: es el endpoint del SaaS, el mismo
 * para todos, y sólo se toca para apuntar a un doble en un entorno de prueba.
 */
export default defineSettings({
  namespace: 'extension:newsletter',
  title: 'Newsletter (Brevo)',
  defaultScope: 'site',
  settings: [
    // ─── Estado ──────────────────────────────────────────────────────────────
    {
      key: 'NEWSLETTER_ENABLED',
      env: ['NEWSLETTER_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Estado',
      label: 'Sincronizar con Brevo',
      help: 'Apagado, el formulario sigue funcionando y las altas se siguen guardando acá: sólo no viajan a Brevo, y quedan como "Sin sincronizar" para poder reintentarlas después. Nunca se le miente al visitante.',
      default: true,
    },

    // ─── Brevo ───────────────────────────────────────────────────────────────
    {
      key: 'BREVO_API_KEY',
      env: ['BREVO_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Brevo',
      label: 'API key',
      help: 'Se saca de Brevo → SMTP & API → API Keys. Autentica el header api-key. Nunca se muestra: sólo se puede reemplazar o borrar.',
      required: true,
    },
    {
      key: 'BREVO_LIST_ID',
      env: ['BREVO_LIST_ID'],
      type: 'number',
      tier: 'runtime',
      group: 'Brevo',
      label: 'ID de la lista',
      help: 'El número que Brevo le da a la lista en Contactos → Listas (aparece en la URL). Es a esa lista y no a otra donde entra cada alta. Sin este valor no se sincroniza nada: adivinar una lista sería escribir en la audiencia equivocada.',
      placeholder: '2',
      min: 1,
      step: 1,
      required: true,
    },
    {
      key: 'BREVO_API_URL',
      env: ['BREVO_API_URL'],
      type: 'url',
      tier: 'runtime',
      scope: 'instance',
      group: 'Brevo',
      label: 'URL de la API',
      help: 'Sólo se cambia para apuntar a un doble en un entorno de prueba. Por defecto, la API pública de Brevo.',
      placeholder: 'https://api.brevo.com/v3',
      default: 'https://api.brevo.com/v3',
    },
  ],
});
