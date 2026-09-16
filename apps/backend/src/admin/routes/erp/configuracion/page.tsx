import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Checkbox,
  Container,
  Heading,
  Input,
  Label,
  RadioGroup,
  Select,
  Switch,
  Text,
  Textarea,
  Toaster,
  toast,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useErpConfig,
  useErpConfigLookups,
  useErpPriceListOptions,
  useResetImageFailures,
  useStockLocationOptions,
  useUpdateErpConfig,
  useValidateErpConnection,
  type ErpBsaleSettings,
  type ErpCatalogSyncSettings,
  type ErpContabiliumSettings,
  type ErpOdooSettings,
  type ErpProductField,
  type ErpZeusSettings,
} from '../../../hooks/api';
import { ErpSettingLabel, useErpTranslationsReady } from '../components/shared';
import { ErpCodeField } from '../components/code-field';
import { ExtensionSettingsCard } from '../../../components/app-settings/extension-settings-card';
import { CardSiteContext } from '../../../components/common/card-site-context';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SingleColumnLayout } from '../../../components/layouts/single-column';

const AUTO_LOCATION = '__auto__';
const NO_SHIPPING_PROFILE = '__none__';
const NO_CUSTOMER_GROUP = '__none__';

/** Campos que el catalog sync puede sobrescribir, en el orden que se muestran. */
const PRODUCT_FIELD_OPTIONS: ErpProductField[] = [
  'weight',
  'length',
  'height',
  'width',
  'barcode',
  'brand',
  'family',
  'category',
  'title',
  'description',
];

type PriceListRow = { zeus_index: string; title: string; customer_group_id: string };

/**
 * Diccionario de títulos ⇄ textarea. En la UI es una línea por término con
 * `origen = destino`, que es lo que un operador puede mantener sin tocar JSON.
 * Una línea sin `=` se ignora; un destino vacío borra la entrada default.
 */
const parseDictionary = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (key) out[key] = line.slice(separator + 1).trim();
  }
  return out;
};

const formatDictionary = (dictionary: Record<string, string> | undefined): string =>
  Object.entries(dictionary ?? {})
    .map(([key, value]) => `${key} = ${value}`)
    .join('\n');

const parseLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Configuración de la extensión ERP: provider/país, llaves de flujo,
 * credenciales write-only (nunca se muestran), stock location destino,
 * reintentos del outbox y settings del provider elegido. "Validar conexión"
 * prueba las credenciales tipeadas sin guardar (dry-run) o las guardadas.
 */
