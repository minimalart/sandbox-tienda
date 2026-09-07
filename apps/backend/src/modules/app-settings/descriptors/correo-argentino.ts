import { defineSettings } from './types';

/**
 * Ajustes de Correo Argentino.
 *
 * Es la extensión con más variables del repo (42) y la que más se equivoca al
 * clasificar, así que las tres decisiones de fondo van escritas acá y no en el
 * commit:
 *
 * 1. **`defaultScope: 'site'`, con once excepciones explícitas.** Casi todo lo de
 *    Correo es del COMERCIANTE —el acuerdo comercial, la dirección de despacho, el
 *    remitente, el tipo de servicio contratado— y en multitienda cada tienda tiene
 *    el suyo. Lo que NO varía por tienda es a QUÉ SERVIDOR se le pega
 *    (`TEST_MODE`, los dos hostnames, los dos base paths), qué unidad usa el
 *    catálogo (`PRODUCT_WEIGHT_UNIT`), los techos físicos que impone la API
 *    (`MAX_WEIGHT_G`, `MAX_DIMENSION_CM`, `AFORO_DIVISOR`) y la página pública de
 *    seguimiento (`TRACKING_BASE_URL`, `TRACKING_BUSINESS_HOURS_ONLY`). Esos van
 *    `scope: 'instance'`: si fueran `site`, una tienda secundaria que no los
 *    declaró quedaría en fail-closed y el síntoma sería "en la tienda B el
 *    checkout dice Gratuito", sin un solo error.
 *
 * 2. **Cinco credenciales viven TAMBIÉN en `site_credential`.** `API_KEY`,
 *    `SELLER_ID`, `MICORREO_USER`, `MICORREO_PASS`, `CUSTOMER_ID` y —desde esta
 *    migración— `AGREEMENT` están en el catálogo de
 *    `api/admin/site-credentials/catalog.ts`, y ese blob GANA sobre lo que
 *    resuelva este namespace (`applyCorreoSiteCredentials`). No es duplicación:
 *    son dos sistemas de cifrado con dos claves distintas a propósito (ver la nota
 *    de `resolve.ts`), y el descriptor es el que hace que la variable siga
 *    apareciendo en el buscador central y en el instalador. Mismo arreglo que
 *    `KAPSO_API_KEY`, que es descriptor Y clave de `site_credential`.
 *
 * 3. **`AGREEMENT` es la variable más peligrosa del namespace.** Viaja como header
 *    en CADA request a paqar (`clients/paqar-client.ts:152`), queda estampada en
 *    `fulfillment.data` y el `trackingNumber` propio se deriva de ella. Una tienda
 *    despachando contra el acuerdo de otra factura el flete a un CUIT ajeno y la
 *    colisión de TN dentro de un agreement es IRRECUPERABLE. Por eso es `site` y
 *    por eso se agregó a `site_credential`.
 */
