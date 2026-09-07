/**
 * Qué integraciones aceptan credenciales por tienda, y con qué claves.
 *
 * El catálogo NO se inventa: cada `integration` es el string EXACTO que el
 * provider le pasa a `readSiteCredentialsViaSql`, y cada `key` sale del tipo
 * genérico de ese mismo call site. Si acá dijera `correo_argentino` en vez de
 * `correo-argentino`, la credencial se guardaría en una fila que nadie lee y la
 * tienda seguiría cotizando con la cuenta del entorno, sin un solo error.
 * `catalog.test.ts` cruza estos strings contra el fuente de los providers.
 *
 * `reader: null` significa que la integración TODAVÍA no lee de `site_credential`.
 * Esas no se pueden guardar: la ruta las rechaza. Guardar un secreto que nada
 * consume no es "adelantar trabajo", es dejar una pantalla que miente —el operador
 * ve la credencial cargada y el checkout sigue cobrando a la cuenta global—, que es
 * exactamente la media migración que el registro de `scoped-routes.ts` existe para
 * evitar. Aparecen en el GET a propósito: el mapa completo es lo que hace falta para
 * planificar el fail-closed.
 */

export type CredentialKeySpec = {
  key: string;
  label: string;
  /** Sólo un hint de UI (input type=password). El GET nunca devuelve valores. */
  secret: boolean;
  help?: string;
};

export type IntegrationSpec = {
  /** El string exacto que el provider le pasa a `readSiteCredentialsViaSql`. */
  integration: string;
  label: string;
  keys: CredentialKeySpec[];
  /**
   * Vars de entorno que cubren esta integración a nivel instancia. Se usan SÓLO
   * para saber si existe un fallback (`process.env.X` presente), nunca su valor.
   */
  envKeys: string[];
  /** Archivo que lee estas credenciales, o `null` si todavía no hay lector. */
  reader: string | null;
  /** Por qué no hay lector todavía. Obligatorio cuando `reader` es `null`. */
  blockedReason?: string;
};

