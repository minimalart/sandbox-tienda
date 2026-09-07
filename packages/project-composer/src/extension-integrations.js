const middlewareDefinitions = {
  // El webhook de Kapso necesita el body crudo para verificar la firma HMAC: sin
  // registrarlo acá, un proyecto generado instalaría la ruta sin `preserveRawBody`
  // y con el secret seteado descartaría todos los mensajes entrantes.
  'ai-assistant': [
    ['./admin/ai-assistant/middlewares', 'adminAiAssistantMiddlewares'],
    ['./mcp/middlewares', 'mcpMiddlewares'],
    ['./mcp/oauth/middlewares', 'mcpOAuthMiddlewares'],
    ['./webhooks/kapso/middlewares', 'kapsoWebhookMiddlewares'],
  ],
  brands: [['./admin/brands/middlewares', 'adminBrandsMiddlewares']],
  catalogador: [['./admin/catalogador/middlewares', 'adminCatalogadorMiddlewares']],
  'seo-geo': [['./admin/seo-geo/middlewares', 'adminSeoGeoMiddlewares']],
  'shop-by-looks': [['./admin/shop-by-looks/middlewares', 'adminShopByLooksMiddlewares']],
  'pdf-catalog': [['./admin/pdf-catalogs/middlewares', 'adminPdfCatalogsMiddlewares']],
  ga4: [
    ['./admin/ga4-mappings/middlewares', 'adminGa4MappingsMiddlewares'],
    ['./admin/ga4-builtins/middlewares', 'adminGa4BuiltinsMiddlewares'],
  ],
  comments: [
    ['./admin/comments/middlewares', 'adminCommentsMiddlewares'],
    ['./store/comments/middlewares', 'storeCommentsMiddlewares'],
  ],
  delivery: [
    ['./admin/delivery/middlewares', 'adminDeliveryMiddlewares'],
    ['./store/delivery/middlewares', 'storeDeliveryMiddlewares'],
  ],
  // El store de tintometría es del ERP: sin registrarlo acá, un proyecto generado
  // con la extensión instalaría las rutas pero sin zod ni rate limit, y el
  // configurador del PDP quedaría sin `validatedBody` (500 en la primera llamada).
  erp: [
    ['./admin/erp/middlewares', 'adminErpMiddlewares'],
    ['./store/tinting/middlewares', 'storeTintingMiddlewares'],
    // Las rutas store del comprobante EXIGEN customer autenticado: sin
    // registrarlo acá, un proyecto generado instalaría la descarga sin
    // `authenticate('customer')` y cualquiera con un order_id podría bajar la
    // factura de otra persona (nombre, CUIT y detalle de compra adentro).
    ['./store/erp/middlewares', 'storeErpMiddlewares'],
  ],
  whatsapp: [['./admin/kapso/middlewares', 'adminKapsoMiddlewares']],
  videos: [
    ['./admin/videos/middlewares', 'adminVideosMiddlewares'],
    ['./admin/vimeo/middlewares', 'adminVimeoMiddlewares'],
  ],
  'loyalty-points': [['./store/points/middlewares', 'storePointsMiddlewares']],
  'loyalty-engine': [
    ['./admin/loyalty/middlewares', 'adminLoyaltyMiddlewares'],
    ['./store/loyalty/middlewares', 'storeLoyaltyMiddlewares'],
  ],
  'gift-cards': [
    ['./admin/gift-card-experience/middlewares', 'adminGiftCardExperienceMiddlewares'],
    ['./store/gift-card-experience/middlewares', 'storeGiftCardExperienceMiddlewares'],
    ['./webhooks/sendgrid-gift-cards/middlewares', 'sendGridGiftCardWebhookMiddlewares'],
  ],
  // Los batch-link de categoría/colección/sales-channel no emiten evento ni
  // exponen hooks: sin este middleware el índice queda atrás hasta el cron.
  typesense: [['./admin/typesense/link-reindex-middlewares', 'typesenseLinkReindexMiddlewares']],
  'store-locations': [['./store/store-locations/middlewares', 'storeStoreLocationsMiddlewares']],
  corporate: [['./store/corporates/middlewares', 'storeCorporatesMiddlewares']],
  b2b: [
    ['./store/billing-profiles/middlewares', 'storeBillingProfilesMiddlewares'],
    ['./store/companies/middlewares', 'storeCompaniesMiddlewares'],
  ],
  'recurring-orders': [['./store/recurring-orders/middlewares', 'storeRecurringOrdersMiddlewares']],
  mercadopago: [['./store/mercadopago/middlewares', 'storeMercadopagoMiddlewares']],
  // El refactor multisitio movió estos middlewares de `admin/demo-stores/` a
  // `admin/sites/`, pero corrigió a mano el `extension-middlewares.ts` GENERADO
  // sin actualizar este mapping. Resultado: cualquiera que corriera
  // `extract-components.js` regeneraba el import viejo y rompía el typecheck con
  // `Cannot find module './admin/demo-stores/middlewares'`. La ruta real es
  // `apps/backend/src/api/admin/sites/middlewares.ts`.
  // (El mapping de `adminHookDefinitions` sí sigue siendo `demo-stores`: ese hook
  // no se movió, `admin/hooks/api/demo-stores.tsx` existe.)
  'demo-creator': [['./admin/sites/middlewares', 'adminSitesMiddlewares']],
  'recommendation-engine': [
    ['./admin/recommendations/middlewares', 'adminRecommendationsMiddlewares'],
    ['./store/recommendations/middlewares', 'storeRecommendationsMiddlewares'],
  ],
};