const ErpConfigPage = () => {
  const { t, i18n } = useTranslation('erp');
  useErpTranslationsReady(i18n);

  const { data } = useErpConfig();
  const { data: locationsData } = useStockLocationOptions();
  const { data: priceListOptions } = useErpPriceListOptions();
  const config = data?.config ?? null;

  const [provider, setProvider] = useState('contabilium');
  const [countryCode, setCountryCode] = useState('AR');
  const [enabled, setEnabled] = useState(false);
  const [stockSyncEnabled, setStockSyncEnabled] = useState(false);
  const [catalogSyncEnabled, setCatalogSyncEnabled] = useState(false);
  const [salesNotifyEnabled, setSalesNotifyEnabled] = useState(false);
  /**
   * Cuándo se notifica la venta. Excluyentes: una venta se notifica UNA vez.
   * Default `payment_captured` = el comportamiento histórico, para que abrir esta
   * pantalla y guardar no cambie nada en una instalación que ya funciona.
   */
  const [salesTrigger, setSalesTrigger] = useState<'payment_captured' | 'fulfillment_created'>(
    'payment_captured'
  );
  /** Depósito facturador; sale del mapeo de depósitos de más abajo. */
  const [billingDeposito, setBillingDeposito] = useState('');
  // Catalog sync. Los defaults salen de medir la cuenta real: lista 1 = retail,
  // lista 4 = mayorista (= retail × 0.70).
  const [catBaseListIndex, setCatBaseListIndex] = useState('1');
  const [catCurrency, setCatCurrency] = useState('ars');
  const [catOnlyPublished, setCatOnlyPublished] = useState(true);
  const [catCreateProducts, setCatCreateProducts] = useState(false);
  /** Estado con el que nacen los artículos creados por el sync. */
  const [catCreatedStatus, setCatCreatedStatus] = useState<'draft' | 'published'>('draft');
  /**
   * Canales de venta de los productos creados. Sin al menos uno el producto no se
   * ve en la tienda ni estando `published`: `/store/*` scopea por los canales de
   * la publishable key.
   */
  const [catChannelIds, setCatChannelIds] = useState<string[]>([]);
  /** Espejar el estado de publicación del ERP sobre productos que ya existen. */
  const [catStatusSync, setCatStatusSync] = useState(false);
  const [catStatusUnpublishMissing, setCatStatusUnpublishMissing] = useState(false);
  const [catMaxUnpublishPct, setCatMaxUnpublishPct] = useState('10');
  /** Bajar las fotos del ERP y dejarlas como imagen del producto. */
  const [catImportImages, setCatImportImages] = useState(false);
  /**
   * Lado menor mínimo aceptado, en píxeles. Se guarda como string para que el
   * input reproduzca el pattern del resto del form (Input con .toString());
   * `''` significa "no lo mandes" y el motor cae al default (500). `0` es un
   * valor válido y desactiva el filtro por completo.
   */
  const [catImageMinDimensionPx, setCatImageMinDimensionPx] = useState('');
  const [catCategoriesSync, setCatCategoriesSync] = useState(false);
  const [catCategoriesSyncRank, setCatCategoriesSyncRank] = useState(false);
  const [catBrandsSync, setCatBrandsSync] = useState(false);
  const [catBrandsReplace, setCatBrandsReplace] = useState(true);
  const [catPriceLists, setCatPriceLists] = useState<PriceListRow[]>([]);
  const [catShippingProfileId, setCatShippingProfileId] = useState(NO_SHIPPING_PROFILE);
  const [catOverlapMinutes, setCatOverlapMinutes] = useState('30');
  const [catFullSweepHour, setCatFullSweepHour] = useState('4');
  /** Qué hace el barrido completo además de traer el catálogo entero. */
  const [catFullSweepImages, setCatFullSweepImages] = useState(false);
  const [catFullSweepPriceLists, setCatFullSweepPriceLists] = useState(true);
  const [catMaxChangePct, setCatMaxChangePct] = useState('40');
  const [catProductFields, setCatProductFields] = useState<ErpProductField[]>([]);
  /** Reglas de título (R01–R26). Prendidas por default; los overrides son opcionales. */
  const [catTitleRules, setCatTitleRules] = useState(true);
  const [catTitleStripBrand, setCatTitleStripBrand] = useState(true);
  const [catTitleDictionary, setCatTitleDictionary] = useState('');
  const [catTitlePromoLegends, setCatTitlePromoLegends] = useState('');
  /** Etiqueta de presentación en la opción de variante (lo que pinta la card del PLP). */
  const [catPresentationOption, setCatPresentationOption] = useState(false);
  /** Opcion Color derivada del titulo (el circulo de color en la card). */
  const [catColorOption, setCatColorOption] = useState(false);
  const [stockLocationId, setStockLocationId] = useState(AUTO_LOCATION);
  /** Depósito del ERP → stock location, uno a uno. Vacío = una sola location. */
  const [depositoMap, setDepositoMap] = useState<
    Array<{ deposito: string; stock_location_id: string }>
  >([]);
  /** Canales a los que se acota el sync de stock. Vacío = toda la tienda. */
  const [stockChannelIds, setStockChannelIds] = useState<string[]>([]);

  /** Claves guardadas marcadas para borrar en el próximo guardado. */

  /** Sistema tintométrico (entonado de bases). Arranca apagado. */
  const [tintingEnabled, setTintingEnabled] = useState(false);
  const [tintingCollection, setTintingCollection] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [baseDelay, setBaseDelay] = useState('');
  const [maxDelay, setMaxDelay] = useState('');
  const [cblBaseUrl, setCblBaseUrl] = useState('');
  const [cblDepositoId, setCblDepositoId] = useState('');
  const [cblSaleMode, setCblSaleMode] =
    useState<NonNullable<ErpContabiliumSettings['sale_mode']>>('orden_venta');
  const [cblPuntoVentaId, setCblPuntoVentaId] = useState('');
  const [cblTipoFc, setCblTipoFc] = useState('FCB');
  const [cblCondicionVenta, setCblCondicionVenta] = useState('Contado');
  const [cblDefaultClientId, setCblDefaultClientId] = useState('');
  const [cblShippingSku, setCblShippingSku] = useState('');
  const [cblPricesIncludeTax, setCblPricesIncludeTax] = useState(true);
  const [bsaleBaseUrl, setBsaleBaseUrl] = useState('');
  const [bsaleOfficeId, setBsaleOfficeId] = useState('');
  const [bsaleDocTypeId, setBsaleDocTypeId] = useState('');
  const [bsalePriceListId, setBsalePriceListId] = useState('');
  const [bsalePaymentTypeId, setBsalePaymentTypeId] = useState('');
  const [bsaleTaxIds, setBsaleTaxIds] = useState('1');
  const [bsaleDeclareSii, setBsaleDeclareSii] = useState(false);
  const [bsaleDispatchStock, setBsaleDispatchStock] = useState(false);
  const [bsaleSendEmail, setBsaleSendEmail] = useState(false);
  const [bsalePricesIncludeTax, setBsalePricesIncludeTax] = useState(true);
  /**
   * Códigos válidos de la cuenta del ERP. Si el listado no llega, cada campo
   * degrada solo a texto libre: los seis fallan por separado y un select vacío
   * bloquearía una config que hoy se completa a mano.
   */
  const { data: lookups } = useErpConfigLookups();
  const lookupProps = (kind: string) => {
    const diagnostic = lookups?.diagnostics?.[kind];
    return {
      options: lookups?.options?.[kind],
      error: lookups?.errors?.[kind],
      // Filas que llegaron y no se pudieron leer: bug del normalizador, no algo
      // que el operador pueda resolver escribiendo mejor.
      unreadable: Boolean(diagnostic && diagnostic.received > 0 && diagnostic.usable === 0),
    };
  };

  const [zeusBaseUrl, setZeusBaseUrl] = useState('');
  const [zeusEcommerceId, setZeusEcommerceId] = useState('');
  const [zeusSucursal, setZeusSucursal] = useState('');
  const [zeusDepositoId, setZeusDepositoId] = useState('');
  const [zeusPtoVta, setZeusPtoVta] = useState('');
  const [zeusCodLista, setZeusCodLista] = useState('');
  const [zeusCondVenta, setZeusCondVenta] = useState('');
  const [zeusTipoComp, setZeusTipoComp] = useState('');
  const [zeusVendedor, setZeusVendedor] = useState('');
  const [zeusDefaultClient, setZeusDefaultClient] = useState('');
  const [zeusCodigoIva, setZeusCodigoIva] = useState('');
  const [zeusShippingCode, setZeusShippingCode] = useState('');
  const [zeusTipoPago, setZeusTipoPago] = useState('');
  const [zeusTarjeta, setZeusTarjeta] = useState('');
  const [zeusCreateClients, setZeusCreateClients] = useState(true);
  const [zeusEshopOnly, setZeusEshopOnly] = useState(false);
  const [zeusSubtractCommitted, setZeusSubtractCommitted] = useState(true);
  const [zeusPricesIncludeTax, setZeusPricesIncludeTax] = useState(true);
  // Odoo settings
  const [odooBaseUrl, setOdooBaseUrl] = useState('');
  const [odooDb, setOdooDb] = useState('');
  const [odooUid, setOdooUid] = useState('');
  const [odooAllowedCompanyIds, setOdooAllowedCompanyIds] = useState('');
  const [odooShippingItemCode, setOdooShippingItemCode] = useState('');
  const [odooOnlyPublished, setOdooOnlyPublished] = useState(false);
  const [odooAutoConfirm, setOdooAutoConfirm] = useState(true);

  // Precarga desde lo guardado. Las credenciales NUNCA vienen del backend:
  // las filas arrancan vacías y solo se envían si el usuario tipea algo.
  useEffect(() => {
    if (!config) return;
    setProvider(config.provider);
    setCountryCode(config.country_code);
    setEnabled(config.enabled);
    setStockSyncEnabled(config.stock_sync_enabled);
    setCatalogSyncEnabled(config.catalog_sync_enabled);
    setSalesNotifyEnabled(config.sales_notify_enabled);
    const salesNotify = config.settings.sales_notify ?? {};
    setSalesTrigger(salesNotify.trigger ?? 'payment_captured');
    setBillingDeposito(salesNotify.billing_deposito ?? '');
    const tinting = config.settings.tinting ?? {};
    setTintingEnabled(tinting.enabled ?? false);
    setTintingCollection(tinting.default_collection ?? '');
    const catalog = config.settings.catalog_sync ?? {};
    setCatBaseListIndex(catalog.base_list_index?.toString() ?? '1');
    setCatCurrency(catalog.currency_code ?? 'ars');
    setCatOnlyPublished(catalog.only_published ?? true);
    setCatCreateProducts(catalog.create_products ?? false);
    setCatCreatedStatus(catalog.created_product_status ?? 'draft');
    setCatChannelIds(catalog.sales_channel_ids ?? []);
    setCatStatusSync(catalog.status_sync ?? false);
    setCatStatusUnpublishMissing(catalog.status_sync_unpublish_missing ?? false);
    setCatMaxUnpublishPct(catalog.max_unpublish_pct?.toString() ?? '10');
    setCatImportImages(catalog.images?.enabled ?? false);
    setCatImageMinDimensionPx(
      catalog.images?.min_dimension_px != null ? catalog.images.min_dimension_px.toString() : ''
    );
    setCatCategoriesSync(catalog.categories_sync ?? false);
    setCatCategoriesSyncRank(catalog.categories_sync_rank ?? false);
    setCatBrandsSync(catalog.brands_sync ?? false);
    setCatBrandsReplace(catalog.brands_replace_existing ?? true);
    setCatPriceLists(
      (catalog.price_lists ?? []).map((mapping) => ({
        zeus_index: mapping.zeus_index.toString(),
        title: mapping.title,
        customer_group_id: mapping.customer_group_id ?? NO_CUSTOMER_GROUP,
      }))
    );
    setCatShippingProfileId(catalog.shipping_profile_id ?? NO_SHIPPING_PROFILE);
    setCatOverlapMinutes(catalog.overlap_minutes?.toString() ?? '30');
    setCatFullSweepHour(catalog.full_sweep_hour == null ? '' : catalog.full_sweep_hour.toString());
    setCatFullSweepImages(catalog.full_sweep?.images ?? false);
    setCatFullSweepPriceLists(catalog.full_sweep?.price_lists ?? true);
    setCatMaxChangePct(catalog.max_change_pct?.toString() ?? '40');
    setCatProductFields(catalog.product_fields ?? []);
    setCatTitleRules(catalog.title_rules?.enabled ?? true);
    setCatTitleStripBrand(catalog.title_rules?.strip_brand ?? true);
    setCatTitleDictionary(formatDictionary(catalog.title_rules?.dictionary));
    setCatTitlePromoLegends((catalog.title_rules?.promo_legends ?? []).join('\n'));
    setCatPresentationOption(catalog.presentation_option?.enabled ?? false);
    setCatColorOption(catalog.color_option?.enabled ?? false);
    setStockLocationId(config.settings.stock_location_id ?? AUTO_LOCATION);
    setDepositoMap(
      (config.settings.stock_sync?.deposito_map ?? []).map((row) => ({
        deposito: String(row.deposito ?? ''),
        stock_location_id: row.stock_location_id ?? '',
      }))
    );
    setStockChannelIds(config.settings.stock_sync?.sales_channel_ids ?? []);
    setMaxAttempts(config.settings.outbox?.max_attempts?.toString() ?? '');
    setBaseDelay(config.settings.outbox?.base_delay_s?.toString() ?? '');
    setMaxDelay(config.settings.outbox?.max_delay_s?.toString() ?? '');
    const contabilium = config.settings.contabilium ?? {};
    setCblBaseUrl(contabilium.base_url ?? '');
    setCblDepositoId(contabilium.deposito_id?.toString() ?? '');
    setCblSaleMode(contabilium.sale_mode ?? 'orden_venta');
    setCblPuntoVentaId(contabilium.punto_venta_id?.toString() ?? '');
    setCblTipoFc(contabilium.tipo_fc ?? 'FCB');
    setCblCondicionVenta(contabilium.condicion_venta ?? 'Contado');
    setCblDefaultClientId(contabilium.default_client_id?.toString() ?? '');
    setCblShippingSku(contabilium.shipping_concept_sku ?? '');
    setCblPricesIncludeTax(contabilium.prices_include_tax ?? true);
    const bsale = config.settings.bsale ?? {};
    setBsaleBaseUrl(bsale.base_url ?? '');
    setBsaleOfficeId(bsale.office_id?.toString() ?? '');
    setBsaleDocTypeId(bsale.document_type_id?.toString() ?? '');
    setBsalePriceListId(bsale.price_list_id?.toString() ?? '');
    setBsalePaymentTypeId(bsale.payment_type_id?.toString() ?? '');
    setBsaleTaxIds((bsale.tax_ids ?? [1]).join(', '));
    setBsaleDeclareSii(bsale.declare_sii ?? false);
    setBsaleDispatchStock(bsale.dispatch_stock ?? false);
    setBsaleSendEmail(bsale.send_email ?? false);
    setBsalePricesIncludeTax(bsale.prices_include_tax ?? true);
    const zeus = config.settings.zeus ?? {};
    setZeusBaseUrl(zeus.base_url ?? '');
    setZeusEcommerceId(zeus.ecommerce_id ?? '');
    setZeusSucursal(zeus.sucursal?.toString() ?? '');
    setZeusDepositoId(zeus.deposito_id?.toString() ?? '');
    setZeusPtoVta(zeus.pto_vta?.toString() ?? '');
    setZeusCodLista(zeus.cod_lista?.toString() ?? '');
    setZeusCondVenta(zeus.cond_venta ?? '');
    setZeusTipoComp(zeus.tipo_comp ?? '');
    setZeusVendedor(zeus.codigo_de_vendedor ?? '');
    setZeusDefaultClient(zeus.default_client_code ?? '');
    setZeusCodigoIva(zeus.default_codigo_iva?.toString() ?? '');
    setZeusShippingCode(zeus.shipping_item_code ?? '');
    setZeusTipoPago(zeus.tipo_pago ?? '');
    setZeusTarjeta(zeus.tarjeta_code ?? '');
    setZeusCreateClients(zeus.create_clients ?? true);
    setZeusEshopOnly(zeus.eshop_only ?? false);
    setZeusSubtractCommitted(zeus.subtract_committed ?? true);
    setZeusPricesIncludeTax(zeus.prices_include_tax ?? true);
    const odoo = config.settings.odoo ?? ({} as Partial<ErpOdooSettings>);
    setOdooBaseUrl(odoo.base_url ?? '');
    setOdooDb(odoo.db ?? '');
    setOdooUid(odoo.uid != null ? odoo.uid.toString() : '');
    setOdooAllowedCompanyIds(
      Array.isArray(odoo.allowed_company_ids) ? odoo.allowed_company_ids.join(',') : ''
    );
    setOdooShippingItemCode(odoo.shipping_item_code ?? '');
    setOdooOnlyPublished(odoo.only_published ?? false);
    setOdooAutoConfirm(odoo.auto_confirm ?? true);
  }, [config]);

  const { mutate: saveConfig, isPending: isSaving } = useUpdateErpConfig({
    onSuccess: () => {
      toast.success(t('CONFIG_SAVED'));
    },
    onError: (error) => toast.error(t('CONFIG_SAVE_ERROR', { msg: error.message })),
  });

  const { mutate: validateConnection, isPending: isValidating } = useValidateErpConnection({
    onSuccess: (result) => {
      if (result.ok) toast.success(t('CONFIG_VALIDATE_OK', { msg: result.message ?? 'OK' }));
      else toast.error(t('CONFIG_VALIDATE_FAILED', { msg: result.message ?? '' }));
    },
    onError: (error) => toast.error(t('CONFIG_VALIDATE_FAILED', { msg: error.message })),
  });

  const { mutate: resetImageFailures, isPending: isResettingImages } = useResetImageFailures({
    onSuccess: (result) =>
      toast.success(t('CFG_RESET_IMAGE_FAILURES_OK', { count: result.cleared })),
    onError: (error) => toast.error(t('CFG_RESET_IMAGE_FAILURES_ERROR', { msg: error.message })),
  });

  /**
   * `last_synced_at` y `categories_backfill_pending` NO se envían: los escribe
   * el motor y mandarlos desde acá los pisaría con un valor viejo. El backend
   * los preserva (`mergeErpSettings` baja un nivel dentro de `catalog_sync`);
   * `category_map` se arrastra explícito como defensa en profundidad, porque no
   * tiene UI y un backend viejo con merge plano lo borraría en cada guardado.
   */
  const buildCatalogSyncSettings = (): ErpCatalogSyncSettings => {
    const toInt = (value: string, fallback: number): number => {
      const num = Number(value.trim());
      return value.trim() && Number.isFinite(num) ? num : fallback;
    };
    return {
      currency_code: catCurrency.trim().toLowerCase() || 'ars',
      base_list_index: toInt(catBaseListIndex, 1),
      only_published: catOnlyPublished,
      create_products: catCreateProducts,
      created_product_status: catCreatedStatus,
      sales_channel_ids: catChannelIds,
      status_sync: catStatusSync,
      // Sin `status_sync` el sub-flag no significa nada: se manda apagado para que
      // prender el de arriba no arrastre un despublicado masivo por ausencia que
      // alguien dejó marcado hace meses.
      status_sync_unpublish_missing: catStatusSync && catStatusUnpublishMissing,
      max_unpublish_pct: toInt(catMaxUnpublishPct, 10),
      images: {
        enabled: catImportImages,
        // `min_dimension_px` viaja SOLO si el operador tipeó algo — vacío deja
        // que el motor use el default (`DEFAULT_MIN_IMAGE_DIMENSION_PX`, 500).
        // `0` es un valor válido explícito: desactiva el filtro.
        ...(catImageMinDimensionPx.trim() !== ''
          ? { min_dimension_px: toInt(catImageMinDimensionPx, 500) }
          : {}),
        // Prenderlo deja un backfill pendiente: la próxima corrida recorre el
        // catálogo completo para traer las fotos de los productos que ya están.
        // No se manda `false` nunca desde acá — lo apaga el motor al terminar bien.
        //
        // Y si YA había uno pendiente se ARRASTRA. Hoy `mergeErpSettings` ya
        // conserva las claves de `images` que no vengan en el patch, así que el
        // arrastre es redundante — se deja porque es el único lugar que expresa
        // "prender la opción deja un backfill pendiente", y no depender del
        // merge para eso es más barato que descubrirlo roto de nuevo: sin esto,
        // cualquier guardado de la config entre que se prende la opción y que
        // corre el sync borraba el flag en silencio.
        ...(catImportImages &&
        (!config?.settings?.catalog_sync?.images?.enabled ||
          config?.settings?.catalog_sync?.images?.backfill_pending)
          ? { backfill_pending: true }
          : {}),
      },
      categories_sync: catCategoriesSync,
      categories_sync_rank: catCategoriesSyncRank,
      brands_sync: catBrandsSync,
      brands_replace_existing: catBrandsReplace,
      product_fields: catProductFields,
      title_rules: {
        enabled: catTitleRules,
        strip_brand: catTitleStripBrand,
        dictionary: parseDictionary(catTitleDictionary),
        promo_legends: parseLines(catTitlePromoLegends),
      },
      color_option: {
        enabled: catColorOption,
        // Mismo arrastre que `images`: el merge reemplaza el objeto entero.
        ...(catColorOption &&
        (!config?.settings?.catalog_sync?.color_option?.enabled ||
          config?.settings?.catalog_sync?.color_option?.backfill_pending)
          ? { backfill_pending: true }
          : {}),
      },
      presentation_option: {
        enabled: catPresentationOption,
        // Prenderlo deja un backfill pendiente: la próxima corrida recorre el
        // catálogo completo para rellenar los placeholders que ya están. No se
        // manda `false` nunca desde acá — lo apaga el motor al terminar bien.
        // Mismo arrastre que `images`: el merge reemplaza el objeto entero.
        ...(catPresentationOption &&
        (!config?.settings?.catalog_sync?.presentation_option?.enabled ||
          config?.settings?.catalog_sync?.presentation_option?.backfill_pending)
          ? { backfill_pending: true }
          : {}),
      },
      ...(config?.settings?.catalog_sync?.category_map
        ? { category_map: config.settings.catalog_sync.category_map }
        : {}),
      shipping_profile_id:
        catShippingProfileId === NO_SHIPPING_PROFILE ? null : catShippingProfileId,
      overlap_minutes: toInt(catOverlapMinutes, 30),
      full_sweep_hour: catFullSweepHour.trim() === '' ? null : toInt(catFullSweepHour, 4),
      // Se mandan SIEMPRE las dos claves: `mergeErpSettings` reemplaza el objeto
      // entero, así que un parcial borraría la otra.
      full_sweep: { images: catFullSweepImages, price_lists: catFullSweepPriceLists },
      max_change_pct: toInt(catMaxChangePct, 40),
      price_lists: catPriceLists
        .filter((row) => row.title.trim())
        .map((row) => ({
          zeus_index: toInt(row.zeus_index, 4),
          title: row.title.trim(),
          customer_group_id:
            row.customer_group_id === NO_CUSTOMER_GROUP ? null : row.customer_group_id,
        })),
    };
  };

  const buildContabiliumSettings = (): ErpContabiliumSettings => {
    const toId = (value: string): number | null => {
      const num = Number(value.trim());
      return value.trim() && Number.isInteger(num) && num > 0 ? num : null;
    };
    return {
      ...(cblBaseUrl.trim() ? { base_url: cblBaseUrl.trim() } : {}),
      deposito_id: toId(cblDepositoId),
      sale_mode: cblSaleMode,
      punto_venta_id: toId(cblPuntoVentaId),
      tipo_fc: cblTipoFc.trim() || 'FCB',
      condicion_venta: cblCondicionVenta.trim() || 'Contado',
      default_client_id: toId(cblDefaultClientId),
      shipping_concept_sku: cblShippingSku.trim() || null,
      prices_include_tax: cblPricesIncludeTax,
    };
  };

  const buildBsaleSettings = (): ErpBsaleSettings => {
    const toId = (value: string): number | null => {
      const num = Number(value.trim());
      return value.trim() && Number.isInteger(num) && num > 0 ? num : null;
    };
    const taxIds = bsaleTaxIds
      .split(',')
      .map((raw) => Number(raw.trim()))
      .filter((num) => Number.isInteger(num) && num > 0);
    return {
      ...(bsaleBaseUrl.trim() ? { base_url: bsaleBaseUrl.trim() } : {}),
      office_id: toId(bsaleOfficeId),
      document_type_id: toId(bsaleDocTypeId),
      price_list_id: toId(bsalePriceListId),
      payment_type_id: toId(bsalePaymentTypeId),
      tax_ids: taxIds.length ? taxIds : [1],
      declare_sii: bsaleDeclareSii,
      dispatch_stock: bsaleDispatchStock,
      send_email: bsaleSendEmail,
      prices_include_tax: bsalePricesIncludeTax,
    };
  };

  const buildZeusSettings = (): ErpZeusSettings => {
    const toId = (value: string): number | null => {
      const num = Number(value.trim());
      return value.trim() && Number.isInteger(num) && num > 0 ? num : null;
    };
    return {
      ...(zeusBaseUrl.trim() ? { base_url: zeusBaseUrl.trim() } : {}),
      ecommerce_id: zeusEcommerceId.trim() || null,
      sucursal: toId(zeusSucursal),
      deposito_id: toId(zeusDepositoId),
      pto_vta: toId(zeusPtoVta),
      cod_lista: toId(zeusCodLista),
      cond_venta: zeusCondVenta.trim() || null,
      tipo_comp: zeusTipoComp.trim() || null,
      codigo_de_vendedor: zeusVendedor.trim() || null,
      default_client_code: zeusDefaultClient.trim() || null,
      create_clients: zeusCreateClients,
      default_codigo_iva: toId(zeusCodigoIva),
      shipping_item_code: zeusShippingCode.trim() || null,
      tipo_pago: zeusTipoPago.trim() || null,
      tarjeta_code: zeusTarjeta.trim() || null,
      eshop_only: zeusEshopOnly,
      subtract_committed: zeusSubtractCommitted,
      prices_include_tax: zeusPricesIncludeTax,
    };
  };

  const buildOdooSettings = (): ErpOdooSettings => {
    const parsedCompanyIds = odooAllowedCompanyIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    return {
      base_url: odooBaseUrl.trim(),
      db: odooDb.trim(),
      uid: Number.parseInt(odooUid, 10) || 0,
      ...(parsedCompanyIds.length ? { allowed_company_ids: parsedCompanyIds } : {}),
      ...(odooShippingItemCode.trim() ? { shipping_item_code: odooShippingItemCode.trim() } : {}),
      only_published: odooOnlyPublished,
      auto_confirm: odooAutoConfirm,
    };
  };

  const handleSave = () => {
    const outbox: Record<string, number> = {};
    if (maxAttempts.trim()) outbox.max_attempts = Number(maxAttempts);
    if (baseDelay.trim()) outbox.base_delay_s = Number(baseDelay);
    if (maxDelay.trim()) outbox.max_delay_s = Number(maxDelay);

    saveConfig({
      provider,
      country_code: countryCode,
      enabled,
      stock_sync_enabled: stockSyncEnabled,
      catalog_sync_enabled: catalogSyncEnabled,
      sales_notify_enabled: salesNotifyEnabled,
      settings: {
        stock_location_id: stockLocationId === AUTO_LOCATION ? null : stockLocationId,
        stock_sync: {
          deposito_map: depositoMap
            .map((row) => ({
              deposito: row.deposito.trim(),
              stock_location_id: row.stock_location_id,
            }))
            .filter((row) => row.deposito && row.stock_location_id),
          sales_channel_ids: stockChannelIds,
        },
        sales_notify: {
          trigger: salesTrigger,
          // Vacío se manda como `null` explícito: el merge de settings trata
          // `null` como "limpiar este valor", y una clave ausente como "no
          // tocar". Sin el null, borrar el depósito facturador no se podría.
          billing_deposito: billingDeposito.trim() || null,
        },
        catalog_sync: buildCatalogSyncSettings(),
        tinting: {
          enabled: tintingEnabled,
          default_collection: tintingCollection.trim() || null,
        },
        ...(Object.keys(outbox).length ? { outbox } : {}),
        ...(provider === 'contabilium' ? { contabilium: buildContabiliumSettings() } : {}),
        ...(provider === 'bsale' ? { bsale: buildBsaleSettings() } : {}),
        ...(provider === 'zeus' ? { zeus: buildZeusSettings() } : {}),
        ...(provider === 'odoo' ? { odoo: buildOdooSettings() } : {}),
      },
    });
  };

  const handleValidate = () => {
    // Con credenciales tipeadas valida esas sin persistir; si no, las guardadas.
    validateConnection({ provider });
  };

  /** Capabilities del provider guardado: la sección tintométrica sólo aplica si las declara. */
  const capabilities = data?.capabilities ?? null;
  const providers = data?.providers ?? [
    { id: 'contabilium', label: 'Contabilium (Argentina)', available: true },
    { id: 'bsale', label: 'Bsale (Chile)', available: true },
    { id: 'zeus', label: 'Zeus ERP (Argentina)', available: true },
  ];
  const countries = data?.countries ?? [{ id: 'AR', label: 'Argentina' }];
  const locations = locationsData?.stock_locations ?? [];

  /**
   * Opciones de depósito facturador: SOLO las filas del mapeo de depósitos que
   * están completas.
   *
   * Se derivan del estado en pantalla y no de lo guardado a propósito: si el
   * usuario acaba de agregar el depósito A al mapeo, tiene que poder elegirlo
   * como facturador en el mismo guardado. Y un depósito sin location no se
   * ofrece: elegirlo haría que el gate rechazara todos los despachos.
   */
  const billingDepositoOptions = depositoMap
    .filter((row) => row.deposito.trim() && row.stock_location_id)
    .map((row) => {
      const deposito = row.deposito.trim();
      const locationName =
        locations.find((location) => location.id === row.stock_location_id)?.name ?? null;
      return {
        value: deposito,
        label: locationName ? `${deposito} — ${locationName}` : deposito,
      };
    });

  const salesChannels = (priceListOptions?.sales_channels ?? []).filter((c) => !c.is_disabled);

  return (
    <SingleColumnLayout>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <Heading>{t('CONFIG_TITLE')}</Heading>
          <div className="flex items-center gap-2">
            <HelpDrawer slug="erp" />
            <Button
              variant="secondary"
              size="small"
              isLoading={isValidating}
              onClick={handleValidate}
            >
              {t('CONFIG_VALIDATE')}
            </Button>
            <Button size="small" isLoading={isSaving} onClick={handleSave}>
              {t('CONFIG_SAVE')}
            </Button>
          </div>
        </div>

        {/*
          `scope="instance"`, y la evidencia es doble. La ruta contra la que escribe este
          formulario —`admin/erp/config`— está declarada
          `{ state: 'not-applicable', reason: 'conexion al ERP de la empresa: es un
          sistema por instalacion, no por tienda' }` en
          `lib/multistore/scoped-routes.ts`, y su `route.ts` no menciona
          `siteFromRequest` ni una vez: no hay capa por tienda que elegir. El registro no
          es una promesa a futuro sino una decisión de producto — `not-applicable` existe
          justamente para separar "esto nunca va a filtrar" de "todavía no filtra".

          Se declara en vez de no mostrar nada porque más abajo esta misma pantalla monta
          una `ExtensionSettingsCard`: sin el cartel, el operador que ve una card con
          contexto de tienda y otra sin él lee "se olvidaron", no "no aplica". Es la misma
          razón que documenta `card-site-context.tsx` para la rama `instance`.

          `dirty={false}` NO es comodidad: con `scope="instance"` la franja no pinta
          selector y devuelve antes de tocar la prop, así que no hay cambio de tienda que
          pueda llevarse un borrador. La alternativa —derivar un dirty real— pedía
          comparar los ~60 `useState` de esta pantalla contra `config` campo por campo,
          un espejo que se desincroniza en silencio el día que alguien agrega el número 61
          y que no cambiaría absolutamente nada de lo que se renderiza.
        */}
        <CardSiteContext scope="instance" dirty={false} />

        <div className="flex flex-col gap-5 border-t px-6 py-4">
          {/* Provider + país */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>{t('FIELD_PROVIDER')}</Label>
              <Select value={provider} onValueChange={setProvider}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {providers.map((entry) => (
                    <Select.Item key={entry.id} value={entry.id} disabled={!entry.available}>
                      {entry.label}
                      {!entry.available ? ` ${t('CONFIG_PROVIDER_SOON')}` : ''}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('FIELD_COUNTRY')}</Label>
              <Select value={countryCode} onValueChange={setCountryCode}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {countries.map((entry) => (
                    <Select.Item key={entry.id} value={entry.id}>
                      {entry.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          </div>

          {/* Llaves */}
          <div className="flex flex-col gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <ErpSettingLabel
                htmlFor="erp-enabled"
                label={t('CONFIG_MASTER')}
                hint={t('CONFIG_MASTER_HINT')}
              />
              <Switch
                className="shrink-0"
                id="erp-enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="erp-stock">{t('CONFIG_STOCK')}</Label>
              <Switch
                className="shrink-0"
                id="erp-stock"
                checked={stockSyncEnabled}
                onCheckedChange={setStockSyncEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="erp-catalog">{t('CFG_CATALOG_ENABLED')}</Label>
              <Switch
                className="shrink-0"
                id="erp-catalog"
                checked={catalogSyncEnabled}
                onCheckedChange={setCatalogSyncEnabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="erp-sales">{t('CONFIG_SALES')}</Label>
              <Switch
                className="shrink-0"
                id="erp-sales"
                checked={salesNotifyEnabled}
                onCheckedChange={setSalesNotifyEnabled}
              />
            </div>

            {/*
              Cuándo se notifica la venta. Colgado del switch de arriba y
              deshabilitado cuando está apagado: son opciones de ESE flujo, no
              flujos nuevos.

              Es un RadioGroup y no dos Checkbox aunque se pidiera como "doble
              check": dos casillas mutuamente excluyentes SON un radio group.
              Emularlo con checkboxes obliga a apagar la otra a mano, rompe la
              navegación por teclado y los lectores de pantalla anuncian dos
              controles independientes que en realidad no lo son. Visualmente
              son las mismas dos opciones.
            */}
            <div
              className={`ml-6 flex flex-col gap-2 border-l border-ui-border-base pl-4 ${
                salesNotifyEnabled ? '' : 'pointer-events-none opacity-50'
              }`}
            >
              <RadioGroup
                value={salesTrigger}
                onValueChange={(value) =>
                  setSalesTrigger(value as 'payment_captured' | 'fulfillment_created')
                }
                disabled={!salesNotifyEnabled}
              >
                <div className="flex items-start gap-2">
                  <RadioGroup.Item
                    value="payment_captured"
                    id="erp-sales-trigger-order"
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <Label htmlFor="erp-sales-trigger-order" weight="plus">
                      {t('CONFIG_SALES_TRIGGER_ORDER')}
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('CONFIG_SALES_TRIGGER_ORDER_HINT')}
                    </Text>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <RadioGroup.Item
                    value="fulfillment_created"
                    id="erp-sales-trigger-fulfillment"
                    className="mt-1"
                  />
                  <div className="flex flex-col">
                    <Label htmlFor="erp-sales-trigger-fulfillment" weight="plus">
                      {t('CONFIG_SALES_TRIGGER_FULFILLMENT')}
                    </Label>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('CONFIG_SALES_TRIGGER_FULFILLMENT_HINT')}
                    </Text>
                  </div>
                </div>
              </RadioGroup>

              {salesTrigger === 'fulfillment_created' && (
                <div className="mt-2 flex flex-col gap-2">
                  <Label htmlFor="erp-billing-deposito">{t('CONFIG_BILLING_DEPOSITO')}</Label>
                  {billingDepositoOptions.length ? (
                    <Select
                      value={billingDeposito}
                      onValueChange={setBillingDeposito}
                      disabled={!salesNotifyEnabled}
                    >
                      <Select.Trigger id="erp-billing-deposito">
                        <Select.Value placeholder={t('CONFIG_BILLING_DEPOSITO_PLACEHOLDER')} />
                      </Select.Trigger>
                      <Select.Content>
                        {billingDepositoOptions.map((option) => (
                          <Select.Item key={option.value} value={option.value}>
                            {option.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  ) : (
                    <Text size="xsmall" className="text-ui-fg-error">
                      {t('CONFIG_BILLING_DEPOSITO_EMPTY')}
                    </Text>
                  )}
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BILLING_DEPOSITO_HINT')}
                  </Text>
                  {/*
                    El auto-fulfill de carrier crea el fulfillment SOLO, sobre
                    order.placed/payment.captured y sin elegir ubicación. Con
                    este trigger, esos fulfillments no facturan (no son
                    confirmación humana) — hay que decirlo acá o el cliente
                    espera comprobantes que nunca van a salir.
                  */}
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_SALES_TRIGGER_AUTOFULFILL_WARNING')}
                  </Text>
                </div>
              )}
            </div>

            <Text size="xsmall" className="text-ui-fg-subtle">
              {t('CONFIG_CRON_HINT')}
            </Text>
          </div>

          {/* Stock location */}
          <div className="flex flex-col gap-2">
            <Label>{t('CONFIG_LOCATION')}</Label>
            <Select value={stockLocationId} onValueChange={setStockLocationId}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value={AUTO_LOCATION}>{t('CONFIG_LOCATION_AUTO')}</Select.Item>
                {locations.map((location) => (
                  <Select.Item key={location.id} value={location.id}>
                    {location.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Text size="xsmall" className="text-ui-fg-muted">
              {t('CONFIG_LOCATION_HINT_MAP')}
            </Text>
          </div>

          {/* Depósitos del ERP → stock locations */}
          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
            <div className="flex flex-col">
              <Label>{t('CONFIG_DEPOSITO_MAP_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONFIG_DEPOSITO_MAP_HELP')}
              </Text>
            </div>
            {depositoMap.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="max-w-[140px]"
                  placeholder={t('CONFIG_DEPOSITO_CODE')}
                  value={row.deposito}
                  onChange={(event) =>
                    setDepositoMap((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, deposito: event.target.value } : r))
                    )
                  }
                />
                <Select
                  value={row.stock_location_id}
                  onValueChange={(value) =>
                    setDepositoMap((prev) =>
                      prev.map((r, i) => (i === index ? { ...r, stock_location_id: value } : r))
                    )
                  }
                >
                  <Select.Trigger>
                    <Select.Value placeholder={t('CONFIG_LOCATION')} />
                  </Select.Trigger>
                  <Select.Content className="z-[60]">
                    {locations.map((location) => (
                      <Select.Item key={location.id} value={location.id}>
                        {location.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
                <Button
                  variant="transparent"
                  size="small"
                  onClick={() => setDepositoMap((prev) => prev.filter((_, i) => i !== index))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="small"
              className="w-fit"
              onClick={() =>
                setDepositoMap((prev) => [...prev, { deposito: '', stock_location_id: '' }])
              }
            >
              {t('CONFIG_DEPOSITO_MAP_ADD')}
            </Button>
          </div>

          {/* Acotar el sync a canales */}
          <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
            <div className="flex flex-col">
              <Label>{t('CONFIG_STOCK_CHANNELS_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONFIG_STOCK_CHANNELS_HELP')}
              </Text>
            </div>
            <div className="flex flex-col gap-2">
              {salesChannels.map((channel) => (
                <label key={channel.id} className="txt-small flex items-center gap-2">
                  <Checkbox
                    checked={stockChannelIds.includes(channel.id)}
                    onCheckedChange={(checked) =>
                      setStockChannelIds((prev) =>
                        checked ? [...prev, channel.id] : prev.filter((id) => id !== channel.id)
                      )
                    }
                  />
                  {channel.name}
                </label>
              ))}
              {!salesChannels.length ? (
                <Text size="xsmall" className="text-ui-fg-muted">
                  —
                </Text>
              ) : null}
            </div>
          </div>

          {/* Catálogo y precios */}
          <div className="flex flex-col gap-4 rounded-lg border p-4">
            <div className="flex flex-col">
              <Label>{t('CFG_CATALOG_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CFG_CATALOG_HELP')}
              </Text>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <ErpSettingLabel
                  size="xsmall"
                  label={t('CFG_BASE_LIST_INDEX')}
                  hint={t('CFG_BASE_LIST_HELP')}
                />
                <Input
                  type="number"
                  min={0}
                  max={9}
                  value={catBaseListIndex}
                  onChange={(event) => setCatBaseListIndex(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label size="xsmall">{t('CFG_CURRENCY')}</Label>
                <Input
                  value={catCurrency}
                  maxLength={3}
                  onChange={(event) => setCatCurrency(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <ErpSettingLabel
                  size="xsmall"
                  label={t('CFG_SHIPPING_PROFILE')}
                  hint={t('CFG_SHIPPING_PROFILE_HELP')}
                />
                <Select value={catShippingProfileId} onValueChange={setCatShippingProfileId}>
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={NO_SHIPPING_PROFILE}>—</Select.Item>
                    {(priceListOptions?.shipping_profiles ?? []).map((profile) => (
                      <Select.Item key={profile.id} value={profile.id}>
                        {profile.name}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>

            {/*
              El caso que rompió la importación del cliente: no había NINGÚN
              shipping profile en la tienda, así que el select estaba vacío y no
              había forma de darse cuenta desde acá. El sync ahora cancela las
              altas en vez de colgar los productos de un profile arbitrario, así
              que este aviso es lo que explica por qué no se creó nada.
            */}
            {catCreateProducts && !(priceListOptions?.shipping_profiles ?? []).length && (
              <Text size="xsmall" className="text-ui-fg-error">
                {t('CFG_SHIPPING_PROFILE_NONE')}
              </Text>
            )}

            {/* Mapeo lista del ERP → price list de Medusa */}
            <div className="flex flex-col gap-2">
              <Label size="xsmall">{t('CFG_PRICE_LISTS')}</Label>
              {catPriceLists.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 items-end gap-2 md:grid-cols-[90px_1fr_1fr_auto]"
                >
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-muted">
                      {t('CFG_PRICE_LIST_INDEX')}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={9}
                      value={row.zeus_index}
                      onChange={(event) =>
                        setCatPriceLists((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, zeus_index: event.target.value } : r
                          )
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-muted">
                      {t('CFG_PRICE_LIST_TITLE')}
                    </Label>
                    <Input
                      value={row.title}
                      placeholder="Mayorista"
                      onChange={(event) =>
                        setCatPriceLists((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, title: event.target.value } : r
                          )
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label size="xsmall" className="text-ui-fg-muted">
                      {t('CFG_PRICE_LIST_GROUP')}
                    </Label>
                    <Select
                      value={row.customer_group_id}
                      onValueChange={(value) =>
                        setCatPriceLists((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, customer_group_id: value } : r))
                        )
                      }
                    >
                      <Select.Trigger>
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value={NO_CUSTOMER_GROUP}>
                          {t('CFG_PRICE_LIST_GROUP_NONE')}
                        </Select.Item>
                        {(priceListOptions?.customer_groups ?? []).map((group) => (
                          <Select.Item key={group.id} value={group.id}>
                            {group.name}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select>
                  </div>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setCatPriceLists((rows) => rows.filter((_, i) => i !== index))}
                  >
                    {t('CFG_PRICE_LIST_REMOVE')}
                  </Button>
                </div>
              ))}
              <Button
                size="small"
                variant="secondary"
                className="w-fit"
                onClick={() =>
                  setCatPriceLists((rows) => [
                    ...rows,
                    // Default = el mapeo real del cliente: lista 4 es la mayorista.
                    { zeus_index: '4', title: 'Mayorista', customer_group_id: NO_CUSTOMER_GROUP },
                  ])
                }
              >
                {t('CFG_PRICE_LIST_ADD')}
              </Button>
            </div>

            {/* Campos de producto que el ERP puede pisar */}
            <div className="flex flex-col gap-2">
              <ErpSettingLabel
                size="xsmall"
                label={t('CFG_PRODUCT_FIELDS')}
                hint={t('CFG_PRODUCT_FIELDS_HELP')}
              />
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {PRODUCT_FIELD_OPTIONS.map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Switch
                      className="shrink-0"
                      id={`cat-field-${field}`}
                      checked={catProductFields.includes(field)}
                      onCheckedChange={(checked) =>
                        setCatProductFields((fields) =>
                          checked ? [...fields, field] : fields.filter((f) => f !== field)
                        )
                      }
                    />
                    <Label htmlFor={`cat-field-${field}`} size="xsmall">
                      {field}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Normalización de títulos (reglas R01–R26) */}
            <div className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-title-rules"
                  label={t('CFG_TITLE_RULES')}
                  hint={t('CFG_TITLE_RULES_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-title-rules"
                  checked={catTitleRules}
                  onCheckedChange={setCatTitleRules}
                />
              </div>
              {catTitleRules && (
                <>
                  <div className="flex items-center justify-between gap-4 pl-4">
                    <ErpSettingLabel
                      htmlFor="cat-title-strip-brand"
                      label={t('CFG_TITLE_STRIP_BRAND')}
                      hint={t('CFG_TITLE_STRIP_BRAND_HELP')}
                    />
                    <Switch
                      className="shrink-0"
                      id="cat-title-strip-brand"
                      checked={catTitleStripBrand}
                      onCheckedChange={setCatTitleStripBrand}
                    />
                  </div>
                  <div className="flex flex-col gap-1 pl-4">
                    <ErpSettingLabel
                      size="xsmall"
                      label={t('CFG_TITLE_DICTIONARY')}
                      hint={t('CFG_TITLE_DICTIONARY_HELP')}
                    />
                    <Textarea
                      rows={5}
                      value={catTitleDictionary}
                      placeholder={'electricas = eléctricas\nzocalo = zócalo\ndr. ox. = Dr. Ox.'}
                      onChange={(event) => setCatTitleDictionary(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 pl-4">
                    <ErpSettingLabel
                      size="xsmall"
                      label={t('CFG_TITLE_PROMO_LEGENDS')}
                      hint={t('CFG_TITLE_PROMO_LEGENDS_HELP')}
                    />
                    <Textarea
                      rows={3}
                      value={catTitlePromoLegends}
                      placeholder={'ultimas unidades\nsemana del cliente'}
                      onChange={(event) => setCatTitlePromoLegends(event.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between gap-4 border-t border-ui-border-base pt-3">
                <ErpSettingLabel
                  htmlFor="cat-presentation-option"
                  label={t('CFG_PRESENTATION_OPTION')}
                  hint={t('CFG_PRESENTATION_OPTION_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-presentation-option"
                  checked={catPresentationOption}
                  onCheckedChange={setCatPresentationOption}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-color-option"
                  label={t('CFG_COLOR_OPTION')}
                  hint={t('CFG_COLOR_OPTION_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-color-option"
                  checked={catColorOption}
                  onCheckedChange={setCatColorOption}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label size="xsmall">{t('CFG_OVERLAP_MINUTES')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={catOverlapMinutes}
                  onChange={(event) => setCatOverlapMinutes(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <ErpSettingLabel
                  size="xsmall"
                  label={t('CFG_FULL_SWEEP_HOUR')}
                  hint={t('CFG_FULL_SWEEP_HOUR_HELP')}
                />
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={catFullSweepHour}
                  onChange={(event) => setCatFullSweepHour(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <ErpSettingLabel
                  size="xsmall"
                  label={t('CFG_MAX_CHANGE_PCT')}
                  hint={t('CFG_MAX_CHANGE_HELP')}
                />
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={catMaxChangePct}
                  onChange={(event) => setCatMaxChangePct(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="cat-only-published">{t('CFG_ONLY_PUBLISHED')}</Label>
                <Switch
                  className="shrink-0"
                  id="cat-only-published"
                  checked={catOnlyPublished}
                  onCheckedChange={setCatOnlyPublished}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-create-products"
                  label={t('CFG_CREATE_PRODUCTS')}
                  hint={t('CFG_CREATE_PRODUCTS_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-create-products"
                  checked={catCreateProducts}
                  onCheckedChange={setCatCreateProducts}
                />
              </div>
              {catCreateProducts && (
                <div className="flex flex-col gap-1 pl-4">
                  <ErpSettingLabel
                    size="xsmall"
                    label={t('CFG_CREATED_STATUS')}
                    hint={t('CFG_CREATED_STATUS_HELP')}
                  />
                  <Select
                    value={catCreatedStatus}
                    onValueChange={(value) => setCatCreatedStatus(value as 'draft' | 'published')}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="draft">{t('CFG_CREATED_STATUS_DRAFT')}</Select.Item>
                      <Select.Item value="published">
                        {t('CFG_CREATED_STATUS_PUBLISHED')}
                      </Select.Item>
                    </Select.Content>
                  </Select>
                  <ErpSettingLabel
                    size="xsmall"
                    label={t('CFG_CREATED_CHANNELS')}
                    hint={t('CFG_CREATED_CHANNELS_HELP')}
                  />
                  <div className="flex flex-col gap-2">
                    {salesChannels.map((channel) => (
                      <label key={channel.id} className="txt-small flex items-center gap-2">
                        <Checkbox
                          checked={catChannelIds.includes(channel.id)}
                          onCheckedChange={(checked) =>
                            setCatChannelIds((prev) =>
                              checked
                                ? [...prev, channel.id]
                                : prev.filter((id) => id !== channel.id)
                            )
                          }
                        />
                        {channel.name}
                      </label>
                    ))}
                    {!salesChannels.length ? (
                      <Text size="xsmall" className="text-ui-fg-muted">
                        —
                      </Text>
                    ) : null}
                  </div>
                  {/*
                    Publicar sin canal deja el producto invisible en la tienda, y el
                    síntoma ("lo importé publicado y no aparece") no señala la causa.
                    Se avisa acá, en lugar de elegir un canal por default: adivinar
                    en una plataforma con varias tiendas publica el catálogo de un
                    cliente en la tienda de otro.
                  */}
                  {catCreatedStatus === 'published' && !catChannelIds.length ? (
                    <Text size="xsmall" className="text-ui-fg-error">
                      {t('CFG_CREATED_CHANNELS_WARNING')}
                    </Text>
                  ) : null}
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-status-sync"
                  label={t('CFG_STATUS_SYNC')}
                  hint={t('CFG_STATUS_SYNC_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-status-sync"
                  checked={catStatusSync}
                  onCheckedChange={setCatStatusSync}
                />
              </div>
              {catStatusSync && (
                <div className="flex flex-col gap-3 pl-4">
                  <div className="flex items-center justify-between gap-4">
                    <ErpSettingLabel
                      size="xsmall"
                      htmlFor="cat-status-unpublish-missing"
                      label={t('CFG_STATUS_UNPUBLISH_MISSING')}
                      hint={t('CFG_STATUS_UNPUBLISH_MISSING_HELP')}
                    />
                    <Switch
                      className="shrink-0"
                      id="cat-status-unpublish-missing"
                      checked={catStatusUnpublishMissing}
                      onCheckedChange={setCatStatusUnpublishMissing}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <ErpSettingLabel
                      size="xsmall"
                      htmlFor="cat-max-unpublish-pct"
                      label={t('CFG_MAX_UNPUBLISH_PCT')}
                      hint={t('CFG_MAX_UNPUBLISH_PCT_HELP')}
                    />
                    <Input
                      id="cat-max-unpublish-pct"
                      value={catMaxUnpublishPct}
                      onChange={(event) => setCatMaxUnpublishPct(event.target.value)}
                      placeholder="10"
                    />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-import-images"
                  label={t('CFG_IMPORT_IMAGES')}
                  hint={t('CFG_IMPORT_IMAGES_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-import-images"
                  checked={catImportImages}
                  onCheckedChange={setCatImportImages}
                />
              </div>
              {catImportImages && (
                <div className="flex flex-col gap-3 pl-4">
                  <div className="flex flex-col gap-1">
                    <ErpSettingLabel
                      size="xsmall"
                      htmlFor="cat-image-min-dimension-px"
                      label={t('CFG_IMAGE_MIN_DIMENSION_PX')}
                      hint={t('CFG_IMAGE_MIN_DIMENSION_PX_HELP')}
                    />
                    <Input
                      id="cat-image-min-dimension-px"
                      value={catImageMinDimensionPx}
                      onChange={(event) => setCatImageMinDimensionPx(event.target.value)}
                      placeholder="500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <ErpSettingLabel
                      size="xsmall"
                      label={t('CFG_RESET_IMAGE_FAILURES')}
                      hint={t('CFG_RESET_IMAGE_FAILURES_HELP')}
                    />
                    <Button
                      variant="secondary"
                      size="small"
                      className="shrink-0"
                      isLoading={isResettingImages}
                      disabled={isResettingImages}
                      onClick={() => {
                        // `window.confirm` es el pattern del resto del admin
                        // para acciones destructivas de baja frecuencia; una
                        // modal a medida sumaría superficie sin cambiar el UX
                        // efectivo (una sola confirmación bloqueante).
                        if (window.confirm(t('CFG_RESET_IMAGE_FAILURES_CONFIRM'))) {
                          resetImageFailures();
                        }
                      }}
                    >
                      {t('CFG_RESET_IMAGE_FAILURES_BUTTON')}
                    </Button>
                  </div>
                </div>
              )}
              {/*
                Alcance del barrido completo. Va acá y no en la grilla de números
                porque son decisiones de "qué trabajo hace", no de calendario.
              */}
              <div className="flex flex-col gap-3 border-t border-ui-border-base pt-3">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('CFG_FULL_SWEEP_SCOPE_TITLE')}
                </Text>
                <div className="flex items-center justify-between gap-4 pl-4">
                  <ErpSettingLabel
                    htmlFor="cat-full-sweep-images"
                    label={t('CFG_FULL_SWEEP_IMAGES')}
                    hint={t('CFG_FULL_SWEEP_IMAGES_HELP')}
                  />
                  <Switch
                    className="shrink-0"
                    id="cat-full-sweep-images"
                    checked={catFullSweepImages}
                    onCheckedChange={setCatFullSweepImages}
                  />
                </div>
                <div className="flex items-center justify-between gap-4 pl-4">
                  <ErpSettingLabel
                    htmlFor="cat-full-sweep-price-lists"
                    label={t('CFG_FULL_SWEEP_PRICE_LISTS')}
                    hint={t('CFG_FULL_SWEEP_PRICE_LISTS_HELP')}
                  />
                  <Switch
                    className="shrink-0"
                    id="cat-full-sweep-price-lists"
                    checked={catFullSweepPriceLists}
                    onCheckedChange={setCatFullSweepPriceLists}
                  />
                </div>
                {!catFullSweepPriceLists && (
                  <Text size="xsmall" className="pl-4 text-ui-fg-error">
                    {t('CFG_FULL_SWEEP_PRICE_LISTS_WARN')}
                  </Text>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-categories-sync"
                  label={t('CFG_CATEGORIES_SYNC')}
                  hint={t('CFG_CATEGORIES_SYNC_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-categories-sync"
                  checked={catCategoriesSync}
                  onCheckedChange={setCatCategoriesSync}
                />
              </div>
              {catCategoriesSync && (
                <div className="flex items-center justify-between gap-4 pl-4">
                  <ErpSettingLabel
                    htmlFor="cat-categories-rank"
                    label={t('CFG_CATEGORIES_SYNC_RANK')}
                    hint={t('CFG_CATEGORIES_SYNC_RANK_HELP')}
                  />
                  <Switch
                    className="shrink-0"
                    id="cat-categories-rank"
                    checked={catCategoriesSyncRank}
                    onCheckedChange={setCatCategoriesSyncRank}
                  />
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  htmlFor="cat-brands-sync"
                  label={t('CFG_BRANDS_SYNC')}
                  hint={t('CFG_BRANDS_SYNC_HELP')}
                />
                <Switch
                  className="shrink-0"
                  id="cat-brands-sync"
                  checked={catBrandsSync}
                  onCheckedChange={setCatBrandsSync}
                />
              </div>
              {catBrandsSync && (
                <div className="flex items-center justify-between gap-4 pl-4">
                  <ErpSettingLabel
                    htmlFor="cat-brands-replace"
                    label={t('CFG_BRANDS_REPLACE')}
                    hint={t('CFG_BRANDS_REPLACE_HELP')}
                  />
                  <Switch
                    className="shrink-0"
                    id="cat-brands-replace"
                    checked={catBrandsReplace}
                    onCheckedChange={setCatBrandsReplace}
                  />
                </div>
              )}
            </div>

            <Text size="xsmall" className="text-ui-fg-muted">
              {t('CFG_LAST_SYNCED_AT')}:{' '}
              {config?.settings.catalog_sync?.last_synced_at ?? t('CFG_LAST_SYNCED_NONE')}
            </Text>
            {config?.settings.catalog_sync?.images?.backfill_pending && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CFG_IMAGES_BACKFILL_PENDING')}
              </Text>
            )}
            {config?.settings.catalog_sync?.categories_backfill_pending && (
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CFG_CATEGORIES_BACKFILL_PENDING')}
              </Text>
            )}
          </div>

          {/* Sistema tintométrico (entonado de bases) */}
          {capabilities?.tinting_price ? (
            <div className="flex flex-col gap-3 rounded-lg border border-ui-border-base p-4">
              <div className="flex items-center justify-between gap-4">
                <ErpSettingLabel
                  label={t('CONFIG_TINTING_TITLE')}
                  hint={t('CONFIG_TINTING_HINT')}
                />
                <Switch
                  className="shrink-0"
                  checked={tintingEnabled}
                  onCheckedChange={setTintingEnabled}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('CONFIG_TINTING_COLLECTION')}
                </Text>
                <Input
                  placeholder="ALBAHYO"
                  value={tintingCollection}
                  onChange={(event) => setTintingCollection(event.target.value)}
                />
                <Text size="xsmall" className="text-ui-fg-muted">
                  {t('CONFIG_TINTING_COLLECTION_HINT')}
                </Text>
              </div>
            </div>
          ) : null}

          {/* Reintentos del outbox */}
          <div className="flex flex-col gap-2">
            <Label>{t('CONFIG_OUTBOX_TITLE')}</Label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('CONFIG_OUTBOX_MAX')}
                </Text>
                <Input
                  type="number"
                  value={maxAttempts}
                  onChange={(e) => setMaxAttempts(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('CONFIG_OUTBOX_BASE')}
                </Text>
                <Input
                  type="number"
                  value={baseDelay}
                  onChange={(e) => setBaseDelay(e.target.value)}
                  placeholder="60"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {t('CONFIG_OUTBOX_MAXDELAY')}
                </Text>
                <Input
                  type="number"
                  value={maxDelay}
                  onChange={(e) => setMaxDelay(e.target.value)}
                  placeholder="1800"
                />
              </div>
            </div>
          </div>

          {/* Bsale */}
          {provider === 'bsale' ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <Label>{t('CONFIG_BSALE_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONFIG_BSALE_HINT')}
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BSALE_BASE_URL')}
                  </Text>
                  <Input
                    value={bsaleBaseUrl}
                    onChange={(e) => setBsaleBaseUrl(e.target.value)}
                    placeholder="https://api.bsale.io"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BSALE_OFFICE')}
                  </Text>
                  <Input
                    type="number"
                    value={bsaleOfficeId}
                    onChange={(e) => setBsaleOfficeId(e.target.value)}
                    placeholder="1"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_BSALE_OFFICE_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BSALE_DOCTYPE')}
                  </Text>
                  <Input
                    type="number"
                    value={bsaleDocTypeId}
                    onChange={(e) => setBsaleDocTypeId(e.target.value)}
                    placeholder="8"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_BSALE_DOCTYPE_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BSALE_PRICELIST')}
                  </Text>
                  <Input
                    type="number"
                    value={bsalePriceListId}
                    onChange={(e) => setBsalePriceListId(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BSALE_PAYMENT')}
                  </Text>
                  <Input
                    type="number"
                    value={bsalePaymentTypeId}
                    onChange={(e) => setBsalePaymentTypeId(e.target.value)}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_BSALE_PAYMENT_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_BSALE_TAXES')}
                  </Text>
                  <Input
                    value={bsaleTaxIds}
                    onChange={(e) => setBsaleTaxIds(e.target.value)}
                    placeholder="1"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_BSALE_TAXES_HINT')}
                  </Text>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="bsale-prices-tax">{t('CONFIG_BSALE_PRICES_TAX')}</Label>
                <Switch
                  className="shrink-0"
                  id="bsale-prices-tax"
                  checked={bsalePricesIncludeTax}
                  onCheckedChange={setBsalePricesIncludeTax}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('CONFIG_BSALE_PRICES_TAX_HINT')}
              </Text>
              <div className="flex items-center justify-between">
                <Label htmlFor="bsale-declare-sii">{t('CONFIG_BSALE_DECLARE_SII')}</Label>
                <Switch
                  className="shrink-0"
                  id="bsale-declare-sii"
                  checked={bsaleDeclareSii}
                  onCheckedChange={setBsaleDeclareSii}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="bsale-dispatch">{t('CONFIG_BSALE_DISPATCH')}</Label>
                <Switch
                  className="shrink-0"
                  id="bsale-dispatch"
                  checked={bsaleDispatchStock}
                  onCheckedChange={setBsaleDispatchStock}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="bsale-send-email">{t('CONFIG_BSALE_SEND_EMAIL')}</Label>
                <Switch
                  className="shrink-0"
                  id="bsale-send-email"
                  checked={bsaleSendEmail}
                  onCheckedChange={setBsaleSendEmail}
                />
              </div>
            </div>
          ) : null}

          {/* Contabilium */}
          {provider === 'contabilium' ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <Label>{t('CONFIG_CBL_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONFIG_CBL_HINT')}
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_CBL_BASE_URL')}
                  </Text>
                  <Input
                    value={cblBaseUrl}
                    onChange={(e) => setCblBaseUrl(e.target.value)}
                    placeholder="https://rest.contabilium.com"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_CBL_DEPOSITO')}
                  </Text>
                  <Input
                    type="number"
                    value={cblDepositoId}
                    onChange={(e) => setCblDepositoId(e.target.value)}
                    placeholder="31293"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_CBL_DEPOSITO_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_CBL_SALE_MODE')}
                  </Text>
                  <Select
                    value={cblSaleMode}
                    onValueChange={(v) => setCblSaleMode(v as typeof cblSaleMode)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="orden_venta">{t('CONFIG_CBL_MODE_ORDEN')}</Select.Item>
                      <Select.Item value="factura_cobrada">
                        {t('CONFIG_CBL_MODE_FACTURA')}
                      </Select.Item>
                    </Select.Content>
                  </Select>
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_CBL_SALE_MODE_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_CBL_DEFAULT_CLIENT')}
                  </Text>
                  <Input
                    type="number"
                    value={cblDefaultClientId}
                    onChange={(e) => setCblDefaultClientId(e.target.value)}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_CBL_DEFAULT_CLIENT_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_CBL_SHIPPING_SKU')}
                  </Text>
                  <Input
                    value={cblShippingSku}
                    onChange={(e) => setCblShippingSku(e.target.value)}
                    placeholder="ENVIO"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_CBL_SHIPPING_SKU_HINT')}
                  </Text>
                </div>
              </div>
              {cblSaleMode === 'factura_cobrada' ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('CONFIG_CBL_PUNTO_VENTA')}
                    </Text>
                    <Input
                      type="number"
                      value={cblPuntoVentaId}
                      onChange={(e) => setCblPuntoVentaId(e.target.value)}
                      placeholder="59419"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('CONFIG_CBL_TIPO_FC')}
                    </Text>
                    <Input
                      value={cblTipoFc}
                      onChange={(e) => setCblTipoFc(e.target.value)}
                      placeholder="FCB"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {t('CONFIG_CBL_CONDICION')}
                    </Text>
                    <Input
                      value={cblCondicionVenta}
                      onChange={(e) => setCblCondicionVenta(e.target.value)}
                      placeholder="Contado"
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <Label htmlFor="cbl-prices-tax">{t('CONFIG_CBL_PRICES_TAX')}</Label>
                <Switch
                  className="shrink-0"
                  id="cbl-prices-tax"
                  checked={cblPricesIncludeTax}
                  onCheckedChange={setCblPricesIncludeTax}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('CONFIG_CBL_PRICES_TAX_HINT')}
              </Text>
            </div>
          ) : null}

          {/* Zeus */}
          {provider === 'zeus' ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <Label>{t('CONFIG_ZEUS_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONFIG_ZEUS_HINT')}
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_BASE_URL')}
                  </Text>
                  <Input
                    value={zeusBaseUrl}
                    onChange={(e) => setZeusBaseUrl(e.target.value)}
                    placeholder="https://api.zeuserp.tech/api-ecommerce"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_ECOMMERCE_ID')}
                  </Text>
                  <Input
                    value={zeusEcommerceId}
                    onChange={(e) => setZeusEcommerceId(e.target.value)}
                    placeholder="medusa"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ZEUS_ECOMMERCE_ID_HINT')}
                  </Text>
                </div>
                <ErpCodeField
                  numeric
                  label={t('CONFIG_ZEUS_SUCURSAL')}
                  value={zeusSucursal}
                  onChange={setZeusSucursal}
                  {...lookupProps('sucursales')}
                />
                <ErpCodeField
                  numeric
                  label={t('CONFIG_ZEUS_DEPOSITO')}
                  value={zeusDepositoId}
                  onChange={setZeusDepositoId}
                  help={t('CONFIG_ZEUS_DEPOSITO_HINT')}
                  {...lookupProps('depositos')}
                />
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_PTO_VTA')}
                  </Text>
                  <Input
                    type="number"
                    value={zeusPtoVta}
                    onChange={(e) => setZeusPtoVta(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_COD_LISTA')}
                  </Text>
                  <Input
                    type="number"
                    value={zeusCodLista}
                    onChange={(e) => setZeusCodLista(e.target.value)}
                  />
                </div>
                <ErpCodeField
                  label={t('CONFIG_ZEUS_COND_VENTA')}
                  value={zeusCondVenta}
                  onChange={setZeusCondVenta}
                  {...lookupProps('condiciones-ventas')}
                />
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_TIPO_COMP')}
                  </Text>
                  <Input
                    value={zeusTipoComp}
                    onChange={(e) => setZeusTipoComp(e.target.value)}
                    placeholder="PE"
                  />
                </div>
                <ErpCodeField
                  label={t('CONFIG_ZEUS_VENDEDOR')}
                  value={zeusVendedor}
                  onChange={setZeusVendedor}
                  {...lookupProps('vendedores')}
                />
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_DEFAULT_CLIENT')}
                  </Text>
                  <Input
                    value={zeusDefaultClient}
                    onChange={(e) => setZeusDefaultClient(e.target.value)}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ZEUS_DEFAULT_CLIENT_HINT')}
                  </Text>
                </div>
                <ErpCodeField
                  numeric
                  label={t('CONFIG_ZEUS_CODIGO_IVA')}
                  value={zeusCodigoIva}
                  onChange={setZeusCodigoIva}
                  help={t('CONFIG_ZEUS_CODIGO_IVA_HINT')}
                  {...lookupProps('categorias-iva')}
                />
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_SHIPPING_CODE')}
                  </Text>
                  <Input
                    value={zeusShippingCode}
                    onChange={(e) => setZeusShippingCode(e.target.value)}
                    placeholder="ENVIO"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ZEUS_SHIPPING_CODE_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ZEUS_TIPO_PAGO')}
                  </Text>
                  <Input value={zeusTipoPago} onChange={(e) => setZeusTipoPago(e.target.value)} />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ZEUS_TIPO_PAGO_HINT')}
                  </Text>
                </div>
                <ErpCodeField
                  label={t('CONFIG_ZEUS_TARJETA')}
                  value={zeusTarjeta}
                  onChange={setZeusTarjeta}
                  {...lookupProps('tarjetas')}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="zeus-create-clients">{t('CONFIG_ZEUS_CREATE_CLIENTS')}</Label>
                <Switch
                  className="shrink-0"
                  id="zeus-create-clients"
                  checked={zeusCreateClients}
                  onCheckedChange={setZeusCreateClients}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="zeus-eshop-only">{t('CONFIG_ZEUS_ESHOP_ONLY')}</Label>
                <Switch
                  className="shrink-0"
                  id="zeus-eshop-only"
                  checked={zeusEshopOnly}
                  onCheckedChange={setZeusEshopOnly}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="zeus-subtract-committed">
                  {t('CONFIG_ZEUS_SUBTRACT_COMMITTED')}
                </Label>
                <Switch
                  className="shrink-0"
                  id="zeus-subtract-committed"
                  checked={zeusSubtractCommitted}
                  onCheckedChange={setZeusSubtractCommitted}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="zeus-prices-tax">{t('CONFIG_ZEUS_PRICES_TAX')}</Label>
                <Switch
                  className="shrink-0"
                  id="zeus-prices-tax"
                  checked={zeusPricesIncludeTax}
                  onCheckedChange={setZeusPricesIncludeTax}
                />
              </div>
              <Text size="xsmall" className="text-ui-fg-muted">
                {t('CONFIG_ZEUS_PRICES_TAX_HINT')}
              </Text>
            </div>
          ) : null}

          {/* Odoo */}
          {provider === 'odoo' ? (
            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <Label>{t('CONFIG_ODOO_TITLE')}</Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {t('CONFIG_ODOO_HINT')}
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ODOO_BASE_URL')}
                  </Text>
                  <Input
                    value={odooBaseUrl}
                    onChange={(e) => setOdooBaseUrl(e.target.value)}
                    placeholder="https://tienda.midominio.com"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ODOO_BASE_URL_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ODOO_DB')}
                  </Text>
                  <Input
                    value={odooDb}
                    onChange={(e) => setOdooDb(e.target.value)}
                    placeholder="odoo"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ODOO_DB_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ODOO_UID')}
                  </Text>
                  <Input
                    type="number"
                    value={odooUid}
                    onChange={(e) => setOdooUid(e.target.value)}
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ODOO_UID_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ODOO_ALLOWED_COMPANY_IDS')}
                  </Text>
                  <Input
                    value={odooAllowedCompanyIds}
                    onChange={(e) => setOdooAllowedCompanyIds(e.target.value)}
                    placeholder="1,3"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ODOO_ALLOWED_COMPANY_IDS_HINT')}
                  </Text>
                </div>
                <div className="flex flex-col gap-1">
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {t('CONFIG_ODOO_SHIPPING_ITEM_CODE')}
                  </Text>
                  <Input
                    value={odooShippingItemCode}
                    onChange={(e) => setOdooShippingItemCode(e.target.value)}
                    placeholder="ENVIO"
                  />
                  <Text size="xsmall" className="text-ui-fg-muted">
                    {t('CONFIG_ODOO_SHIPPING_ITEM_CODE_HINT')}
                  </Text>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="odoo-only-published">{t('CONFIG_ODOO_ONLY_PUBLISHED')}</Label>
                <Switch
                  className="shrink-0"
                  id="odoo-only-published"
                  checked={odooOnlyPublished}
                  onCheckedChange={setOdooOnlyPublished}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="odoo-auto-confirm">{t('CONFIG_ODOO_AUTO_CONFIRM')}</Label>
                <Switch
                  className="shrink-0"
                  id="odoo-auto-confirm"
                  checked={odooAutoConfirm}
                  onCheckedChange={setOdooAutoConfirm}
                />
              </div>
            </div>
          ) : null}
        </div>
      </Container>

      {/*
        Card SIN campos editables: las 7 variables del ERP son todas `envOnly`, así
        que lo único que se renderiza es el bloque "Sólo por entorno" con la razón de
        cada una. No es relleno — es la respuesta a la pregunta que se hace cualquiera
        que llega hasta acá: "¿por qué la frecuencia del sync no está en esta
        pantalla?". Hoy esa respuesta vive en un comentario de `jobs/` que nadie va a
        encontrar. Mismo criterio que `descriptors/mercadopago.ts`.

        Y ojo con la trampa que esta card previene: `STOCK_LOCATION` y
        `SHIPPING_PROFILE` NO son lo mismo que el depósito y el perfil de envío que se
        editan más arriba. Aquellos son `erp_config` y gobiernan el sync; estos son
        NOMBRES que sólo lee el importador VTEX de una sola pasada. Por eso van como
        referencia de sólo lectura y no como dos inputs más al lado de los selects
        buenos: ver `descriptors/erp.ts`.
      */}
      {/*
        `hideSiteContext`: los descriptores de `extension:erp` son `defaultScope:
        'instance'`, o sea que esta card mostraría el mismo cartel de "configuración
        de la instancia" que la franja de arriba ya muestra para toda la pantalla.
        Dos veces la misma frase en la misma vista no informa el doble: hace dudar de
        si están hablando de lo mismo.

        Se apaga ésta y no la de arriba porque la de arriba cubre la pantalla entera.
      */}
      <ExtensionSettingsCard
        namespace="extension:erp"
        title="Variables de entorno del ERP"
        description="Las opciones de arranque del ERP, con el motivo por el que ninguna se edita desde el admin."
        hideSiteContext
      />

      <Toaster />
    </SingleColumnLayout>
  );
};

export const config = defineRouteConfig({
  label: 'Configuración',
  rank: 1,
});

export const handle = {
  breadcrumb: () => 'Configuración',
};

export default ErpConfigPage;