export const CREDENTIAL_CATALOG: IntegrationSpec[] = [
  {
    integration: 'arca',
    label: 'ARCA / AFIP (consulta de CUIT)',
    reader: null,
    blockedReason:
      'BLOQUEADA por tienda. La cuenta de Minimalart se administra en Integraciones → Globales → ARCA / AFIP. Las credenciales antiguas por tienda ya no se utilizan.',
    envKeys: ['ARCA_CERTIFICATE_BASE64', 'ARCA_PRIVATE_KEY_BASE64', 'ARCA_CUIT_REPRESENTADA'],
    keys: [
      {
        key: 'certificateBase64',
        label: 'Certificado X.509',
        secret: true,
        help: 'El certificado que AFIP emitió para el CUIT de abajo, en base64 o pegado como PEM crudo. Se acepta cualquiera de las dos formas.',
      },
      {
        key: 'privateKeyBase64',
        label: 'Clave privada',
        secret: true,
        help: 'La clave privada del par, en base64 o PEM crudo. Nunca sale del backend: la pantalla sólo puede decir si está cargada.',
      },
      {
        key: 'cuitRepresentada',
        label: 'CUIT representada',
        secret: false,
        help: 'Los 11 dígitos del contribuyente en cuyo nombre se consulta. TIENE que ser el mismo para el que se emitió el certificado, y por eso se carga acá y no en la card: cargar uno sin el otro deja el certificado de un titular declarando ser otro.',
      },
    ],
  },
  {
    integration: 'andreani',
    label: 'Andreani',
    reader: 'src/modules/andreani-fulfillment/service.ts',
    envKeys: ['ANDREANI_USERNAME', 'ANDREANI_PASSWORD', 'ANDREANI_CONTRACT'],
    keys: [
      { key: 'username', label: 'Usuario', secret: false },
      { key: 'password', label: 'Contraseña', secret: true },
      { key: 'contract', label: 'Contrato', secret: false },
      { key: 'clientCode', label: 'Código de cliente', secret: false },
    ],
  },
  {
    integration: 'correo-argentino',
    label: 'Correo Argentino',
    // El lector se mudó de `service.ts` a este archivo cuando el workflow de
    // tickets —el único camino que CREA envíos— pasó a leer credenciales por
    // tienda. Antes había un solo lector (el provider, que sólo cotizaba) y el
    // alta usaba las del entorno.
    reader: 'src/modules/correo-argentino-fulfillment/site-credentials.ts',
    envKeys: [
      'CORREO_ARGENTINO_API_KEY',
      'CORREO_ARGENTINO_AGREEMENT',
      'CORREO_ARGENTINO_MICORREO_USER',
      'CORREO_ARGENTINO_MICORREO_PASS',
    ],
    keys: [
      { key: 'micorreoUser', label: 'Usuario MiCorreo', secret: false },
      { key: 'micorreoPassword', label: 'Contraseña MiCorreo', secret: true },
      { key: 'apiKey', label: 'API key (Paqar)', secret: true },
      {
        key: 'agreement',
        label: 'Número de acuerdo',
        secret: false,
        help: 'El acuerdo comercial contra el que se factura CADA envío de esta tienda. Sin esto, la tienda despacha con el acuerdo del entorno y el flete se le cobra a otro titular.',
      },
      { key: 'sellerId', label: 'Seller ID', secret: false },
      {
        key: 'customerId',
        label: 'Customer ID',
        secret: false,
        help: 'Obligatorio para cotizar con MiCorreo.',
      },
    ],
  },
  {
    integration: 'kapso',
    label: 'Kapso (WhatsApp)',
    reader: 'src/modules/kapso-whatsapp/service.ts',
    envKeys: ['KAPSO_API_KEY'],
    keys: [
      { key: 'apiKey', label: 'API key', secret: true },
      {
        key: 'baseUrl',
        label: 'Base URL',
        secret: false,
        help: 'Opcional: sin esto se usa la URL del entorno.',
      },
    ],
  },
  {
    integration: 'mercadopago',
    label: 'MercadoPago',
    reader: null,
    blockedReason:
      'BLOQUEADA POR EL PROVIDER: `modules/mercado-pago/utils/accounts.ts` resuelve la cuenta ' +
      'con `getAccount`, que es SÍNCRONA y está en el camino del cobro, así que no puede ir a la ' +
      'DB. Hoy el seam es el mapa `MERCADOPAGO_ACCOUNTS` en env. Además son DOS providers ' +
      '(`mercado-pago` y `mercado-pago-api`) que comparten credenciales: migrar uno solo deja ' +
      'medio checkout cobrando en la cuenta equivocada.',
    envKeys: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_ACCOUNTS'],
    keys: [
      { key: 'accessToken', label: 'Access token', secret: true },
      { key: 'publicKey', label: 'Public key', secret: false },
      { key: 'webhookSecret', label: 'Webhook secret', secret: true },
    ],
  },
  {
    integration: 'sendgrid',
    label: 'Email (SendGrid)',
    reader: null,
    blockedReason:
      'BLOQUEADA POR EL EMISOR: cuando se manda un mail NO hay request, así que el `site_id` ' +
      'tiene que viajar en el `data` de la notificación desde decenas de emisores (order, ' +
      'gift-cards, b2b, corporate, abandoned-cart, recurring). La credencial en DB no alcanza. ' +
      'Y `EMAIL_FROM` por tienda exige un sender verificado por tienda en SendGrid: trabajo ' +
      'fuera del código.',
    envKeys: ['SENDGRID_API_KEY'],
    keys: [
      { key: 'apiKey', label: 'API key', secret: true },
      { key: 'from', label: 'Remitente (from)', secret: false },
    ],
  },
];

export const INTEGRATION_IDS = CREDENTIAL_CATALOG.map((entry) => entry.integration);

export const findIntegration = (id: string): IntegrationSpec | undefined =>
  CREDENTIAL_CATALOG.find((entry) => entry.integration === id);

/** ¿Hay credenciales de entorno para esta integración? Mira presencia, nunca valor. */
export const hasEnvCredentials = (spec: IntegrationSpec): boolean =>
  spec.envKeys.some((name) => Boolean(process.env[name]?.trim()));