const adminHookDefinitions = {
  andreani: ['andreani'], 'correo-argentino': ['correo-argentino'],
  brands: ['brands'], catalogador: ['catalogador'], banners: ['banners'], comments: ['comments'],
  'demo-creator': ['demo-stores'], ga4: ['ga4-mappings'],
  delivery: ['delivery', 'delivery-analytics', 'delivery-routes'], erp: ['erp'],
  // `whatsapp-conversations` existía desde el PR del handoff pero nunca se
  // registró, así que el panel de atención humana no tenía forma de importarlo.
  whatsapp: ['kapso', 'whatsapp-advisor', 'whatsapp-conversations'],
  'shop-by-looks': ['shop-by-looks'], 'store-config': ['store-config', 'email-branding'],
  'store-locations': ['store-locations'], typesense: ['typesense'], b2b: ['billing-profiles', 'companies', 'company-credit'],
  corporate: ['corporates'], 'dynamic-groups': ['dynamic-groups'], contact: ['contact-submissions'],
  newsletter: ['newsletter-subscriptions'],
  'email-templates': ['email-templates'], 'landing-pages': ['landing-pages'], 'media-library': ['media-library'],
  'payment-benefits': ['payment-benefits'], 'recommendation-engine': ['recommendations'],
  'recurring-orders': ['recurring-orders'], videos: ['videos'],
  'pdf-catalog': ['pdf-catalogs'],
  'database-explorer': ['database-explorer'], 'commerce-dashboard': ['commerce-dashboard'],
  'abandoned-cart': ['abandoned-carts'], 'checkout-links': ['checkout-links'], blog: ['blog'],
  'gift-cards': ['gift-cards'], 'seo-geo': ['seo-geo'],
};

const adminTranslationDefinitions = {
  andreani: ['andreani', 'andreani'],
  // Namespace camelCase (`correoArgentino`) porque es una clave de objeto en el
  // i18n generado, no un path: el folder sigue siendo kebab.
  'correo-argentino': ['correo-argentino', 'correoArgentino'],
  banners: ['banners', 'banners'], brands: ['brands', 'brands'],
  catalogador: ['catalogador', 'catalogador'],
  'store-config': ['store-config', 'storeConfig'], 'store-locations': ['store-locations', 'storeLocations'],
  typesense: ['typesense', 'typesense'], videos: ['videos', 'videos'], whatsapp: ['whatsapp', 'whatsapp'],
};

