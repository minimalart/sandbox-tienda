import type { i18n as I18nInstance } from 'i18next';

const ERP_NAMESPACE = 'erp';
let registered = false;

export const en = {
  // Section
  TITLE: 'ERP',
  DASHBOARD_TITLE: 'ERP integration',

  // Dashboard — integration card
  CARD_INTEGRATION: 'Integration',
  FIELD_PROVIDER: 'ERP',
  FIELD_COUNTRY: 'Country',
  STATUS_ENABLED: 'ACTIVE',
  STATUS_DISABLED: 'INACTIVE',
  CONNECTION_LABEL: 'Connection',
  CONNECTION_OK: 'Validated {{date}}',
  CONNECTION_FAILED: 'Failed {{date}}',
  CONNECTION_NEVER: 'Never validated',
  TOGGLE_STOCK: 'Stock sync',
  TOGGLE_SALES: 'Sales notification',
  TOGGLE_ON: 'On',
  TOGGLE_OFF: 'Off',
  NOT_CONFIGURED: 'The ERP integration is not configured yet.',
  GO_TO_CONFIG: 'Configure',

  // Dashboard — last sync card
  CARD_LAST_SYNC: 'Last stock sync',
  LAST_SYNC_NONE: 'No syncs yet.',
  RUN_SYNC: 'Sync stock now',
  RUN_SYNC_STARTED: 'Stock sync started',
  RUN_SYNC_ERROR: 'Could not start sync: {{msg}}',
  SYNC_RUNNING: 'Sync in progress…',
  SUMMARY_UPDATED: 'Updated',
  SUMMARY_NOT_FOUND: 'Not found',
  SUMMARY_ERRORS: 'Errors',
  SUMMARY_UNMATCHED: 'Not in ERP',
  SUMMARY_SKIPPED: 'Skipped',
  SUMMARY_TOTAL: 'SKUs',
  VIEW_LOGS: 'View logs',

  // Dashboard — outbox card
  CARD_OUTBOX: 'Sales → ERP',
  OUTBOX_PENDING: 'Pending',
  OUTBOX_FAILED: 'Failed',
  OUTBOX_DEAD: 'Dead letter',
  OUTBOX_SENT: 'Sent',
  VIEW_OUTBOX: 'View events',

  // Config page
  CONFIG_TITLE: 'ERP configuration',
  CONFIG_PROVIDER_SOON: '(coming soon)',
  CONFIG_MASTER: 'Integration enabled',
  CONFIG_MASTER_HINT: 'Master switch: with this off nothing syncs and no sales are queued.',
  CONFIG_STOCK: 'Stock sync (ERP → Medusa)',
  ORDER_WIDGET_TITLE: 'ERP invoicing',
  ORDER_NOT_NOTIFIED: 'Not notified',
  ORDER_BILLING_SECTION: 'Billing warehouse',
  ORDER_BILLING_SHIP_FROM:
    'Ship from "{{location}}" (ERP warehouse {{deposito}}). A fulfillment from any other location is rejected.',
  ORDER_BILLING_NOT_CONFIGURED:
    'No billing warehouse selected, so this order cannot be fulfilled. Set it in ERP → Configuration.',
  ORDER_BILLING_NOT_MAPPED:
    'The billing warehouse "{{deposito}}" is not mapped to any stock location. Fix it in ERP → Configuration.',
  ORDER_BILLING_CONFIRMED: 'Confirmed from warehouse {{deposito}} on {{at}}.',
  ORDER_BILLING_NOT_CONFIRMED:
    'No warehouse confirmed yet. It is recorded when an operator creates the fulfillment from the admin.',
  ORDER_BILLING_OVERRIDE: 'Override for this order',
  ORDER_BILLING_USE_DEFAULT: 'Use the configured default',
  ORDER_BILLING_SAVE: 'Save',
  ORDER_BILLING_DEPOSITO_SAVED: 'Billing warehouse updated for this order.',
  ORDER_INVOICE_SECTION: 'Document',
  ORDER_INVOICE_DOWNLOAD: 'Download PDF',
  ORDER_INVOICE_NO_PDF:
    'The document is issued but the PDF has not arrived yet; it is requested again on the next attempt.',
  ORDER_INVOICE_WAITING:
    'Waiting for the ERP to issue the document ({{attempts}} check(s) so far). It invoices on its own schedule.',
  ORDER_INVOICE_PENDING_SALE: 'The document appears once the sale reaches the ERP.',
  ORDER_INVOICE_UNSUPPORTED: 'This provider does not expose the issued document over its API.',
  CONFIG_SALES: 'Sales notification (Medusa → ERP)',
  CONFIG_SALES_TRIGGER_ORDER: 'Notify when the order is created',
  CONFIG_SALES_TRIGGER_ORDER_HINT:
    'The sale is queued once the payment is captured. This is the historical behaviour.',
  CONFIG_SALES_TRIGGER_FULFILLMENT: 'Notify when the fulfillment is done',
  CONFIG_SALES_TRIGGER_FULFILLMENT_HINT:
    'The sale is queued when an operator creates the fulfillment from the admin, shipping from the billing warehouse. For operations where stock is split across warehouses and consolidated by hand in the ERP.',
  CONFIG_SALES_TRIGGER_AUTOFULFILL_WARNING:
    'Carrier auto-fulfillment does NOT invoice: those fulfillments are created automatically right after checkout and are not a human confirmation that the goods were consolidated.',
  CONFIG_BILLING_DEPOSITO: 'Billing warehouse',
  CONFIG_BILLING_DEPOSITO_PLACEHOLDER: 'Pick a warehouse',
  CONFIG_BILLING_DEPOSITO_HINT:
    'The document is issued from this warehouse, and it is the only stock location a fulfillment may ship from. It can be overridden per order from the order page.',
  CONFIG_BILLING_DEPOSITO_EMPTY:
    'Load the ERP warehouse → stock location mapping below first: the billing warehouse is picked from there.',
  CONFIG_LOCATION: 'Stock location',
  CONFIG_LOCATION_HINT_MAP: 'Used when there is no warehouse mapping below.',
  CONFIG_DEPOSITO_MAP_TITLE: 'ERP warehouses → stock locations',
  CONFIG_DEPOSITO_MAP_HELP: 'One row per warehouse: each one writes ITS quantity to the matching stock location. Leave empty to write the ERP total to a single location.',
  CONFIG_DEPOSITO_CODE: 'Warehouse',
  CONFIG_DEPOSITO_MAP_ADD: 'Add warehouse',
  CONFIG_STOCK_CHANNELS_TITLE: 'Limit stock sync to these channels',
  CONFIG_STOCK_CHANNELS_HELP: 'Nothing selected = the whole catalog.',
  CONFIG_LOCATION_AUTO: 'Auto (oldest location)',
  CONFIG_CREDENTIALS: 'Credentials',
  CONFIG_CREDENTIALS_HINT:
    'Write-only: they are stored encrypted and never displayed. Leaving them empty keeps the saved ones.',
  CONFIG_CREDENTIALS_SET: 'Saved credentials: {{keys}}',
  CONFIG_CRED_STORED: 'stored',
  CONFIG_CRED_DELETE: 'Delete',
  CONFIG_CRED_UNDO: 'Undo',
  CONFIG_CRED_WILL_DELETE: 'will be deleted when you save',
  CONFIG_TINTING_TITLE: 'Tinting system',
  CONFIG_TINTING_HINT:
    'Lets customers pick a colour on a tintable base. The final price is quoted by the ERP for each base + formula. Needs colours, formulas and at least one confirmed base loaded.',
  CONFIG_TINTING_COLLECTION: 'Default colour chart',
  CONFIG_TINTING_COLLECTION_HINT:
    'Chart offered when the base does not define its own (in Zeus the formula belongs to a chart, e.g. ALBAHYO).',
  CONFIG_CRED_KEY: 'Key',
  CONFIG_CRED_VALUE: 'Value',
  CONFIG_CRED_ADD: 'Add credential',
  CONFIG_CBL_TITLE: 'Contabilium (Argentina)',
  CONFIG_CBL_HINT:
    'Required credentials: client_id (account email) and client_secret (API Key from Mi Cuenta → Datos de mi empresa → API). Numeric IDs come from your account — see docs/recipes/erp-contabilium.md.',
  CONFIG_CBL_BASE_URL: 'API base URL',
  CONFIG_CBL_DEPOSITO: 'Warehouse ID (depósito)',
  CONFIG_CBL_DEPOSITO_HINT: 'Required to notify sales; without it stock is summed across warehouses.',
  CONFIG_CBL_SALE_MODE: 'What each sale creates',
  CONFIG_CBL_MODE_ORDEN: 'Sales order (no invoice)',
  CONFIG_CBL_MODE_FACTURA: 'Electronic invoice (collected)',
  CONFIG_CBL_SALE_MODE_HINT:
    'Sales order registers the sale without a fiscal document (recommended start). Invoice requires FE enabled and a point of sale.',
  CONFIG_CBL_PUNTO_VENTA: 'Point of sale ID',
  CONFIG_CBL_TIPO_FC: 'Invoice type',
  CONFIG_CBL_CONDICION: 'Sale condition',
  CONFIG_CBL_DEFAULT_CLIENT: 'Default client ID (final consumer)',
  CONFIG_CBL_DEFAULT_CLIENT_HINT: 'Used for orders without a fiscal document; create a generic client in Contabilium.',
  CONFIG_CBL_SHIPPING_SKU: 'Shipping concept SKU',
  CONFIG_CBL_SHIPPING_SKU_HINT:
    'Sales orders do not allow free-text items: create an "ENVIO" concept in Contabilium to bill shipping as a line.',
  CONFIG_CBL_PRICES_TAX: 'Medusa prices include VAT',
  CONFIG_CBL_PRICES_TAX_HINT: 'On: net = price / 1.21. Off: prices are sent as-is.',
  CONFIG_BSALE_TITLE: 'Bsale (Chile)',
  CONFIG_BSALE_HINT:
    'Required credential: access_token (Bsale API token). Numeric IDs come from your Bsale account — see docs/recipes/erp-bsale.md to find them via API.',
  CONFIG_BSALE_BASE_URL: 'API base URL',
  CONFIG_BSALE_OFFICE: 'Office ID (branch)',
  CONFIG_BSALE_OFFICE_HINT: 'Stock and documents are scoped to this branch. Empty = stock summed across all branches.',
  CONFIG_BSALE_DOCTYPE: 'Document type ID',
  CONFIG_BSALE_DOCTYPE_HINT: 'Document issued per sale (e.g. nota de venta / boleta electrónica). Required to notify sales.',
  CONFIG_BSALE_PRICELIST: 'Price list ID',
  CONFIG_BSALE_PAYMENT: 'Payment type ID',
  CONFIG_BSALE_PAYMENT_HINT: 'Empty = document is issued without payments.',
  CONFIG_BSALE_TAXES: 'Tax IDs (comma separated)',
  CONFIG_BSALE_TAXES_HINT: 'Default 1 (19% VAT on standard accounts).',
  CONFIG_BSALE_DECLARE_SII: 'Declare to SII',
  CONFIG_BSALE_DISPATCH: 'Consume stock in Bsale when issuing',
  CONFIG_BSALE_SEND_EMAIL: 'Bsale emails the document to the customer',
  CONFIG_BSALE_PRICES_TAX: 'Medusa prices include VAT',
  CONFIG_BSALE_PRICES_TAX_HINT: 'On: net = price / 1.19. Off: prices are sent as-is.',
  CONFIG_ZEUS_TITLE: 'Zeus ERP (Argentina)',
  CONFIG_ZEUS_HINT:
    'Required credential: jwt_token (the JWT Zeus issues for the Ecommerce API). Codes come from your account — see docs/recipes/erp-zeus.md to find them via API.',
  CONFIG_ZEUS_BASE_URL: 'API base URL',
  CONFIG_ZEUS_ECOMMERCE_ID: 'Ecommerce identifier',
  CONFIG_ZEUS_ECOMMERCE_ID_HINT: 'Value of the `ecommerce` parameter Zeus assigns to this integration.',
  CONFIG_ZEUS_SUCURSAL: 'Branch (sucursal)',
  CONFIG_ZEUS_DEPOSITO: 'Warehouse (depósito)',
  CONFIG_ZEUS_DEPOSITO_HINT: 'Also scopes the stock sync to this warehouse. Empty = stock summed across all.',
  CONFIG_ZEUS_PTO_VTA: 'Point of sale',
  CONFIG_ZEUS_COD_LISTA: 'Price list',
  CONFIG_ZEUS_COND_VENTA: 'Sale condition code',
  CONFIG_ZEUS_TIPO_COMP: 'Document type',
  CONFIG_ZEUS_VENDEDOR: 'Salesperson code',
  CONFIG_ZEUS_DEFAULT_CLIENT: 'Default client code (final consumer)',
  CONFIG_ZEUS_DEFAULT_CLIENT_HINT: 'Used for orders without a fiscal document; create a generic client in Zeus.',
  CONFIG_ZEUS_CODIGO_IVA: 'VAT category for new clients',
  CONFIG_ZEUS_CODIGO_IVA_HINT: 'From /categorias-iva; default 5 (final consumer).',
  CONFIG_ZEUS_SHIPPING_CODE: 'Shipping article code',
  CONFIG_ZEUS_SHIPPING_CODE_HINT: 'Create a shipping article in Zeus to bill shipping as a line; empty = shipping goes in the notes.',
  CONFIG_ZEUS_TIPO_PAGO: 'Payment type',
  CONFIG_ZEUS_TIPO_PAGO_HINT: 'Payment type code in your Zeus account. Empty = orders are inserted without payments.',
  CONFIG_ZEUS_TARJETA: 'Card code',
  CONFIG_ZEUS_CREATE_CLIENTS: 'Create clients in Zeus when missing',
  CONFIG_ZEUS_ESHOP_ONLY: 'Sync only ecommerce-published articles (eshop flag)',
  CONFIG_ZEUS_SUBTRACT_COMMITTED: 'Available stock = stock − committed',
  CONFIG_ZEUS_PRICES_TAX: 'Medusa prices include VAT',
  CONFIG_ZEUS_PRICES_TAX_HINT: 'On: net = price / 1.21. Off: prices are sent as-is.',
  CONFIG_ODOO_TITLE: 'Odoo (self-hosted / cloud)',
  CONFIG_ODOO_HINT:
    "Odoo ERP integration via JSON-RPC (execute_kw). Requires the API key user's uid — discover it with common.authenticate.",
  CONFIG_ODOO_BASE_URL: 'Base URL',
  CONFIG_ODOO_BASE_URL_HINT: 'Full URL of the Odoo instance, without trailing slash.',
  CONFIG_ODOO_DB: 'Database name',
  CONFIG_ODOO_DB_HINT: 'Odoo database name; ask the client if unknown. Odoo.sh defaults sometimes to "odoo".',
  CONFIG_ODOO_UID: 'User ID',
  CONFIG_ODOO_UID_HINT: 'Numeric id of the res.users record that owns the API key.',
  CONFIG_ODOO_ALLOWED_COMPANY_IDS: 'Allowed company IDs (CSV)',
  CONFIG_ODOO_ALLOWED_COMPANY_IDS_HINT:
    "Comma-separated company IDs for multi-company tenants. Empty = user's active company.",
  CONFIG_ODOO_SHIPPING_ITEM_CODE: 'Shipping product SKU',
  CONFIG_ODOO_SHIPPING_ITEM_CODE_HINT:
    'Odoo product.product.default_code used to bill shipping as an extra sale.order.line. Empty = shipping goes as note.',
  CONFIG_ODOO_ONLY_PUBLISHED: 'Sync only products published in website_sale',
  CONFIG_ODOO_AUTO_CONFIRM: 'Auto-confirm sale.order (action_confirm)',

  CONFIG_OUTBOX_TITLE: 'Retries (outbox)',
  CONFIG_OUTBOX_MAX: 'Max attempts',
  CONFIG_OUTBOX_BASE: 'Base delay (s)',
  CONFIG_OUTBOX_MAXDELAY: 'Max delay (s)',
  CONFIG_CRON_HINT:
    'Schedules are controlled by the ERP_STOCK_SYNC_CRON (default: hourly) and ERP_OUTBOX_CRON (default: every minute) environment variables.',
  CONFIG_SAVE: 'Save',
  CONFIG_SAVED: 'ERP configuration saved',
  CONFIG_SAVE_ERROR: 'Could not save: {{msg}}',
  CONFIG_VALIDATE: 'Validate connection',
  CONFIG_VALIDATE_OK: 'Connection OK: {{msg}}',
  CONFIG_VALIDATE_FAILED: 'Validation failed: {{msg}}',

  // Logs page
  LOGS_TITLE: 'Sync logs',
  COL_STARTED: 'Started',
  COL_TYPE: 'Type',
  COL_TRIGGER: 'Trigger',
  COL_STATUS: 'Status',
  COL_SUMMARY: 'Summary',
  COL_DURATION: 'Duration',
  TRIGGER_CRON: 'Scheduled',
  TRIGGER_MANUAL: 'Manual',
  FILTER_ALL: 'All',
  LOGS_EMPTY: 'No syncs yet. Run one from the dashboard.',

  // Log detail
  LOG_DETAIL_TITLE: 'Sync detail',
  LOG_PROGRESS: '{{processed}} of {{total}} SKUs',
  ITEMS_TITLE: 'Detail per SKU',
  COL_SKU: 'SKU',
  COL_ITEM_STATUS: 'Result',
  COL_ITEM_DETAIL: 'Detail',
  COL_ERROR: 'Error',
  ITEMS_EMPTY: 'No items for this filter.',
  SEARCH_SKU: 'Search exact SKU…',
  ITEM_DRAWER_HINT: 'Click a row to see everything the sync recorded for it.',
  ITEM_DRAWER_TITLE: 'Article {{code}}',
  ITEM_NO_PAYLOAD: 'The sync did not record any detail for this item.',
  ITEM_RAW_PAYLOAD: 'Raw payload',

  // Outbox page
  OUTBOX_TITLE: 'Sales → ERP (outbox)',
  COL_CREATED: 'Created',
  COL_ORDER: 'Order',
  COL_ATTEMPTS: 'Attempts',
  COL_NEXT_RETRY: 'Next retry',
  COL_EXTERNAL_REF: 'ERP ref',
  RETRY: 'Retry',
  RETRY_OK: 'Event requeued',
  RETRY_ERROR: 'Could not retry: {{msg}}',
  OUTBOX_EMPTY: 'No sale events yet.',

  // Status labels (shared)
  ST_RUNNING: 'RUNNING',
  ST_COMPLETED: 'COMPLETED',
  ST_COMPLETED_WITH_ERRORS: 'WITH ERRORS',
  ST_FAILED: 'FAILED',
  ST_PENDING: 'PENDING',
  ST_PROCESSING: 'PROCESSING',
  ST_SENT: 'SENT',
  ST_DEAD_LETTER: 'DEAD LETTER',
  ST_SKIPPED: 'SKIPPED',
  ST_DUPLICATE: 'DUPLICATE',
  // Logs — type filter (COL_TYPE ya existe más arriba)
  FILTER_ALL_TYPES: 'All types',
  TYPE_STOCK_SYNC: 'Stock',
  TYPE_CATALOG_SYNC: 'Catalog',

  // Dashboard — catalog sync card
  TOGGLE_CATALOG: 'Catalog sync',
  CARD_CATALOG_SYNC: 'Catalog (products + price lists)',
  CATALOG_SYNC_NONE: 'No catalog syncs yet.',
  CATALOG_RUN: 'Sync catalog now',
  CATALOG_RUN_DRY: 'Dry run',
  CATALOG_RUN_FULL: 'Full sweep',
  CATALOG_RUN_FULL_CONFIRM:
    'A full sweep pulls the ENTIRE catalog instead of what changed since the last run, ' +
    'and rewrites every article it finds out of date — thousands of titles in one go. ' +
    'It is what you run after changing the title rules. Manually edited titles are not touched.',
  CATALOG_RUN_FULL_CONFIRM_OK: 'Run full sweep',
  CANCEL: 'Cancel',
  CATALOG_FULL_SWEEP_STARTED: 'Full sweep started — the whole catalog is being reviewed',
  CATALOG_RUN_STARTED: 'Catalog sync started',
  CATALOG_DRY_RUN_STARTED: 'Dry run started — nothing will be written',
  CATALOG_RUN_ERROR: 'Could not start catalog sync: {{msg}}',
  CATALOG_DRY_RUN_TAG: 'DRY RUN',
  CATALOG_SUMMARY_UNCHANGED: 'Unchanged',
  CATALOG_SUMMARY_CREATED: 'Created',
  CATALOG_SUMMARY_TITLES: 'Titles',
  CATALOG_SUMMARY_PRESENTATION: 'Presentation',
  CATALOG_SUMMARY_TITLE_WARNINGS: 'Title warnings',
  CATALOG_LOG_MODE: 'Mode',
  CATALOG_MODE_FULL: 'full sweep',
  CATALOG_MODE_DELTA: 'delta since',
  CATALOG_REINDEXED: 'Reindexed',
  CATALOG_STATUS_SYNC: 'Publication (published / unpublished)',
  CATALOG_STATUS_GUARD:
    '{{count}} unpublish(es) BLOCKED by the volume guard — nothing was unpublished.',

  // Config — catalog section
  CFG_CATALOG_TITLE: 'Catalog and prices',
  CFG_CATALOG_HELP:
    'Maps the ERP price lists to Medusa. Prices arrive final (tax included) and are stored as-is.',
  CFG_CATALOG_ENABLED: 'Enable catalog sync',
  CFG_BASE_LIST_INDEX: 'ERP list for the base price',
  CFG_BASE_LIST_HELP: 'In Zeus, list 1 is the retail price and list 4 is wholesale (-30%).',
  CFG_CURRENCY: 'Currency',
  CFG_ONLY_PUBLISHED: 'Only articles published for ecommerce',
  CFG_CREATE_PRODUCTS: 'Create the missing products',
  CFG_CREATE_PRODUCTS_HELP:
    'Off by default: enabling it on a fresh catalog can create thousands of products in one run.',
  CFG_CREATED_STATUS: 'Status for newly created products',
  CFG_CREATED_STATUS_HELP:
    'Draft keeps them out of the storefront and out of the search index until someone reviews them — but Medusa has no bulk publish, so thousands of drafts means a database query later. Pick Published when the ERP already sends usable titles and images are being imported.',
  CFG_CREATED_STATUS_DRAFT: 'Draft — review before publishing',
  CFG_CREATED_STATUS_PUBLISHED: 'Published — visible right away',
  CFG_CREATED_CHANNELS: 'Sales channels for new products',
  CFG_CREATED_CHANNELS_HELP:
    'A product with no sales channel is invisible in the storefront even when it is published, because the store API only returns what its API key can see. No channel is picked for you: in a platform with several stores, guessing would publish one client catalogue in another client store.',
  CFG_CREATED_CHANNELS_WARNING:
    'These products will be created as Published but with no sales channel, so they will NOT show up in the store. Pick at least one channel.',
  CFG_STATUS_SYNC: 'Mirror the ERP publication status on existing products',
  CFG_STATUS_SYNC_HELP:
    'Works both ways: an article the ERP publishes wakes its product up from draft, and an article the ERP stops publishing goes back to draft (and out of the search index). Without this, "only publishable articles" is just an input filter — an article taken down in the ERP stays on sale here. Never touches archived, rejected or proposed products, nor products you created by hand.',
  CFG_STATUS_UNPUBLISH_MISSING: 'Also unpublish articles deleted from the ERP',
  CFG_STATUS_UNPUBLISH_MISSING_HELP:
    'An article deleted from the ERP does not arrive at all, not even with its flags off, so the only way to spot it is that it is missing from a full sweep. Only applies to the full sweep: in an incremental run "did not arrive" means "did not change".',
  CFG_MAX_UNPUBLISH_PCT: 'Max % of the ERP batch that may be unpublished',
  CFG_MAX_UNPUBLISH_PCT_HELP:
    'Above this, nothing is unpublished and the run leaves a warning. Publishing too much is undone from the admin; unpublishing too much is lost sales nobody notices, so this guard is deliberately tighter than the delta one.',
  CFG_IMPORT_IMAGES: 'Import product images from the ERP',
  CFG_IMPORT_IMAGES_HELP:
    'Downloads each article photo from the ERP and uploads it to your file storage (the ERP endpoint needs a token, so the image cannot be linked directly). Only fills products that have no image at all: a photo uploaded by hand is never replaced. Turning it on triggers a full-catalogue pass on the next run, which can move hundreds of MB.',
  CFG_IMAGES_BACKFILL_PENDING:
    'An image backfill is pending: the next run will look for a photo for every product without one.',
  CFG_CATEGORIES_SYNC: 'Mirror the ERP category tree',
  CFG_CATEGORIES_SYNC_HELP:
    'Creates the ERP categories in Medusa and assigns each product to its own. Additive: categories set by hand are never touched. Turning it on schedules a one-off pass over the whole catalog.',
  CFG_CATEGORIES_SYNC_RANK: 'Also force the ERP ordering on existing categories',
  CFG_CATEGORIES_SYNC_RANK_HELP:
    'Off by default: reordering a category re-ranks all of its siblings, including the ones you created by hand.',
  CFG_CATEGORIES_BACKFILL_PENDING:
    'A full re-categorization is pending: the next run will read the whole catalog.',
  CFG_BRANDS_SYNC: 'Create the ERP brands in the Brands extension',
  CFG_BRANDS_SYNC_HELP:
    'Creates one brand per ERP brand name (no logo) and links it to the product. Without this the brand is still stored on the product, so the storefront filter works.',
  CFG_BRANDS_REPLACE: 'The ERP brand replaces the ones already on the product',
  CFG_BRANDS_REPLACE_HELP:
    'On by default: the ERP has one brand per article, so keeping the old one would leave the product in two brands forever. Removal is soft.',
  CFG_PRICE_LISTS: 'ERP list → Medusa price list',
  CFG_PRICE_LIST_ADD: 'Add mapping',
  CFG_PRICE_LIST_REMOVE: 'Remove',
  CFG_PRICE_LIST_INDEX: 'ERP list',
  CFG_PRICE_LIST_TITLE: 'Price list title',
  CFG_PRICE_LIST_GROUP: 'Customer group',
  CFG_PRICE_LIST_GROUP_NONE: 'No group (creates it as draft)',
  CFG_SHIPPING_PROFILE: 'Shipping profile for new products',
  CFG_SHIPPING_PROFILE_HELP:
    'Required to create products. Left empty, the sync picks the profile most of your shipping options already use. A product hanging off a profile with no shipping options can be browsed and paid for, and then fails when the cart is completed — after the gateway charged.',
  CFG_SHIPPING_PROFILE_NONE:
    'There is no shipping profile in this store, so no product will be created. Create one with at least one shipping option first.',
  CFG_OVERLAP_MINUTES: 'Watermark overlap (minutes)',
  CFG_FULL_SWEEP_HOUR: 'Full sweep hour',
  CFG_FULL_SWEEP_HOUR_HELP:
    'Once a day the sync asks the ERP for the whole catalogue instead of the delta, because the ERP does not report removals. Empty turns it off.',
  CFG_FULL_SWEEP_SCOPE_TITLE: 'What the full sweep does besides fetching the whole catalogue',
  CFG_FULL_SWEEP_IMAGES: 'Also look for images on the full sweep',
  CFG_FULL_SWEEP_IMAGES_HELP:
    'Off by default. What survives the image filter on a sweep is exactly the articles with no photo, and the ones the ERP has none for will not appear by asking again — when a photo is finally loaded, the ERP marks the article as modified and it arrives with the delta. Turn this on if your ERP loads images without touching the article, since then the delta never sees them.',
  CFG_FULL_SWEEP_PRICE_LISTS: 'Write price lists on the full sweep',
  CFG_FULL_SWEEP_PRICE_LISTS_HELP:
    'On by default. With several lists mapped, reading every price of each list and writing the ones that differ is the heavy part of the run, so turning it off makes the sweep much cheaper. The base price is always written either way.',
  CFG_FULL_SWEEP_PRICE_LISTS_WARN:
    'The full sweep is the safety net for prices: if the watermark slipped or the ERP did not report a change, the delta misses it for good and only the sweep catches up. With this off, your list prices depend on the ERP always reporting correctly.',
  CFG_MAX_CHANGE_PCT: 'Max % of catalog a delta may change',
  CFG_MAX_CHANGE_HELP: 'Above this the run aborts without writing. Guards against a bad watermark.',
  CFG_LAST_SYNCED_AT: 'Last synced watermark',
  CFG_LAST_SYNCED_NONE: 'Never — the next run will do a full sweep.',
  CFG_PRODUCT_FIELDS: 'Product fields the ERP may overwrite',
  CFG_PRODUCT_FIELDS_HELP:
    'Off by default. Turning on "title" rewrites existing products with the normalised title (never the raw ERP one); new products are always normalised.',
  CFG_TITLE_RULES: 'Normalise incoming titles',
  CFG_TITLE_RULES_HELP:
    'The ERP sends the title as typed into the back office (all caps, brand first, "X 0,25 LTS"). With this on it is never copied verbatim: case, brand, separators, units and promo legends are normalised on every run.',
  CFG_TITLE_STRIP_BRAND: 'Drop the brand from the start of the title',
  CFG_TITLE_STRIP_BRAND_HELP:
    'Only when the leading words match the ERP brand attribute. It is never guessed: an article with no brand keeps its full title.',
  CFG_TITLE_DICTIONARY: 'Title dictionary',
  CFG_TITLE_DICTIONARY_HELP:
    'One term per line, "source = result". Accents are never inferred, so this is where "electricas = eléctricas" or a product line that keeps its capitals ("zocalo = zócalo") goes. An empty result removes a built-in entry. Editing this re-normalises the catalogue on the next full sweep.',
  CFG_TITLE_PROMO_LEGENDS: 'Promo legends',
  CFG_TITLE_PROMO_LEGENDS_HELP:
    'One per line. Removed from the title only when in parentheses; anything not listed is kept, since it may be product information.',
  CFG_COLOR_OPTION: 'Write the colour into a variant option',
  CFG_COLOR_OPTION_HELP:
    'The ERP sends no colour in any field, so it is taken from the title against a CLOSED vocabulary (roble claro, cedro, negro, plata…) and written as a `Color` option — which is what draws the colour circle on the listing card. A product that already has a colour option is never touched, nor is one with several variants. Turning it on triggers a full-catalogue pass on the next run.',
  CFG_PRESENTATION_OPTION: 'Write the size into the variant option',
  CFG_PRESENTATION_OPTION_HELP:
    'The catalogue listing shows the variant option value, not the title — and most products carry the placeholder "Único", which the storefront hides. With this on the sync fills it in ("Formato: 1 l"). A hand-written label is never overwritten. Turning it on triggers a full-catalogue pass on the next run.',

  ST_UPDATED: 'UPDATED',
  ST_CREATED: 'CREATED',
  ST_PRICE_UNCHANGED: 'UNCHANGED',
  ST_NO_PRICE_SET: 'NO PRICE SET',
  ST_VARIANT_NOT_FOUND: 'NO VARIANT',
  ST_NOT_PUBLISHED: 'NOT PUBLISHED',
  ST_UNKNOWN: 'UNKNOWN',
  ST_NOT_FOUND: 'NOT FOUND',
  ST_DUPLICATE_SKU: 'DUPLICATE SKU',
  ST_INVALID_QUANTITY: 'INVALID QTY',
};

