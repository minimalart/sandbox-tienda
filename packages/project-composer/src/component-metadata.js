/**
 * Contratos de ENV por extensión: son secretos, así que nunca van a la config en DB.
 *
 * `MERCATTO_PLATFORM_URL` / `MERCATTO_PROJECT_ID` / `MERCATTO_PROJECT_SECRET` NO están
 * acá: sus únicos consumidores (`src/api/admin/platform/*`) son CORE desde que se
 * desmanteló site-manager, y `configureProject()` ya inyecta `MERCATTO_PROJECT_ID` en
 * el `.env` de todo proyecto generado, elija las extensiones que elija.
 */
module.exports = {
  // La lista de typesense pasó de 4 a 11 al auditar el código: el manifest
  // declaraba de menos y el instalador nunca pedía las otras siete. Que estén
  // acá es independiente de dónde se guarde el valor — `TYPESENSE_*` sigue
  // siendo env plano por la decisión 2 de EXTENSIONES-MULTITIENDA.md.
  typesense: {
    environment: [
      'DEFAULT_CURRENCY_CODE',
      'TYPESENSE_ANALYTICS_API_KEY',
      'TYPESENSE_ANALYTICS_COLLECTION',
      'TYPESENSE_API_KEY',
      'TYPESENSE_COLLECTION_NAME',
      'TYPESENSE_HOST',
      'TYPESENSE_PORT',
      'TYPESENSE_PROTOCOL',
      'TYPESENSE_RECONCILE_CRON',
      'TYPESENSE_RECONCILE_ENABLED',
      'TYPESENSE_SITE_ANALYTICS_COLLECTIONS',
      'TYPESENSE_SITE_COLLECTIONS',
      'TYPESENSE_SYNC_LOG_PRUNE_CRON',
      'TYPESENSE_SYNC_LOG_RETENTION_DAYS',
    ],
  },
  'media-library': {
    environment: [
      'S3_ACCESS_KEY_ID',
      'S3_BUCKET',
      'S3_ENDPOINT',
      'S3_FILE_URL',
      'S3_FORCE_PATH_STYLE',
      'S3_PREFIX',
      'S3_PUBLIC_URL',
      'S3_REGION',
      'S3_SECRET_ACCESS_KEY',
      'S3_URL',
    ],
  },
  videos: {
    environment: [
      'VIMEO_ACCESS_TOKEN',
      'VIMEO_CLIENT_ID',
      'VIMEO_CLIENT_SECRET',
      'VIMEO_FOLDER_URI',
      'VIMEO_OAUTH_REDIRECT_SUCCESS',
    ],
  },
  'email-templates': {
    environment: [
      'ADMIN_EMAIL',
      'COMPANY_INVITE_SENDGRID_TEMPLATE_ID',
      'CORPORATE_INVITE_SENDGRID_TEMPLATE_ID',
      'EMAIL_FROM',
      'EMAIL_ICONS_BASE_URL',
      'SENDGRID_API_KEY',
    ],
  },
  'gift-cards': {
    environment: [
      'DEFAULT_COUNTRY_CODE',
      'GIFT_CARD_EXPERIENCE_ENABLED',
      'GIFT_CARD_TOKEN_SECRET',
      'SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY',
      'STOREFRONT_URL',
    ],
  },
  andreani: {
    environment: [
      'ANDREANI_AUTO_FULFILL',
      'ANDREANI_CLIENT_CODE',
      'ANDREANI_CONTRACT',
      'ANDREANI_DIMENSION_FALLBACK_ENABLED',
      'ANDREANI_DIMENSION_FALLBACK_HEIGHT',
      'ANDREANI_DIMENSION_FALLBACK_LENGTH',
      'ANDREANI_DIMENSION_FALLBACK_WEIGHT',
      'ANDREANI_DIMENSION_FALLBACK_WIDTH',
      'ANDREANI_DOMICILIO_CONTRACT_OVERRIDE',
      'ANDREANI_HOSTNAME',
      'ANDREANI_ORIGIN_CITY',
      'ANDREANI_ORIGIN_NUMBER',
      'ANDREANI_ORIGIN_POSTAL_CODE',
      'ANDREANI_ORIGIN_PROVINCE',
      'ANDREANI_ORIGIN_STREET',
      'ANDREANI_PASSWORD',
      'ANDREANI_PUNTO_DE_TERCERO_CONTRACT_OVERRIDE',
      'ANDREANI_SENDER_DOC_NUMBER',
      'ANDREANI_SENDER_DOC_TYPE',
      'ANDREANI_SENDER_EMAIL',
      'ANDREANI_SENDER_NAME',
      'ANDREANI_SENDER_PHONE',
      'ANDREANI_SUCURSAL_CONTRACT_OVERRIDE',
      'ANDREANI_TEST_MODE',
      'ANDREANI_TRACKING_BUSINESS_HOURS_ONLY',
      'ANDREANI_TRACKING_SYNC_SCHEDULE',
      'ANDREANI_USERNAME',
    ],
  },
  // Contrato de ENV de Correo Argentino. La lista sale del código, no del PRD:
  // `correo-argentino-fulfillment/env-options.ts` (loadCorreoOptionsFromEnv),
  // `medusa-config.ts` (el gate del provider), `jobs/sync-correo-tracking-status.ts`,
  // `workflows/correo-generate-tickets.ts`, `subscribers/correo-order.ts` y los dos
  // `scripts/seed-correo-*.ts`.
  //
  // NECESARIAS PARA OPERAR (2): `CORREO_ARGENTINO_API_KEY` y `_AGREEMENT`. Ya NO
  // son obligatorias para arrancar: `normalizeCorreoOptions()` dejó de tirar y el
  // provider se registra siempre, porque las dos pueden venir de `site_credential`
  // por tienda y `medusa-config.ts` corre antes de que exista la base. Sin ellas
  // en ningún lado, el carrier queda inerte y lo grita en el log.
  // Todo el resto es opcional con default en `normalizeCorreoOptions()`:
  //   - MICORREO_USER/PASS/CUSTOMER_ID: sin ellas se degrada SÓLO la cotización
  //     (`/rates`); el alta de envíos, los rótulos y el tracking siguen andando.
  //   - ORIGIN_*: default `''`. No tira en el arranque, pero el payload de
  //     `POST /orders` sale incompleto — configurarlas es obligatorio en la
  //     práctica, no en el loader.
  //   - PRODUCT_CATEGORY (default 'Mercaderia general') y PRODUCT_WEIGHT_UNIT
  //     (default 'kg') NO están en el PRD: se agregaron durante la implementación.
  //   - PAQAR_BASE_PATH / MICORREO_BASE_PATH (defaults '/paqar/v1' y
  //     '/micorreo/v1') y MICORREO_HOSTNAME: overrides de URL. Existen porque
  //     Correo ya movió la URL más de una vez y porque las dos APIs no están
  //     obligadas a compartir host (operar en test y cotizar en prod).
  'correo-argentino': {
    environment: [
      'CORREO_ARGENTINO_AFORO_DIVISOR',
      'CORREO_ARGENTINO_AGREEMENT',
      'CORREO_ARGENTINO_API_KEY',
      'CORREO_ARGENTINO_AUTO_FULFILL',
      'CORREO_ARGENTINO_CUSTOMER_ID',
      'CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED',
      'CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT',
      'CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH',
      'CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT',
      'CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH',
      'CORREO_ARGENTINO_EXT_CLIENT',
      'CORREO_ARGENTINO_HOSTNAME',
      'CORREO_ARGENTINO_MAX_DIMENSION_CM',
      'CORREO_ARGENTINO_MAX_WEIGHT_G',
      'CORREO_ARGENTINO_MICORREO_BASE_PATH',
      'CORREO_ARGENTINO_MICORREO_HOSTNAME',
      'CORREO_ARGENTINO_MICORREO_PASS',
      'CORREO_ARGENTINO_MICORREO_USER',
      'CORREO_ARGENTINO_ORIGIN_CITY',
      'CORREO_ARGENTINO_ORIGIN_DEPARTMENT',
      'CORREO_ARGENTINO_ORIGIN_FLOOR',
      'CORREO_ARGENTINO_ORIGIN_NUMBER',
      'CORREO_ARGENTINO_ORIGIN_POSTAL_CODE',
      'CORREO_ARGENTINO_ORIGIN_STATE',
      'CORREO_ARGENTINO_ORIGIN_STREET',
      'CORREO_ARGENTINO_PAQAR_BASE_PATH',
      'CORREO_ARGENTINO_PRODUCT_CATEGORY',
      'CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT',
      'CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS',
      'CORREO_ARGENTINO_SELF_GENERATED_TN',
      'CORREO_ARGENTINO_SELLER_ID',
      'CORREO_ARGENTINO_SENDER_CELLPHONE',
      'CORREO_ARGENTINO_SENDER_EMAIL',
      'CORREO_ARGENTINO_SENDER_NAME',
      'CORREO_ARGENTINO_SENDER_OBSERVATION',
      'CORREO_ARGENTINO_SENDER_PHONE',
      'CORREO_ARGENTINO_SERVICE_TYPE',
      'CORREO_ARGENTINO_TEST_MODE',
      'CORREO_ARGENTINO_TN_PREFIX',
      'CORREO_ARGENTINO_TRACKING_BASE_URL',
      'CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY',
      'CORREO_ARGENTINO_TRACKING_SYNC_SCHEDULE',
    ],
  },
  whatsapp: {
    environment: [
      'KAPSO_API_KEY',
      'KAPSO_BASE_URL',
      'KAPSO_BUSINESS_ACCOUNT_ID',
      'KAPSO_CONFIG_ID',
      'KAPSO_INBOX_EMBED_URL',
      'KAPSO_PHONE_NUMBER_ID',
      'KAPSO_TEMPLATE_CART_ABANDONED_1',
      'KAPSO_TEMPLATE_CART_ABANDONED_2',
      'KAPSO_TEMPLATE_CART_ABANDONED_3',
      'KAPSO_TEMPLATE_RECURRING_ORDER_CREATED',
      'KAPSO_TEMPLATE_RECURRING_ORDER_PAUSED',
      'KAPSO_TEMPLATE_RECURRING_ORDER_RESUMED',
      'KAPSO_TEMPLATE_RECURRING_ORDER_SKIPPED',
      'KAPSO_TEMPLATE_RECURRING_ORDER_CANCELLED',
      'KAPSO_TEMPLATE_RECURRING_ORDER_GENERATED',
      'KAPSO_TEMPLATE_RECURRING_ORDER_UPDATED',
      'KAPSO_TEMPLATE_LANG',
      'KAPSO_TEMPLATE_ORDER_CANCELLED',
      'KAPSO_TEMPLATE_ORDER_CONFIRMATION',
      'KAPSO_TEMPLATE_ORDER_DELIVERY',
      'KAPSO_TEMPLATE_ORDER_TRACKING',
      'KAPSO_TEMPLATE_PASSWORD_RESET',
      'KAPSO_TEMPLATE_RECURRING_ORDER_FAILED',
      'KAPSO_TEMPLATE_RECURRING_PAYMENT_FAILED',
      'KAPSO_TEMPLATE_RECURRING_RENEWAL_READY',
      'KAPSO_TEMPLATE_RECURRING_RENEWAL_UPCOMING',
      'KAPSO_TEMPLATE_RECURRING_RENEWAL_REMINDER',
      'KAPSO_TEMPLATE_RECURRING_STOCK_SKIPPED',
      'KAPSO_TEMPLATE_RECURRING_STOCK_UNAVAILABLE',
      'KAPSO_WEBHOOK_SECRET',
      'KAPSO_WEBHOOK_VERIFY_TOKEN',
      'WHATSAPP_COUNTRY_CODE',
      'WHATSAPP_HANDOFF_AUTO_RESUME_HOURS',
      'WHATSAPP_PLACEHOLDER_IMAGE_URL',
      'WHATSAPP_REGION_ID',
      'WHATSAPP_SALES_CHANNEL_ID',
    ],
  },
  // OPENAI_API_KEY y MCP_MEDUSA_URL no las lee NINGÚN archivo del backend (no hay
  // dependencia de `openai`: todos los modelos salen por OpenRouter). Se declaran
  // igual porque el instalador de apps/platform ya las pide y sacarlas de golpe
  // rompería proyectos existentes; quedan como `envOnly` con esa razón escrita.
  'ai-assistant': {
    environment: [
      'AI_MEMORY_EMBED_CRON',
      'AI_PROPOSALS_AGENT',
      'AI_PROPOSALS_CRON',
      'AI_PROPOSALS_ENGINE',
      'AI_PROPOSALS_LIMIT',
      'AI_PROPOSALS_MAX_STEPS',
      'AI_PROPOSALS_SPECIALIST_STEPS',
      'CHAT_AI_MAX_TOKENS',
      'CHAT_AI_MODEL',
      'CHAT_AI_REASONING_EFFORT',
      'EMBEDDINGS_API_KEY',
      'EMBEDDINGS_BASE_URL',
      'EMBEDDINGS_DIMENSIONS',
      'EMBEDDINGS_MODEL',
      'MCP_AUTH_TOKEN',
      'MCP_MEDUSA_URL',
      'MCP_OAUTH_REDIRECT_BASE',
      'MEDUSA_BACKEND_URL',
      'MEDUSA_BASE_URL',
      'NEXT_PUBLIC_BASE_URL',
      'OPENAI_API_KEY',
      'OPENROUTER_API_KEY',
      'OPENROUTER_SITE_URL',
    ],
  },
  catalogador: {
    environment: [
      'CATALOGADOR_BARCODE_API_KEY',
      'CATALOGADOR_BARCODE_API_URL',
      'CATALOGADOR_IMAGE_MODEL',
      'CATALOGADOR_JOB_SCHEDULE',
      'CATALOGADOR_SCRAPE_SEARCH_TEMPLATE',
      'CATALOGADOR_TAVILY_API_KEY',
      'CATALOGADOR_TEXT_MODEL',
      'OPENROUTER_API_KEY',
      'OPENROUTER_SITE_URL',
    ],
  },
  'seo-geo': {
    environment: [
      'EMBEDDINGS_API_KEY',
      'EMBEDDINGS_BASE_URL',
      'EMBEDDINGS_DIMENSIONS',
      'EMBEDDINGS_MODEL',
      'NEXT_PUBLIC_BASE_URL',
      'OPENROUTER_API_KEY',
      'OPENROUTER_SITE_URL',
      'SEO_GEO_BATCH_PAUSE_MS',
      'SEO_GEO_CONCURRENCY_CAP',
      'SEO_GEO_EMBED_BATCH',
      'SEO_GEO_EMBED_SCHEDULE',
      'SEO_GEO_JOB_SCHEDULE',
      'SEO_GEO_LLM_MODEL',
      'SEO_GEO_MAX_PAGES_CAP',
      'SEO_GEO_SCHEDULE_CHECK',
      'SEO_GEO_STALE_MINUTES',
      'STOREFRONT_URL',
    ],
  },
  ga4: {
    environment: [
      'GA_API_SECRET',
      'GA_DEBUG',
      'GA_MEASUREMENT_ID',
      'GTM_ID',
      'NEXT_PUBLIC_GA_MEASUREMENT_ID',
      'NEXT_PUBLIC_GTM_ID',
    ],
  },
  mercadopago: {
    environment: [
      'MERCADOPAGO_ACCESS_TOKEN',
      'MERCADOPAGO_ACCOUNTS',
      'MERCADOPAGO_API_ENABLED',
      'MERCADOPAGO_ENABLED',
      'MERCADOPAGO_PUBLIC_KEY',
      'MERCADOPAGO_WEBHOOK_SECRET',
    ],
  },

  // ─── Migradas en la segunda ola: no tenían entrada acá, así que su manifest
  //     salía con environment: [] y el instalador no le pedía NADA al cliente.
  //     Cada lista es descriptores ∪ envOnly del namespace, que es exactamente lo
  //     que exige manifest-drift.test.ts. ───────────────────────────────────────
  'abandoned-cart': {
    environment: [
      'ABANDONED_CART_BATCH_SIZE',
      'ABANDONED_CART_ENABLED',
      'ABANDONED_CART_MAX_AGE_HOURS',
      'ABANDONED_CART_MAX_PAGES',
      'ABANDONED_CART_SCAN_CRON',
      'ABANDONED_CART_STEP1_HOURS',
      'ABANDONED_CART_STEP2_HOURS',
      'ABANDONED_CART_STEP3_HOURS',
      'NEXT_PUBLIC_BASE_URL',
      'STOREFRONT_DEFAULT_COUNTRY',
    ],
  },
  b2b: {
    environment: [
      'B2B_SALES_CHANNEL_ID',
    ],
  },
  'checkout-links': {
    environment: [
      'NEXT_PUBLIC_BASE_URL',
    ],
  },
  // Las cuatro son editables desde el admin (ningún `envOnly`): el entorno es
  // sólo la capa de arranque para un proyecto recién generado. La API key y la
  // lista se resuelven POR TIENDA, así que en un multitienda el `.env` alcanza
  // para la primera y las demás se cargan en Ajustes.
  newsletter: {
    environment: [
      'BREVO_API_KEY',
      'BREVO_API_URL',
      'BREVO_LIST_ID',
      'NEWSLETTER_ENABLED',
    ],
  },
  corporate: {
    environment: [
      'CORPORATE_ACTIVATION_MODE',
      'WHOLESALE_DISCOUNT',
      'WHOLESALE_PRICE_LIST_TITLE',
    ],
  },
  delivery: {
    environment: [
      'GOOGLE_MAPS_API_KEY',
      'OWN_FLEET_AUTO_FULFILL',
      'VITE_GOOGLE_MAPS_API_KEY',
    ],
  },
  'dynamic-groups': {
    environment: [
      'DYNAMIC_GROUPS_RECALC_CRON',
    ],
  },
  erp: {
    environment: [
      'APPLY',
      'DEFAULT_CURRENCY_CODE',
      'ERP_CATALOG_SYNC_CRON',
      'ERP_OUTBOX_CRON',
      'ERP_STOCK_SYNC_CRON',
      // Fallback de la URL pública del storefront: el mail que avisa el
      // comprobante manda un LINK (el provider de email no soporta adjuntos), y
      // `erp-invoice-ready-email.ts` resuelve el host con la misma precedencia
      // que el resto del backend (STOREFRONT_URL → NEXT_PUBLIC_BASE_URL →
      // STORE_CORS).
      'NEXT_PUBLIC_BASE_URL',
      'SHIPPING_PROFILE',
      'STOCKED_QUANTITY',
      'STOCK_LOCATION',
    ],
  },
  'fiscal-documentation': {
    environment: [
      'ARCA_CERTIFICATE_BASE64',
      'ARCA_CERTIFICATE_PATH',
      'ARCA_CUIT_REPRESENTADA',
      'ARCA_ENVIRONMENT',
      'ARCA_PRIVATE_KEY_BASE64',
      'ARCA_PRIVATE_KEY_PATH',
      'ARCA_WSAA_SERVICE',
    ],
  },
  'landing-pages': {
    environment: [
      'LANDING_AI_MAX_RETRIES',
      'OPENROUTER_API_KEY',
      'OPENROUTER_MODEL',
      'OPENROUTER_SITE_URL',
    ],
  },
  'loyalty-engine': {
    environment: [
      'LOYALTY_EXPIRE_SCHEDULE',
      'POINTS_EARN_RATE',
    ],
  },
  multistore: {
    environment: [
      'APPLY', 'DEFAULT_CURRENCY_CODE', 'DEMO_IMPORT_CRON', 'DEMO_IMPORT_STALE_MS', 'DEMO_SLUG',
      'DEMO_IMPORT_BACKOFF_BASE_MS',
      'DEMO_IMPORT_THROTTLE_MS',
      'MERCADOPAGO_ACCOUNTS',
      'MERCADOPAGO_PUBLIC_KEY',
      'MULTISTORE_PUBLIC_BASE_URL',
    ],
  },
  'payment-benefits': {
    environment: [
      'MERCADOPAGO_ACCESS_TOKEN',
    ],
  },
  'recommendation-engine': {
    environment: [
      'RECOMMENDATIONS_AGGREGATE_CRON',
      'RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS',
      'RECOMMENDATIONS_BASKET_CAP',
      'RECOMMENDATIONS_BRIDGE_CANDIDATE_LIMIT_CAP',
      'RECOMMENDATIONS_BUILD_BATCH',
      'RECOMMENDATIONS_BUILD_CRON',
      'RECOMMENDATIONS_BUILD_MAX_MS',
      'RECOMMENDATIONS_CANDIDATE_LIMIT_CAP',
      'RECOMMENDATIONS_CONFIG_TTL_MS',
      'RECOMMENDATIONS_DEBUG',
      'RECOMMENDATIONS_ENABLED',
      'RECOMMENDATIONS_EVENT_SECRET',
      'RECOMMENDATIONS_JOBS_ENABLED',
      'RECOMMENDATIONS_PURGE_BATCH',
      'RECOMMENDATIONS_PURGE_CRON',
      'RECOMMENDATIONS_PURGE_MAX_BATCHES',
      'RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE',
      'RECOMMENDATIONS_RESULT_LIMIT_CAP',
      'RECOMMENDATIONS_SCHEDULE_CRON',
      'RECOMMENDATIONS_STALE_MINUTES',
    ],
  },
  'recurring-orders': {
    environment: [
      'APPLY',
      'AUDIT_STRICT',
      'MEDUSA_BACKEND_URL',
      'NEXT_PUBLIC_BASE_URL',
      'RECURRING_BATCH_SIZE',
      'RECURRING_MAX_ATTEMPTS',
      'RECURRING_MAX_CONSECUTIVE_FAILURES',
      'RECURRING_METRICS_CRON',
      'RECURRING_ORDERS_ENABLED',
      'RECURRING_PAYMENT_EXPIRATION_HOURS',
      'RECURRING_REMINDER_HOURS',
      'RECURRING_RENEWAL_CRON',
      'RECURRING_RETRY_HOURS',
      'STOREFRONT_DEFAULT_COUNTRY',
      'SUBSCRIPTIONS_AUTO_PAYMENT_ENABLED',
      'SUBSCRIPTIONS_NOTIFICATIONS_CRON',
      'SUBSCRIPTIONS_PREFLIGHT_CRON',
      'SUBSCRIPTIONS_RETENTION_ENABLED',
      'SUBSCRIPTIONS_STOCK_FORECAST_CRON',
      'SUBSCRIPTIONS_STOCK_FORECAST_ENABLED',
      'SUBSCRIPTIONS_STOREFRONT_ENABLED',
      'SUBSCRIPTIONS_V2_ENABLED',
    ],
  },
  'store-config': {
    environment: [
      'AI_MEMORY_AUTOCAPTURE',
      'AI_MEMORY_AUTOCAPTURE_APPROVAL',
      'AI_MEMORY_ENABLED',
      'AI_MEMORY_MIN_SIMILARITY',
      'AI_MEMORY_TOPK',
      'CHAT_AI_MAX_TOKENS',
      'CHAT_AI_MODEL',
      'CHAT_AI_REASONING_EFFORT',
      'CHAT_AI_VALIDATION',
      'EMBEDDINGS_MODEL',
      'IN_PERSON_SC_NAME',
      'LANDING_AI_MAX_RETRIES',
      'OPENROUTER_MODEL',
    ],
  },
};