/**
 * Middlewares que van SIEMPRE, no por extensión seleccionada.
 *
 * `site-credentials` es core: la ruta vive en `src/api/admin/` y llega a todo
 * proyecto elija lo que elija. Antes su import estaba agregado A MANO en
 * `extension-middlewares.ts`, que es un archivo GENERADO — la próxima corrida
 * del composer lo borraba y el POST perdía su `validateAndTransformBody`,
 * dejando `req.validatedBody` undefined. Es el mismo modo de falla que el
 * comentario de `demo-creator` documenta en ese archivo.
 */
const coreMiddlewares = [['./admin/site-credentials/middlewares', 'adminSiteCredentialsMiddlewares']];

function renderExtensionMiddlewares(ids) {
  const definitions = [...coreMiddlewares, ...ids.flatMap((id) => middlewareDefinitions[id] || [])];
  const imports = definitions.map(([modulePath, exportName]) =>
    `import { ${exportName} } from '${modulePath}';`
  );
  const spreads = definitions.map(([, exportName]) => `  ...${exportName},`);
  return [
    "import type { MiddlewareRoute } from '@medusajs/medusa';",
    ...imports,
    '',
    'export const extensionMiddlewares: MiddlewareRoute[] = [',
    ...spreads,
    '];',
    '',
  ].join('\n');
}

function renderAdminHookIndex(ids) {
  // `app-settings` y `site-credentials` son CORE, no extensiones: van en la lista
  // base junto con customers y variants. Si estuvieran en `adminHookDefinitions`
  // dependerían de que se seleccione alguna extensión, y sus pantallas las usan
  // todas — la de credenciales es la que habilita configurar por tienda cualquier
  // integración, así que sacarla dejaría proyectos sin forma de hacerlo.
  const hooks = [
    'app-settings',
    'customers',
    'site-credentials',
    'variants',
    ...ids.flatMap((id) => adminHookDefinitions[id] || []),
  ];
  return `${[...new Set(hooks)].sort().map((hook) => `export * from './${hook}';`).join('\n')}\n`;
}

function renderAdminI18n(ids) {
  const definitions = ids.map((id) => adminTranslationDefinitions[id]).filter(Boolean);
  const imports = definitions.map(([folder, namespace]) =>
    `import { en as ${namespace}En, es as ${namespace}Es } from '../translations/${folder}';`
  );
  const entries = (language) => definitions.map(([, namespace]) =>
    `    ${namespace}: ${namespace}${language},`
  );
  return [
    ...imports,
    "import { en as widgetsEn, es as widgetsEs } from '../translations/widgets';",
    '', 'export default {', '  en: {', ...entries('En'), '    widgets: widgetsEn,', '  },',
    '  es: {', ...entries('Es'), '    widgets: widgetsEs,', '  },', '};', '',
  ].join('\n');
}

function renderGiftCardConfiguratorSlot(ids) {
  if (ids.includes('gift-cards')) {
    return `import type { HttpTypes } from '@medusajs/types'\nimport GiftCardConfigurator from '@modules/products/components/gift-card-configurator'\n\nexport const giftCardExperienceAvailable = true\nexport default function GiftCardConfiguratorSlot(props: { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion; countryCode: string }) { return <GiftCardConfigurator {...props} /> }\n`;
  }
  return `import type { HttpTypes } from '@medusajs/types'\n\nexport const giftCardExperienceAvailable = false\nexport default function GiftCardConfiguratorSlot(_props: { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion; countryCode: string }) { return null }\n`;
}

/**
 * Slot del core hacia `recommendation-widgets` (mismo patrón que el configurador de
 * gift cards). Los archivos core importan SIEMPRE desde `lib/recommendations-slot`
 * porque el composer borra del snapshot lo que pertenece a una extensión no
 * seleccionada: un import directo a `@modules/recommendations/...` reventaría
 * `next build` en esos proyectos, y `assertRelativeImportsResolve` no lo detecta
 * porque sólo valida imports relativos.
 *
 * La variante sin la extensión devuelve `null` en todo, de modo que el PDP y los
 * rails legacy siguen funcionando con su lógica propia.
 */