export const es: typeof en = {
  TITLE: 'ERP',
  DASHBOARD_TITLE: 'Integración ERP',

  CARD_INTEGRATION: 'Integración',
  FIELD_PROVIDER: 'ERP',
  FIELD_COUNTRY: 'País',
  STATUS_ENABLED: 'ACTIVA',
  STATUS_DISABLED: 'INACTIVA',
  CONNECTION_LABEL: 'Conexión',
  CONNECTION_OK: 'Validada {{date}}',
  CONNECTION_FAILED: 'Falló {{date}}',
  CONNECTION_NEVER: 'Nunca validada',
  TOGGLE_STOCK: 'Sync de stock',
  TOGGLE_SALES: 'Notificación de ventas',
  TOGGLE_ON: 'Activado',
  TOGGLE_OFF: 'Desactivado',
  NOT_CONFIGURED: 'La integración ERP todavía no está configurada.',
  GO_TO_CONFIG: 'Configurar',

  CARD_LAST_SYNC: 'Última sincronización de stock',
  LAST_SYNC_NONE: 'Todavía no hay sincronizaciones.',
  RUN_SYNC: 'Sincronizar stock ahora',
  RUN_SYNC_STARTED: 'Sincronización de stock iniciada',
  RUN_SYNC_ERROR: 'No se pudo iniciar el sync: {{msg}}',
  SYNC_RUNNING: 'Sincronización en curso…',
  SUMMARY_UPDATED: 'Actualizados',
  SUMMARY_NOT_FOUND: 'No encontrados',
  SUMMARY_ERRORS: 'Errores',
  SUMMARY_UNMATCHED: 'Sin match en el ERP',
  SUMMARY_SKIPPED: 'Salteados',
  SUMMARY_TOTAL: 'SKUs',
  VIEW_LOGS: 'Ver logs',

  CARD_OUTBOX: 'Ventas → ERP',
  OUTBOX_PENDING: 'Pendientes',
  OUTBOX_FAILED: 'Fallidas',
  OUTBOX_DEAD: 'Dead letter',
  OUTBOX_SENT: 'Enviadas',
  VIEW_OUTBOX: 'Ver eventos',

  CONFIG_TITLE: 'Configuración ERP',
  CONFIG_PROVIDER_SOON: '(próximamente)',
  CONFIG_MASTER: 'Integración activa',
  CONFIG_MASTER_HINT: 'Llave general: apagada no se sincroniza nada ni se encolan ventas.',
  CONFIG_STOCK: 'Sync de stock (ERP → Medusa)',
  ORDER_WIDGET_TITLE: 'Facturación ERP',
  ORDER_NOT_NOTIFIED: 'Sin notificar',
  ORDER_BILLING_SECTION: 'Depósito facturador',
  ORDER_BILLING_SHIP_FROM:
    'Despachá desde "{{location}}" (depósito {{deposito}} del ERP). Un fulfillment desde cualquier otra ubicación se rechaza.',
  ORDER_BILLING_NOT_CONFIGURED:
    'No hay depósito facturador elegido, así que este pedido no se puede despachar. Configuralo en ERP → Configuración.',
  ORDER_BILLING_NOT_MAPPED:
    'El depósito facturador "{{deposito}}" no está mapeado a ninguna stock location. Corregilo en ERP → Configuración.',
  ORDER_BILLING_CONFIRMED: 'Confirmado desde el depósito {{deposito}} el {{at}}.',
  ORDER_BILLING_NOT_CONFIRMED:
    'Todavía no hay depósito confirmado. Se registra cuando un operador crea el fulfillment desde el admin.',
  ORDER_BILLING_OVERRIDE: 'Cambiar solo para este pedido',
  ORDER_BILLING_USE_DEFAULT: 'Usar el default de la configuración',
  ORDER_BILLING_SAVE: 'Guardar',
  ORDER_BILLING_DEPOSITO_SAVED: 'Se actualizó el depósito facturador de este pedido.',
  ORDER_INVOICE_SECTION: 'Comprobante',
  ORDER_INVOICE_DOWNLOAD: 'Descargar PDF',
  ORDER_INVOICE_NO_PDF:
    'El comprobante está emitido pero el PDF todavía no llegó; se vuelve a pedir en el próximo intento.',
  ORDER_INVOICE_WAITING:
    'Esperando que el ERP emita el comprobante ({{attempts}} consulta(s) hasta ahora). Factura cuando le toca.',
  ORDER_INVOICE_PENDING_SALE: 'El comprobante aparece cuando la venta llegue al ERP.',
  ORDER_INVOICE_UNSUPPORTED: 'Este proveedor no expone el comprobante emitido por su API.',
  CONFIG_SALES: 'Notificación de ventas (Medusa → ERP)',
  CONFIG_SALES_TRIGGER_ORDER: 'Notificar al crearse la orden',
  CONFIG_SALES_TRIGGER_ORDER_HINT:
    'La venta se encola cuando el pago se captura. Es el comportamiento de siempre.',
  CONFIG_SALES_TRIGGER_FULFILLMENT: 'Notificar cuando el fulfillment esté hecho',
  CONFIG_SALES_TRIGGER_FULFILLMENT_HINT:
    'La venta se encola cuando un operador crea el fulfillment desde el admin, despachando desde el depósito facturador. Es para operativas donde el stock vive repartido entre depósitos y se consolida a mano en el ERP.',
  CONFIG_SALES_TRIGGER_AUTOFULFILL_WARNING:
    'El auto-fulfillment de los carriers NO factura: esos fulfillments se crean solos apenas se cobra y no son la confirmación humana de que la mercadería se consolidó.',
  CONFIG_BILLING_DEPOSITO: 'Depósito facturador',
  CONFIG_BILLING_DEPOSITO_PLACEHOLDER: 'Elegí un depósito',
  CONFIG_BILLING_DEPOSITO_HINT:
    'El comprobante se emite desde este depósito, y es la única stock location desde la que se puede crear el fulfillment. Se puede pisar por orden desde la pantalla del pedido.',
  CONFIG_BILLING_DEPOSITO_EMPTY:
    'Primero cargá el mapeo de depósitos del ERP → stock locations de más abajo: el depósito facturador se elige de ahí.',
  CONFIG_LOCATION: 'Stock location',
  CONFIG_LOCATION_HINT_MAP: 'Se usa cuando no hay mapeo de depósitos abajo.',
  CONFIG_DEPOSITO_MAP_TITLE: 'Depósitos del ERP → stock locations',
  CONFIG_DEPOSITO_MAP_HELP: 'Una fila por depósito: cada uno escribe SU cantidad en la stock location que le corresponde. Vacío = el total del ERP en una sola location.',
  CONFIG_DEPOSITO_CODE: 'Depósito',
  CONFIG_DEPOSITO_MAP_ADD: 'Agregar depósito',
  CONFIG_STOCK_CHANNELS_TITLE: 'Acotar el sync de stock a estos canales',
  CONFIG_STOCK_CHANNELS_HELP: 'Sin nada tildado = todo el catálogo.',
  CONFIG_LOCATION_AUTO: 'Automática (la más antigua)',
  CONFIG_CREDENTIALS: 'Credenciales',
  CONFIG_CREDENTIALS_HINT:
    'Write-only: se guardan cifradas y nunca se muestran. Dejarlas vacías conserva las guardadas.',
  CONFIG_CREDENTIALS_SET: 'Credenciales guardadas: {{keys}}',
  CONFIG_CRED_STORED: 'guardada',
  CONFIG_CRED_DELETE: 'Borrar',
  CONFIG_CRED_UNDO: 'Deshacer',
  CONFIG_CRED_WILL_DELETE: 'se borra al guardar',
  CONFIG_TINTING_TITLE: 'Sistema tintométrico',
  CONFIG_TINTING_HINT:
    'Permite elegir un color sobre una base entonable. El precio final lo cotiza el ERP por cada base + fórmula. Necesita colores, fórmulas y al menos una base confirmada cargadas.',
  CONFIG_TINTING_COLLECTION: 'Carta de colores por defecto',
  CONFIG_TINTING_COLLECTION_HINT:
    'Carta que se ofrece cuando la base no define una propia (en Zeus la fórmula es por carta, ej. ALBAHYO).',
  CONFIG_CRED_KEY: 'Clave',
  CONFIG_CRED_VALUE: 'Valor',
  CONFIG_CRED_ADD: 'Agregar credencial',
  CONFIG_CBL_TITLE: 'Contabilium (Argentina)',
  CONFIG_CBL_HINT:
    'Credenciales requeridas: client_id (email de la cuenta) y client_secret (API Key en Mi Cuenta → Datos de mi empresa → API). Los IDs numéricos salen de tu cuenta — ver docs/recipes/erp-contabilium.md.',
  CONFIG_CBL_BASE_URL: 'URL base de la API',
  CONFIG_CBL_DEPOSITO: 'ID de depósito',
  CONFIG_CBL_DEPOSITO_HINT: 'Requerido para notificar ventas; sin él el stock suma todos los depósitos.',
  CONFIG_CBL_SALE_MODE: 'Qué crea cada venta',
  CONFIG_CBL_MODE_ORDEN: 'Orden de venta (sin factura)',
  CONFIG_CBL_MODE_FACTURA: 'Factura electrónica (cobrada)',
  CONFIG_CBL_SALE_MODE_HINT:
    'La orden de venta registra la venta sin comprobante fiscal (arranque recomendado). La factura requiere FE habilitada y punto de venta.',
  CONFIG_CBL_PUNTO_VENTA: 'ID de punto de venta',
  CONFIG_CBL_TIPO_FC: 'Tipo de comprobante',
  CONFIG_CBL_CONDICION: 'Condición de venta',
  CONFIG_CBL_DEFAULT_CLIENT: 'ID de cliente por defecto (consumidor final)',
  CONFIG_CBL_DEFAULT_CLIENT_HINT: 'Se usa para órdenes sin documento fiscal; creá un cliente genérico en Contabilium.',
  CONFIG_CBL_SHIPPING_SKU: 'SKU del concepto de envío',
  CONFIG_CBL_SHIPPING_SKU_HINT:
    'Las órdenes de venta no aceptan ítems libres: creá un concepto "ENVIO" en Contabilium para facturar el envío como línea.',
  CONFIG_CBL_PRICES_TAX: 'Los precios de Medusa incluyen IVA',
  CONFIG_CBL_PRICES_TAX_HINT: 'Activado: neto = precio / 1.21. Desactivado: se envían tal cual.',
  CONFIG_BSALE_TITLE: 'Bsale (Chile)',
  CONFIG_BSALE_HINT:
    'Credencial requerida: access_token (token de la API de Bsale). Los IDs numéricos salen de tu cuenta Bsale — ver docs/recipes/erp-bsale.md para encontrarlos vía API.',
  CONFIG_BSALE_BASE_URL: 'URL base de la API',
  CONFIG_BSALE_OFFICE: 'ID de sucursal (office)',
  CONFIG_BSALE_OFFICE_HINT: 'Stock y documentos se acotan a esta sucursal. Vacío = stock sumado de todas.',
  CONFIG_BSALE_DOCTYPE: 'ID de tipo de documento',
  CONFIG_BSALE_DOCTYPE_HINT: 'Documento emitido por venta (ej: nota de venta / boleta electrónica). Requerido para notificar ventas.',
  CONFIG_BSALE_PRICELIST: 'ID de lista de precios',
  CONFIG_BSALE_PAYMENT: 'ID de forma de pago',
  CONFIG_BSALE_PAYMENT_HINT: 'Vacío = el documento se emite sin pagos.',
  CONFIG_BSALE_TAXES: 'IDs de impuestos (separados por coma)',
  CONFIG_BSALE_TAXES_HINT: 'Default 1 (IVA 19% en cuentas estándar).',
  CONFIG_BSALE_DECLARE_SII: 'Declarar al SII',
  CONFIG_BSALE_DISPATCH: 'Descontar stock en Bsale al emitir',
  CONFIG_BSALE_SEND_EMAIL: 'Bsale envía el documento por email al cliente',
  CONFIG_BSALE_PRICES_TAX: 'Los precios de Medusa incluyen IVA',
  CONFIG_BSALE_PRICES_TAX_HINT: 'Activado: neto = precio / 1.19. Desactivado: se envían tal cual.',
  CONFIG_ZEUS_TITLE: 'Zeus ERP (Argentina)',
  CONFIG_ZEUS_HINT:
    'Credencial requerida: jwt_token (el JWT que entrega Zeus para la API Ecommerce). Los códigos salen de tu cuenta — ver docs/recipes/erp-zeus.md para encontrarlos vía API.',
  CONFIG_ZEUS_BASE_URL: 'URL base de la API',
  CONFIG_ZEUS_ECOMMERCE_ID: 'Identificador del ecommerce',
  CONFIG_ZEUS_ECOMMERCE_ID_HINT: 'Valor del parámetro `ecommerce` que Zeus asigna a esta integración.',
  CONFIG_ZEUS_SUCURSAL: 'Sucursal',
  CONFIG_ZEUS_DEPOSITO: 'Depósito',
  CONFIG_ZEUS_DEPOSITO_HINT: 'También acota el sync de stock a este depósito. Vacío = stock sumado de todos.',
  CONFIG_ZEUS_PTO_VTA: 'Punto de venta',
  CONFIG_ZEUS_COD_LISTA: 'Lista de precios',
  CONFIG_ZEUS_COND_VENTA: 'Código de condición de venta',
  CONFIG_ZEUS_TIPO_COMP: 'Tipo de comprobante',
  CONFIG_ZEUS_VENDEDOR: 'Código de vendedor',
  CONFIG_ZEUS_DEFAULT_CLIENT: 'Código de cliente por defecto (consumidor final)',
  CONFIG_ZEUS_DEFAULT_CLIENT_HINT: 'Se usa para órdenes sin documento fiscal; creá un cliente genérico en Zeus.',
  CONFIG_ZEUS_CODIGO_IVA: 'Categoría de IVA para clientes nuevos',
  CONFIG_ZEUS_CODIGO_IVA_HINT: 'De /categorias-iva; default 5 (consumidor final).',
  CONFIG_ZEUS_SHIPPING_CODE: 'Código de artículo de envío',
  CONFIG_ZEUS_SHIPPING_CODE_HINT: 'Creá un artículo de envío en Zeus para facturarlo como línea; vacío = el envío va en observaciones.',
  CONFIG_ZEUS_TIPO_PAGO: 'Tipo de pago',
  CONFIG_ZEUS_TIPO_PAGO_HINT: 'Código del tipo de pago en tu cuenta Zeus. Vacío = los pedidos se insertan sin pagos.',
  CONFIG_ZEUS_TARJETA: 'Código de tarjeta',
  CONFIG_ZEUS_CREATE_CLIENTS: 'Crear clientes en Zeus cuando no existen',
  CONFIG_ZEUS_ESHOP_ONLY: 'Sincronizar solo artículos publicados en ecommerce (flag eshop)',
  CONFIG_ZEUS_SUBTRACT_COMMITTED: 'Stock disponible = stock − comprometido',
  CONFIG_ZEUS_PRICES_TAX: 'Los precios de Medusa incluyen IVA',
  CONFIG_ZEUS_PRICES_TAX_HINT: 'Activado: neto = precio / 1.21. Desactivado: se envían tal cual.',
  CONFIG_ODOO_TITLE: 'Odoo (self-hosted / cloud)',
  CONFIG_ODOO_HINT:
    'Integración con Odoo ERP vía JSON-RPC (execute_kw). Requiere el uid del user dueño de la API key — descubrir con common.authenticate.',
  CONFIG_ODOO_BASE_URL: 'URL base',
  CONFIG_ODOO_BASE_URL_HINT: 'URL completa de la instancia Odoo, sin barra final.',
  CONFIG_ODOO_DB: 'Nombre de la base',
  CONFIG_ODOO_DB_HINT: 'Nombre de la base Odoo; preguntar al cliente si no se conoce. Odoo.sh a veces default en "odoo".',
  CONFIG_ODOO_UID: 'ID del usuario',
  CONFIG_ODOO_UID_HINT: 'ID numérico del registro res.users dueño de la API key.',
  CONFIG_ODOO_ALLOWED_COMPANY_IDS: 'IDs de empresas permitidas (CSV)',
  CONFIG_ODOO_ALLOWED_COMPANY_IDS_HINT:
    'IDs de empresa separados por coma para tenants multi-empresa. Vacío = empresa activa del user.',
  CONFIG_ODOO_SHIPPING_ITEM_CODE: 'SKU del producto de envío',
  CONFIG_ODOO_SHIPPING_ITEM_CODE_HINT:
    'default_code del product.product en Odoo para facturar el envío como línea extra. Vacío = el envío va como nota.',
  CONFIG_ODOO_ONLY_PUBLISHED: 'Sincronizar solo productos publicados en website_sale',
  CONFIG_ODOO_AUTO_CONFIRM: 'Auto-confirmar sale.order (action_confirm)',

  CONFIG_OUTBOX_TITLE: 'Reintentos (outbox)',
  CONFIG_OUTBOX_MAX: 'Intentos máximos',
  CONFIG_OUTBOX_BASE: 'Espera base (s)',
  CONFIG_OUTBOX_MAXDELAY: 'Espera máxima (s)',
  CONFIG_CRON_HINT:
    'Las frecuencias las gobiernan las variables de entorno ERP_STOCK_SYNC_CRON (default: cada hora) y ERP_OUTBOX_CRON (default: cada minuto).',
  CONFIG_SAVE: 'Guardar',
  CONFIG_SAVED: 'Configuración ERP guardada',
  CONFIG_SAVE_ERROR: 'No se pudo guardar: {{msg}}',
  CONFIG_VALIDATE: 'Validar conexión',
  CONFIG_VALIDATE_OK: 'Conexión OK: {{msg}}',
  CONFIG_VALIDATE_FAILED: 'La validación falló: {{msg}}',

  LOGS_TITLE: 'Logs de sincronización',
  COL_STARTED: 'Inicio',
  COL_TYPE: 'Tipo',
  COL_TRIGGER: 'Origen',
  COL_STATUS: 'Estado',
  COL_SUMMARY: 'Resumen',
  COL_DURATION: 'Duración',
  TRIGGER_CRON: 'Programado',
  TRIGGER_MANUAL: 'Manual',
  FILTER_ALL: 'Todos',
  LOGS_EMPTY: 'Todavía no hay sincronizaciones. Corré una desde el dashboard.',

  LOG_DETAIL_TITLE: 'Detalle de sincronización',
  LOG_PROGRESS: '{{processed}} de {{total}} SKUs',
  ITEMS_TITLE: 'Detalle por SKU',
  COL_SKU: 'SKU',
  COL_ITEM_STATUS: 'Resultado',
  COL_ITEM_DETAIL: 'Detalle',
  COL_ERROR: 'Error',
  ITEMS_EMPTY: 'No hay items para este filtro.',
  SEARCH_SKU: 'Buscar SKU exacto…',
  ITEM_DRAWER_HINT: 'Hacé clic en una fila para ver todo lo que el sync registró.',
  ITEM_DRAWER_TITLE: 'Artículo {{code}}',
  ITEM_NO_PAYLOAD: 'El sync no registró detalle para este item.',
  ITEM_RAW_PAYLOAD: 'Payload crudo',

  OUTBOX_TITLE: 'Ventas → ERP (outbox)',
  COL_CREATED: 'Creado',
  COL_ORDER: 'Orden',
  COL_ATTEMPTS: 'Intentos',
  COL_NEXT_RETRY: 'Próximo intento',
  COL_EXTERNAL_REF: 'Ref. ERP',
  RETRY: 'Reintentar',
  RETRY_OK: 'Evento re-encolado',
  RETRY_ERROR: 'No se pudo reintentar: {{msg}}',
  OUTBOX_EMPTY: 'Todavía no hay eventos de venta.',

  ST_RUNNING: 'EN CURSO',
  ST_COMPLETED: 'COMPLETADA',
  ST_COMPLETED_WITH_ERRORS: 'CON ERRORES',
  ST_FAILED: 'FALLIDA',
  ST_PENDING: 'PENDIENTE',
  ST_PROCESSING: 'PROCESANDO',
  ST_SENT: 'ENVIADA',
  ST_DEAD_LETTER: 'DEAD LETTER',
  ST_SKIPPED: 'SALTEADA',
  ST_DUPLICATE: 'DUPLICADA',
  // Logs — filtro de tipo (COL_TYPE ya existe más arriba)
  FILTER_ALL_TYPES: 'Todos los tipos',
  TYPE_STOCK_SYNC: 'Stock',
  TYPE_CATALOG_SYNC: 'Catálogo',

  // Dashboard — tarjeta de catálogo
  TOGGLE_CATALOG: 'Sync de catálogo',
  CARD_CATALOG_SYNC: 'Catálogo (productos + listas de precios)',
  CATALOG_SYNC_NONE: 'Todavía no hay sincronizaciones de catálogo.',
  CATALOG_RUN: 'Sincronizar catálogo ahora',
  CATALOG_RUN_DRY: 'Simular (dry-run)',
  CATALOG_RUN_FULL: 'Barrido completo',
  CATALOG_RUN_FULL_CONFIRM:
    'El barrido completo pide el catálogo ENTERO en lugar de lo que cambió desde la última ' +
    'corrida, y reescribe todo artículo que encuentre desactualizado: pueden ser miles de ' +
    'títulos de una. Es lo que hay que correr después de cambiar las reglas de título. Los ' +
    'títulos editados a mano no se tocan.',
  CATALOG_RUN_FULL_CONFIRM_OK: 'Correr barrido completo',
  CANCEL: 'Cancelar',
  CATALOG_FULL_SWEEP_STARTED: 'Barrido completo iniciado — se está revisando todo el catálogo',
  CATALOG_RUN_STARTED: 'Sincronización de catálogo iniciada',
  CATALOG_DRY_RUN_STARTED: 'Simulación iniciada — no se va a escribir nada',
  CATALOG_RUN_ERROR: 'No se pudo iniciar el sync de catálogo: {{msg}}',
  CATALOG_DRY_RUN_TAG: 'SIMULACIÓN',
  CATALOG_SUMMARY_UNCHANGED: 'Sin cambio',
  CATALOG_SUMMARY_CREATED: 'Creados',
  CATALOG_SUMMARY_TITLES: 'Títulos',
  CATALOG_SUMMARY_PRESENTATION: 'Presentación',
  CATALOG_SUMMARY_TITLE_WARNINGS: 'Avisos de título',
  CATALOG_LOG_MODE: 'Modo',
  CATALOG_MODE_FULL: 'barrido completo',
  CATALOG_MODE_DELTA: 'delta desde',
  CATALOG_REINDEXED: 'Reindexados',
  CATALOG_STATUS_SYNC: 'Publicación (publicados / despublicados)',
  CATALOG_STATUS_GUARD:
    '{{count}} despublicación(es) BLOQUEADAS por el límite de volumen — no se despublicó ninguna.',

  // Config — sección catálogo
  CFG_CATALOG_TITLE: 'Catálogo y precios',
  CFG_CATALOG_HELP:
    'Mapea las listas de precios del ERP a Medusa. Los precios llegan finales (con IVA incluido) y se guardan tal cual.',
  CFG_CATALOG_ENABLED: 'Activar sync de catálogo',
  CFG_BASE_LIST_INDEX: 'Lista del ERP para el precio base',
  CFG_BASE_LIST_HELP: 'En Zeus, la lista 1 es el precio al público y la 4 es mayorista (-30%).',
  CFG_CURRENCY: 'Moneda',
  CFG_ONLY_PUBLISHED: 'Solo artículos publicados para ecommerce',
  CFG_CREATE_PRODUCTS: 'Crear los productos que faltan',
  CFG_CREATE_PRODUCTS_HELP:
    'Apagado por default: prenderlo sobre un catálogo vacío puede crear miles de productos en una sola corrida.',
  CFG_CREATED_STATUS: 'Estado de los productos que se crean',
  CFG_CREATED_STATUS_HELP:
    'Borrador los deja fuera del storefront y fuera del índice de búsqueda hasta que alguien los revise — pero Medusa no tiene publicación masiva, así que miles de borradores terminan en una query a la base. Elegí Publicado cuando el ERP ya manda títulos usables y estás importando las imágenes.',
  CFG_CREATED_STATUS_DRAFT: 'Borrador — revisar antes de publicar',
  CFG_CREATED_STATUS_PUBLISHED: 'Publicado — visible al toque',
  CFG_CREATED_CHANNELS: 'Canales de venta de los productos creados',
  CFG_CREATED_CHANNELS_HELP:
    'Un producto sin canal de venta es invisible en la tienda incluso estando publicado, porque la API de tienda solo devuelve lo que su clave puede ver. No se elige ninguno por vos: en una plataforma con varias tiendas, adivinar publicaría el catálogo de un cliente en la tienda de otro.',
  CFG_CREATED_CHANNELS_WARNING:
    'Estos productos se van a crear como Publicados pero sin canal de venta, así que NO se van a ver en la tienda. Elegí al menos un canal.',
  CFG_STATUS_SYNC: 'Espejar el estado de publicación del ERP en productos existentes',
  CFG_STATUS_SYNC_HELP:
    'Funciona en las dos direcciones: un artículo que el ERP publica despierta a su producto del borrador, y un artículo que el ERP deja de publicar vuelve a borrador (y sale del índice de búsqueda). Sin esto, "solo artículos publicables" es apenas un filtro de entrada — un artículo dado de baja en el ERP se sigue vendiendo acá. Nunca toca productos archivados, rechazados o propuestos, ni los que cargaste a mano.',
  CFG_STATUS_UNPUBLISH_MISSING: 'Despublicar también los artículos borrados del ERP',
  CFG_STATUS_UNPUBLISH_MISSING_HELP:
    'Un artículo borrado del ERP no llega de ninguna forma, ni con los flags apagados, así que la única manera de detectarlo es que falte en un barrido completo. Solo aplica al barrido completo: en una corrida incremental "no vino" significa "no cambió".',
  CFG_MAX_UNPUBLISH_PCT: 'Máx. % del lote del ERP que se puede despublicar',
  CFG_MAX_UNPUBLISH_PCT_HELP:
    'Por encima de esto no se despublica nada y la corrida deja un aviso. Publicar de más se revierte desde el admin; despublicar de más es venta perdida sin que nadie se entere, así que este límite es a propósito más estricto que el del delta.',
  CFG_IMPORT_IMAGES: 'Importar las imágenes de los artículos desde el ERP',
  CFG_IMPORT_IMAGES_HELP:
    'Baja la foto de cada artículo del ERP y la sube a tu almacenamiento de archivos (el endpoint del ERP pide token, así que la imagen no se puede linkear directo). Solo completa productos que no tienen ninguna imagen: una foto cargada a mano nunca se pisa. Prenderlo programa una pasada sobre todo el catálogo, que puede mover cientos de MB.',
  CFG_IMAGES_BACKFILL_PENDING:
    'Hay un backfill de imágenes pendiente: la próxima corrida le va a buscar foto a todos los productos que no tengan.',
  CFG_CATEGORIES_SYNC: 'Espejar el árbol de categorías del ERP',
  CFG_CATEGORIES_SYNC_HELP:
    'Crea las categorías del ERP en Medusa y asigna cada producto a la suya. Es aditivo: nunca toca las categorías puestas a mano. Prenderlo programa una pasada única sobre todo el catálogo.',
  CFG_CATEGORIES_SYNC_RANK: 'Forzar también el orden del ERP en categorías existentes',
  CFG_CATEGORIES_SYNC_RANK_HELP:
    'Apagado por default: reordenar una categoría re-rankea a todos sus hermanos, incluidos los que creaste a mano.',
  CFG_CATEGORIES_BACKFILL_PENDING:
    'Hay una recategorización pendiente: la próxima corrida lee el catálogo completo.',
  CFG_BRANDS_SYNC: 'Crear las marcas del ERP en la extensión Marcas',
  CFG_BRANDS_SYNC_HELP:
    'Crea una marca por cada marca del ERP (sin logo) y la vincula al producto. Sin esto la marca igual se guarda en el producto, así que el filtro del storefront funciona.',
  CFG_BRANDS_REPLACE: 'La marca del ERP reemplaza las que ya tenga el producto',
  CFG_BRANDS_REPLACE_HELP:
    'Prendido por default: el ERP trae una marca por artículo, así que conservar la anterior dejaría el producto en dos marcas para siempre. El borrado es reversible.',
  CFG_PRICE_LISTS: 'Lista del ERP → price list de Medusa',
  CFG_PRICE_LIST_ADD: 'Agregar mapeo',
  CFG_PRICE_LIST_REMOVE: 'Quitar',
  CFG_PRICE_LIST_INDEX: 'Lista del ERP',
  CFG_PRICE_LIST_TITLE: 'Título de la price list',
  CFG_PRICE_LIST_GROUP: 'Grupo de clientes',
  CFG_PRICE_LIST_GROUP_NONE: 'Sin grupo (se crea como borrador)',
  CFG_SHIPPING_PROFILE: 'Perfil de envío para productos nuevos',
  CFG_SHIPPING_PROFILE_HELP:
    'Obligatorio para crear productos. Vacío, el sync elige el perfil que ya usan la mayoría de tus opciones de envío. Un producto colgado de un perfil sin opciones de envío se navega y se paga bien, y recién falla al cerrar el carrito — después de que la pasarela cobró.',
  CFG_SHIPPING_PROFILE_NONE:
    'No hay ningún perfil de envío en esta tienda, así que no se va a crear ningún producto. Creá uno con al menos una opción de envío.',
  CFG_OVERLAP_MINUTES: 'Solapamiento del watermark (minutos)',
  CFG_FULL_SWEEP_HOUR: 'Hora del barrido completo',
  CFG_FULL_SWEEP_HOUR_HELP:
    'Una vez por día el sync le pide al ERP el catálogo completo en lugar del delta, porque el ERP no informa las bajas. Vacío lo apaga.',
  CFG_FULL_SWEEP_SCOPE_TITLE: 'Qué hace el barrido completo además de traer todo el catálogo',
  CFG_FULL_SWEEP_IMAGES: 'Buscar imágenes también en el barrido completo',
  CFG_FULL_SWEEP_IMAGES_HELP:
    'Apagado por default. Lo que sobrevive al filtro de imágenes en un barrido son justamente los artículos sin foto, y los que el ERP no tiene no van a aparecer por preguntar de nuevo — cuando por fin le cargan la foto, el ERP marca el artículo como modificado y entra por el delta. Prendelo si tu ERP carga imágenes sin tocar el artículo, porque ahí el delta no las ve nunca.',
  CFG_FULL_SWEEP_PRICE_LISTS: 'Escribir las price lists en el barrido completo',
  CFG_FULL_SWEEP_PRICE_LISTS_HELP:
    'Prendido por default. Con varias listas mapeadas, leer todos los precios de cada lista y escribir los que difieren es la parte pesada de la corrida, así que apagarlo abarata mucho el barrido. El precio base se escribe siempre, en cualquier caso.',
  CFG_FULL_SWEEP_PRICE_LISTS_WARN:
    'El barrido completo es la red de seguridad de los precios: si el watermark se corrió o el ERP no informó un cambio, el delta lo pierde para siempre y solo el barrido lo arrastra. Con esto apagado, los precios de tus listas dependen de que el ERP informe bien siempre.',
  CFG_MAX_CHANGE_PCT: 'Máx. % del catálogo que puede cambiar un delta',
  CFG_MAX_CHANGE_HELP:
    'Por encima de esto la corrida aborta sin escribir. Protege contra un watermark mal calculado.',
  CFG_LAST_SYNCED_AT: 'Último watermark sincronizado',
  CFG_LAST_SYNCED_NONE: 'Nunca — la próxima corrida hace un barrido completo.',
  CFG_PRODUCT_FIELDS: 'Campos de producto que el ERP puede sobrescribir',
  CFG_PRODUCT_FIELDS_HELP:
    'Apagados por default. Prender "title" corrige también los productos que ya existen, siempre con el título normalizado y nunca con el crudo del ERP; las altas se normalizan igual.',
  CFG_TITLE_RULES: 'Normalizar los títulos que llegan del ERP',
  CFG_TITLE_RULES_HELP:
    'El ERP manda el título como se cargó en la gestión (mayúsculas, marca al inicio, "X 0,25 LTS"). Con esto prendido nunca se copia literal: en cada corrida se normalizan mayúsculas, marca, separadores, unidades y leyendas promocionales.',
  CFG_TITLE_STRIP_BRAND: 'Quitar la marca del inicio del título',
  CFG_TITLE_STRIP_BRAND_HELP:
    'Solo cuando las primeras palabras coinciden con el atributo Marca del ERP. Nunca se adivina: un artículo sin marca informada conserva el título completo.',
  CFG_TITLE_DICTIONARY: 'Diccionario de títulos',
  CFG_TITLE_DICTIONARY_HELP:
    'Un término por línea, "origen = resultado". Las tildes no se infieren, así que acá van casos como "electricas = eléctricas" o una línea comercial que conserva mayúsculas ("zocalo = zócalo"). Un resultado vacío borra una entrada que ya viene incluida. Editar esto re-normaliza el catálogo en el próximo barrido completo.',
  CFG_TITLE_PROMO_LEGENDS: 'Leyendas promocionales',
  CFG_TITLE_PROMO_LEGENDS_HELP:
    'Una por línea. Se quitan del título solo cuando están entre paréntesis; lo que no esté en la lista se conserva, porque puede ser información del producto.',
  CFG_COLOR_OPTION: 'Escribir el color en una opción de variante',
  CFG_COLOR_OPTION_HELP:
    'El ERP no manda color en ningún campo, así que se saca del título contra un vocabulario CERRADO (roble claro, cedro, negro, plata…) y se escribe como opción `Color` — que es lo que pinta el círculo de color en la card. Un producto que ya tiene opción de color no se toca, ni uno con varias variantes. Al prenderlo, la próxima corrida recorre el catálogo completo.',
  CFG_PRESENTATION_OPTION: 'Escribir la presentación en la opción de variante',
  CFG_PRESENTATION_OPTION_HELP:
    'La card del catálogo muestra el valor de la opción de variante, no el título — y la mayoría del catálogo tiene el relleno "Único", que el storefront esconde. Con esto prendido el sync lo completa ("Formato: 1 l"). Una etiqueta escrita a mano nunca se pisa. Al prenderlo, la próxima corrida recorre el catálogo completo.',

  ST_UPDATED: 'ACTUALIZADO',
  ST_CREATED: 'CREADO',
  ST_PRICE_UNCHANGED: 'SIN CAMBIO',
  ST_NO_PRICE_SET: 'SIN PRICE SET',
  ST_VARIANT_NOT_FOUND: 'SIN VARIANTE',
  ST_NOT_PUBLISHED: 'NO PUBLICADO',
  ST_UNKNOWN: 'DESCONOCIDO',
  ST_NOT_FOUND: 'NO ENCONTRADO',
  ST_DUPLICATE_SKU: 'SKU DUPLICADO',
  ST_INVALID_QUANTITY: 'CANTIDAD INVÁLIDA',
};

export const registerErpTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }
  i18n.addResourceBundle('en', ERP_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', ERP_NAMESPACE, es, true, true);
  registered = true;
};