export default defineSettings({
  namespace: 'extension:correo-argentino',
  title: 'Correo Argentino',
  defaultScope: 'site',
  envOnly: [
    {
      key: 'CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE',
      reason:
        'Medusa hornea el cron al arrancar (job-loader.js:69-78): no se puede reprogramar en runtime. El job igual se saltea solo cuando no hay API key, y la ventana horaria sí se configura acá ("Sincronizar solo en horario hábil").',
    },
    {
      key: 'CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS',
      reason:
        'La leen SÓLO los scripts de seed (`scripts/seed-correo-domicilio.ts` y `-sucursal.ts`), que corren por CLI con su propio entorno y sin contenedor de Medusa. Un valor en la base no llegaría nunca a esa ejecución.',
    },
  ],
  settings: [
    // ─── Conexión ────────────────────────────────────────────────────────────
    // Todo este grupo es `instance`: a qué servidor se le pega la instalación no
    // es una decisión de la tienda, y ponerlo por tienda dejaría a las secundarias
    // sin host por fail-closed.
    {
      key: 'CORREO_ARGENTINO_TEST_MODE',
      env: ['CORREO_ARGENTINO_TEST_MODE'],
      type: 'boolean',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Modo de prueba',
      help: 'Apunta las dos APIs a `apitest.correoargentino.com.ar`. Los envíos creados en test NO existen para Correo.',
      default: false,
    },
    {
      key: 'CORREO_ARGENTINO_HOSTNAME',
      env: ['CORREO_ARGENTINO_HOSTNAME'],
      type: 'string',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      // Sin default A PROPÓSITO: el host se DERIVA de "Modo de prueba" cuando esto
      // está vacío (`env-options.ts:136-138`). Un default acá cortaría esa
      // derivación y el switch de test dejaría de tener efecto.
      label: 'Host de la API (paqar)',
      help: 'Vacío = se deriva de "Modo de prueba". Sólo se completa para apuntar a un host propio. Se ignora el `https://` pegado.',
      placeholder: 'api.correoargentino.com.ar',
      maxLength: 253,
    },
    {
      key: 'CORREO_ARGENTINO_PAQAR_BASE_PATH',
      env: ['CORREO_ARGENTINO_PAQAR_BASE_PATH'],
      type: 'string',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Path base de paqar',
      help: 'Existe porque Correo YA movió la URL dos veces. Un `/paqar/v2` tiene que ser un cambio de configuración, no un deploy.',
      default: '/paqar/v1',
      maxLength: 128,
    },
    {
      key: 'CORREO_ARGENTINO_MICORREO_HOSTNAME',
      env: ['CORREO_ARGENTINO_MICORREO_HOSTNAME'],
      type: 'string',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Host de la API de cotización (MiCorreo)',
      help: 'Desacopla el host de MiCorreo del de paqar. El caso real: operar en test y cotizar en prod, porque el sandbox de MiCorreo suele no responder. Vacío = el mismo que paqar.',
      placeholder: 'api.correoargentino.com.ar',
      maxLength: 253,
    },
    {
      key: 'CORREO_ARGENTINO_MICORREO_BASE_PATH',
      env: ['CORREO_ARGENTINO_MICORREO_BASE_PATH'],
      type: 'string',
      tier: 'runtime',
      scope: 'instance',
      group: 'Conexión',
      label: 'Path base de MiCorreo',
      default: '/micorreo/v1',
      maxLength: 128,
    },

    // ─── Cuenta y acuerdo ────────────────────────────────────────────────────
    {
      key: 'CORREO_ARGENTINO_API_KEY',
      env: ['CORREO_ARGENTINO_API_KEY'],
      type: 'secret',
      tier: 'runtime',
      group: 'Cuenta y acuerdo',
      label: 'API key de paqar',
      help: 'Autentica cada request a paqar (header `Apikey`). La planilla de Correo trae la celda con el prefijo "Apikey " ya puesto: pegala igual, el módulo lo saca.',
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_AGREEMENT',
      env: ['CORREO_ARGENTINO_AGREEMENT'],
      type: 'string',
      tier: 'runtime',
      group: 'Cuenta y acuerdo',
      label: 'Número de acuerdo',
      help: 'El acuerdo comercial contra el que se factura CADA envío. Viaja en todas las llamadas a paqar y queda estampado en el fulfillment. En multitienda, tiene que ser el de ESTA tienda.',
      placeholder: '18018',
      maxLength: 32,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_SELLER_ID',
      env: ['CORREO_ARGENTINO_SELLER_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'Cuenta y acuerdo',
      // Sin default: cuando falta, `normalizeCorreoOptions` usa el `agreement`
      // (el manual los trata como intercambiables en varios ejemplos). Un default
      // literal acá rompería ese enlace.
      label: 'Seller ID',
      help: 'Identidad del vendedor en el alta de envíos y en los rótulos. Vacío = se usa el número de acuerdo.',
      maxLength: 64,
    },
    {
      key: 'CORREO_ARGENTINO_EXT_CLIENT',
      env: ['CORREO_ARGENTINO_EXT_CLIENT'],
      type: 'string',
      tier: 'runtime',
      group: 'Cuenta y acuerdo',
      label: 'Cliente externo (3 dígitos)',
      help: 'Sufijo del acuerdo en las consultas de tracking. EXACTAMENTE 3 dígitos o se descarta: mandarlo mal es peor que omitirlo (omitido, Correo appendea "000").',
      placeholder: '001',
      pattern: '^\\d{3}$',
      maxLength: 3,
    },

    // ─── MiCorreo (cotización) ───────────────────────────────────────────────
    {
      key: 'CORREO_ARGENTINO_MICORREO_USER',
      env: ['CORREO_ARGENTINO_MICORREO_USER'],
      type: 'string',
      tier: 'runtime',
      group: 'MiCorreo (cotización)',
      label: 'Usuario de MiCorreo',
      help: 'Credencial Basic del `POST /token`. OJO: es por INTEGRADOR, no por comerciante — la identidad del comercio va toda en el Customer ID.',
      maxLength: 128,
    },
    {
      key: 'CORREO_ARGENTINO_MICORREO_PASS',
      env: ['CORREO_ARGENTINO_MICORREO_PASS'],
      type: 'secret',
      tier: 'runtime',
      group: 'MiCorreo (cotización)',
      label: 'Contraseña de MiCorreo',
      help: 'Sin usuario + contraseña + Customer ID no hay cotización: TODO envío degrada a $0 y el checkout muestra "Gratuito".',
    },
    {
      key: 'CORREO_ARGENTINO_CUSTOMER_ID',
      env: ['CORREO_ARGENTINO_CUSTOMER_ID'],
      type: 'string',
      tier: 'runtime',
      group: 'MiCorreo (cotización)',
      label: 'Customer ID',
      help: 'La identidad del COMERCIANTE en las tarifas. Es el campo que decide con qué cuenta se cotiza: en multitienda, el de esta tienda.',
      maxLength: 64,
    },

    // ─── Remitente ───────────────────────────────────────────────────────────
    {
      key: 'CORREO_ARGENTINO_SENDER_NAME',
      env: ['CORREO_ARGENTINO_SENDER_NAME'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Nombre del remitente',
      help: 'Lo que ve el comprador en el rótulo. El default "Remitente" no bloquea el alta, pero un envío real con ese nombre es un problema operativo.',
      default: 'Remitente',
      maxLength: 128,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_SENDER_EMAIL',
      env: ['CORREO_ARGENTINO_SENDER_EMAIL'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Email del remitente',
      placeholder: 'despacho@tu-tienda.com',
      maxLength: 254,
    },
    {
      key: 'CORREO_ARGENTINO_SENDER_PHONE',
      env: ['CORREO_ARGENTINO_SENDER_PHONE'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Teléfono fijo del remitente',
      help: 'Se parte en código de área y número al armar el payload.',
      placeholder: '01143210000',
      maxLength: 32,
    },
    {
      key: 'CORREO_ARGENTINO_SENDER_CELLPHONE',
      env: ['CORREO_ARGENTINO_SENDER_CELLPHONE'],
      type: 'string',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Celular del remitente',
      placeholder: '1155550000',
      maxLength: 32,
    },
    {
      key: 'CORREO_ARGENTINO_SENDER_OBSERVATION',
      env: ['CORREO_ARGENTINO_SENDER_OBSERVATION'],
      type: 'text',
      tier: 'runtime',
      group: 'Remitente',
      label: 'Observaciones del remitente',
      help: 'Texto libre que viaja en el envío (referencias para el cadete, horarios de retiro).',
      maxLength: 255,
    },

    // ─── Origen ──────────────────────────────────────────────────────────────
    // `POST /orders` VALIDA la dirección de origen: sin esto el alta se rechaza.
    // Es el fallback campo por campo del stock location del fulfillment, que gana
    // cuando existe (`workflows/correo-generate-tickets.ts:1178-1188`).
    {
      key: 'CORREO_ARGENTINO_ORIGIN_POSTAL_CODE',
      env: ['CORREO_ARGENTINO_ORIGIN_POSTAL_CODE'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Código postal de origen',
      help: 'También es el CP con el que se cotiza. Sin esto, `calculatePrice` degrada a $0.',
      placeholder: '1414',
      maxLength: 12,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_ORIGIN_STREET',
      env: ['CORREO_ARGENTINO_ORIGIN_STREET'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Calle de origen',
      maxLength: 128,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_ORIGIN_NUMBER',
      env: ['CORREO_ARGENTINO_ORIGIN_NUMBER'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Altura de origen',
      maxLength: 16,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_ORIGIN_CITY',
      env: ['CORREO_ARGENTINO_ORIGIN_CITY'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Localidad de origen',
      maxLength: 128,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_ORIGIN_STATE',
      env: ['CORREO_ARGENTINO_ORIGIN_STATE'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Provincia de origen',
      // Sin `pattern`: el payload quiere el código de UNA letra, pero
      // `normalizeProvinceToCode()` acepta también el nombre y el ISO 3166-2 y los
      // colapsa. Un pattern de una letra rechazaría "Buenos Aires", que hoy anda.
      help: 'Se acepta el código de una letra ("B"), el ISO ("AR-B") o el nombre ("Buenos Aires"): el módulo lo normaliza. ⚠️ Correo valida el CP CONTRA la provincia: si no coinciden, el alta se rechaza.',
      placeholder: 'B',
      maxLength: 64,
      required: true,
    },
    {
      key: 'CORREO_ARGENTINO_ORIGIN_FLOOR',
      env: ['CORREO_ARGENTINO_ORIGIN_FLOOR'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Piso de origen',
      maxLength: 16,
    },
    {
      key: 'CORREO_ARGENTINO_ORIGIN_DEPARTMENT',
      env: ['CORREO_ARGENTINO_ORIGIN_DEPARTMENT'],
      type: 'string',
      tier: 'runtime',
      group: 'Origen',
      label: 'Departamento de origen',
      maxLength: 16,
    },

    // ─── Producto y límites ──────────────────────────────────────────────────
    {
      key: 'CORREO_ARGENTINO_SERVICE_TYPE',
      env: ['CORREO_ARGENTINO_SERVICE_TYPE'],
      type: 'enum',
      tier: 'runtime',
      group: 'Producto y límites',
      label: 'Producto por defecto',
      help: '⚠️ "EP" está SIN VERIFICAR contra un acuerdo real: el plugin oficial de Correo manda siempre "CP", incluso cuando el comprador eligió Expreso. Confirmalo con tu ejecutivo de cuenta antes de cambiarlo.',
      options: [
        { value: 'CP', label: 'CP — Clásico' },
        { value: 'EP', label: 'EP — Expreso (sin verificar)' },
      ],
      default: 'CP',
    },
    {
      key: 'CORREO_ARGENTINO_PRODUCT_CATEGORY',
      env: ['CORREO_ARGENTINO_PRODUCT_CATEGORY'],
      type: 'string',
      tier: 'runtime',
      group: 'Producto y límites',
      label: 'Categoría de mercadería',
      help: 'Obligatoria en el payload de cada bulto. Va por tienda porque describe QUÉ vende el comercio.',
      default: 'Mercaderia general',
      maxLength: 64,
    },
    {
      key: 'CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT',
      env: ['CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT'],
      type: 'enum',
      tier: 'runtime',
      scope: 'instance',
      group: 'Producto y límites',
      label: 'Unidad de peso del catálogo',
      help: 'Cómo interpretar `product.weight`. Medusa no impone unidad y el catálogo es UNO solo para toda la instancia: por eso no varía por tienda. Correo pide gramos y la conversión la hace el módulo.',
      options: [
        { value: 'kg', label: 'Kilogramos' },
        { value: 'g', label: 'Gramos' },
      ],
      default: 'kg',
    },
    {
      key: 'CORREO_ARGENTINO_MAX_WEIGHT_G',
      env: ['CORREO_ARGENTINO_MAX_WEIGHT_G'],
      type: 'number',
      tier: 'runtime',
      scope: 'instance',
      group: 'Producto y límites',
      label: 'Peso máximo por envío (g)',
      help: 'Límite DURO de la API de cotización, no comercial: rechaza por encima de 25000 g sea cual sea el techo del acuerdo. Subirlo no habilita nada, sólo mueve dónde falla.',
      min: 1,
      max: 50000,
      step: 100,
      default: 25000,
    },
    {
      key: 'CORREO_ARGENTINO_MAX_DIMENSION_CM',
      env: ['CORREO_ARGENTINO_MAX_DIMENSION_CM'],
      type: 'number',
      tier: 'runtime',
      scope: 'instance',
      group: 'Producto y límites',
      label: 'Lado máximo (cm)',
      help: 'La cotización valida ≤ 150 cm por lado. El techo efectivo es el más chico entre esto y los 999 cm que soporta el campo del payload.',
      min: 1,
      max: 999,
      step: 1,
      default: 150,
    },
    {
      key: 'CORREO_ARGENTINO_AFORO_DIVISOR',
      env: ['CORREO_ARGENTINO_AFORO_DIVISOR'],
      type: 'number',
      tier: 'runtime',
      scope: 'instance',
      group: 'Producto y límites',
      label: 'Coeficiente de aforo',
      help: '⚠️ El 4000 es un valor DE COMUNIDAD: Correo no lo publica. Convierte cm³ a peso facturable, así que tocarlo cambia lo que se le cobra al comprador — pedilo por escrito antes de moverlo.',
      min: 1,
      max: 20000,
      step: 100,
      default: 4000,
    },

    // ─── Fallback de dimensiones ─────────────────────────────────────────────
    // OPT-IN: con esto apagado, un producto sin medidas ABORTA la cotización con
    // un error que lista los ofensores, en vez de inventar un bulto.
    {
      key: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED',
      env: ['CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Fallback de dimensiones',
      label: 'Usar medidas de reemplazo',
      help: 'Prendido, un producto sin medidas cotiza igual con las de abajo. Si son más chicas que el bulto real, la diferencia la factura Correo después: es una decisión comercial, no técnica.',
      default: false,
    },
    {
      key: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH',
      env: ['CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH'],
      type: 'number',
      tier: 'runtime',
      group: 'Fallback de dimensiones',
      label: 'Largo de reemplazo (cm)',
      min: 1,
      max: 999,
      step: 1,
      default: 30,
    },
    {
      key: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH',
      env: ['CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH'],
      type: 'number',
      tier: 'runtime',
      group: 'Fallback de dimensiones',
      label: 'Ancho de reemplazo (cm)',
      min: 1,
      max: 999,
      step: 1,
      default: 20,
    },
    {
      key: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT',
      env: ['CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT'],
      type: 'number',
      tier: 'runtime',
      group: 'Fallback de dimensiones',
      label: 'Alto de reemplazo (cm)',
      min: 1,
      max: 999,
      step: 1,
      default: 15,
    },
    {
      key: 'CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT',
      env: ['CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT'],
      type: 'number',
      tier: 'runtime',
      group: 'Fallback de dimensiones',
      label: 'Peso de reemplazo por unidad',
      help: 'En la unidad del catálogo (kg por defecto), no en gramos.',
      min: 0.001,
      max: 50,
      step: 0.1,
      default: 0.5,
    },

    // ─── Operación ───────────────────────────────────────────────────────────
    {
      key: 'CORREO_ARGENTINO_AUTO_FULFILL',
      env: ['CORREO_ARGENTINO_AUTO_FULFILL'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Crear el fulfillment al pagar',
      help: 'Automatiza el paso administrativo de Medusa. OJO: NO crea el envío en Correo — eso sigue siendo on-demand desde el admin.',
      default: false,
    },
    {
      key: 'CORREO_ARGENTINO_SELF_GENERATED_TN',
      env: ['CORREO_ARGENTINO_SELF_GENERATED_TN'],
      type: 'boolean',
      tier: 'runtime',
      group: 'Operación',
      label: 'Generar el número de seguimiento acá',
      help: '⚠️ DEJALO APAGADO hasta que Correo confirme POR ESCRITO el formato pactado. Compra idempotencia (un alta que timeoutea se reconoce como duplicada en vez de crear un segundo envío y pagar flete doble), pero un formato no pactado puede ser rechazado y una colisión dentro del acuerdo es IRRECUPERABLE.',
      default: false,
    },
    {
      key: 'CORREO_ARGENTINO_TN_PREFIX',
      env: ['CORREO_ARGENTINO_TN_PREFIX'],
      type: 'string',
      tier: 'runtime',
      group: 'Operación',
      label: 'Prefijo del número propio',
      help: 'Sólo aplica con el número de seguimiento propio prendido. Alfanumérico, hasta 6 caracteres.',
      pattern: '^[A-Za-z0-9]{1,6}$',
      maxLength: 6,
      default: 'MER',
    },
    {
      key: 'CORREO_ARGENTINO_TRACKING_BASE_URL',
      env: ['CORREO_ARGENTINO_TRACKING_BASE_URL'],
      type: 'url',
      tier: 'runtime',
      scope: 'instance',
      group: 'Operación',
      label: 'URL pública de seguimiento',
      help: 'La página que se le manda al comprador, no una API: si está mal, el síntoma es un link roto. Va por instancia porque es la web de Correo, la misma para todas las tiendas.',
      default: 'https://www.correoargentino.com.ar/formularios/e-commerce',
    },
    {
      key: 'CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY',
      env: ['CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY'],
      type: 'boolean',
      tier: 'runtime',
      scope: 'instance',
      group: 'Operación',
      label: 'Sincronizar sólo en horario hábil',
      help: 'Restringe el job de tracking a 8–21 ART. Es el kill switch que reemplaza a editar el cron, que se hornea al arrancar.',
      default: false,
    },
  ],
});