function renderRecommendationSlots(ids) {
  const header = [
    '// GENERADO por packages/project-composer (renderRecommendationSlots).',
    '// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.',
    '',
  ].join('\n');

  if (ids.includes('recommendation-widgets')) {
    return `${header}import 'server-only';
import type { HttpTypes } from '@medusajs/types';
import {
  createGetRecommendations,
  RecommendationsPdpSlot as PluginPdpSlot,
  RecommendationCarousel as PluginCarousel,
  type RecommendationRequest,
  type RecommendationResponse,
} from '@minimalart/mercatto-plugin-storefront-recommendations/slots';
import { sdk } from '@lib/config';
import { getActiveSalesChannelId, getAuthHeaders, getCartId } from '@lib/data/cookies';
import { getProductsByIds } from '@lib/data/products';
import { getRegion } from '@lib/data/regions';
import FeaturedProductCard from '@modules/home/components/featured-product-card';

export const recommendationWidgetsAvailable = true;

const boundGetRecommendations = createGetRecommendations({
  sdk: sdk as unknown as Parameters<typeof createGetRecommendations>[0]['sdk'],
  cookies: {
    getCartId: async () => (await getCartId()) ?? null,
    getActiveSalesChannelId: async () => (await getActiveSalesChannelId()) ?? null,
    getAuthHeaders: async () => {
      const headers = await getAuthHeaders();
      return (headers ?? {}) as Record<string, string>;
    },
  },
  getRegion: async (countryCode: string) => (await getRegion(countryCode)) ?? null,
});

export const getEngineRecommendations = async (
  request: RecommendationRequest,
): Promise<RecommendationResponse | null> => boundGetRecommendations(request);

const bindGetProductsByIds =
  (countryCode: string) =>
  async (input: { productIds: string[]; countryCode?: string }): Promise<HttpTypes.StoreProduct[]> =>
    getProductsByIds({
      productIds: input.productIds,
      countryCode: input.countryCode ?? countryCode,
    });

export function RecommendationRail(props: {
  requestId: string | null;
  title: string;
  products: HttpTypes.StoreProduct[];
  region: HttpTypes.StoreRegion;
  headingId?: string;
}) {
  return <PluginCarousel {...props} CardComponent={FeaturedProductCard} />;
}

export function RecommendationsPdpSlot(props: {
  product: HttpTypes.StoreProduct;
  region: HttpTypes.StoreRegion;
  countryCode: string;
}) {
  return (
    <PluginPdpSlot
      {...props}
      getRecommendations={boundGetRecommendations}
      getProductsByIds={bindGetProductsByIds(props.countryCode)}
      CardComponent={FeaturedProductCard}
    />
  );
}
`;
  }

  return `${header}import type { HttpTypes } from '@medusajs/types'

export const recommendationWidgetsAvailable = false

export const getEngineRecommendations = async (_request: unknown): Promise<null> => null

export function RecommendationRail(_props: Record<string, unknown>) { return null }

export function RecommendationsPdpSlot(_props: {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  countryCode: string
}) {
  return null
}
`;
}

/**
 * Slot CLIENTE de los widgets de carrito.
 *
 * Va en un archivo aparte del slot del PDP porque ese es un módulo de SERVIDOR (arrastra
 * `lib/data/recommendations.ts`, que es `server-only`) y estos widgets son `"use client"`:
 * un mismo archivo no puede ser las dos cosas.
 */
function renderRecommendationCartSlots(ids) {
  const header = [
    "'use client'",
    '',
    '// GENERADO por packages/project-composer (renderRecommendationCartSlots).',
    '// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.',
    '',
  ].join('\n');

  if (ids.includes('recommendation-widgets')) {
    return `${header}import type { HttpTypes } from '@medusajs/types';
import {
  RecommendationsCartSlot as PluginCartRecommendations,
  FreeShippingBridgeSlot as PluginFreeShippingBridge,
} from '@minimalart/mercatto-plugin-storefront-recommendations/slots';
import FeaturedProductCard from '@modules/home/components/featured-product-card';

export function CartRecommendations(props: {
  countryCode: string;
  region: HttpTypes.StoreRegion;
}) {
  return <PluginCartRecommendations {...props} CardComponent={FeaturedProductCard} />;
}

export function FreeShippingBridge(props: {
  countryCode: string;
  region: HttpTypes.StoreRegion;
  shippingOptions?: HttpTypes.StoreCartShippingOption[] | null;
}) {
  return <PluginFreeShippingBridge {...props} CardComponent={FeaturedProductCard} />;
}
`;
  }

  return `${header}import type { HttpTypes } from '@medusajs/types'

export function CartRecommendations(_props: {
  countryCode: string
  region: HttpTypes.StoreRegion
}) {
  return null
}

export function FreeShippingBridge(_props: {
  countryCode: string
  region: HttpTypes.StoreRegion
  shippingOptions?: HttpTypes.StoreCartShippingOption[] | null
}) {
  return null
}
`;
}

/**
 * Slot del core hacia el botón flotante de WhatsApp (mismo patrón que el
 * configurador de gift cards y los widgets de recomendaciones).
 *
 * El layout de storefront importa SIEMPRE desde `lib/whatsapp-slot`, porque el
 * composer borra del snapshot los archivos de una extensión no seleccionada: un
 * import directo a `@modules/whatsapp/...` reventaría `next build` en los
 * proyectos sin la extensión. La variante sin WhatsApp devuelve `null`.
 *
 * Deliberadamente FUERA de `component-definitions` (ownership de whatsapp):
 * este archivo tiene que sobrevivir en los proyectos que NO la seleccionan.
 */
function renderWhatsappFloatingSlot(ids) {
  const header = [
    '// GENERADO por packages/project-composer (renderWhatsappFloatingSlot).',
    '// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.',
    '',
  ].join('\n');

  if (ids.includes('whatsapp')) {
    return `${header}import { getWhatsappFloatingButton } from '@lib/data/whatsapp'
import WhatsappFloatingButton from '@modules/whatsapp/components/floating-button'

export const whatsappFloatingButtonAvailable = true

/**
 * Monta el botón flotante solo si está activado en Admin → WhatsApp → Ajustes y
 * tiene un teléfono válido; si no, no renderiza nada.
 */
export async function WhatsappFloatingButtonSlot() {
  const config = await getWhatsappFloatingButton()
  if (!config) return null
  return <WhatsappFloatingButton label={config.label} message={config.message} phone={config.phone} />
}
`;
  }

  return `${header}export const whatsappFloatingButtonAvailable = false

export async function WhatsappFloatingButtonSlot() {
  return null
}
`;
}

/** Core navigation survives when optional designer routes and data are omitted. */
function renderSpaceDesignerSlot(ids) {
  const header = [
    '// GENERADO por packages/project-composer (renderSpaceDesignerSlot).',
    '// No editar a mano: lo reescribe `pnpm site:components:extract` y `pnpm site:create`.',
    '',
  ].join('\n');
  if (ids.includes('space-designer')) {
    return `${header}export { getSpaceConfigurators } from '@lib/data/space-designer';\n`;
  }
  return `${header}export async function getSpaceConfigurators(): Promise<never[]> { return []; }\n`;
}

module.exports = {
  adminHookDefinitions, adminTranslationDefinitions, middlewareDefinitions,
  renderAdminHookIndex, renderAdminI18n, renderExtensionMiddlewares, renderGiftCardConfiguratorSlot,
  renderRecommendationSlots, renderRecommendationCartSlots, renderWhatsappFloatingSlot,
  renderSpaceDesignerSlot,
};
