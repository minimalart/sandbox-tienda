import type { MiddlewareRoute } from '@medusajs/medusa';
import { adminSiteCredentialsMiddlewares } from './admin/site-credentials/middlewares';
import { storeMercadopagoMiddlewares } from './store/mercadopago/middlewares';
import { typesenseLinkReindexMiddlewares } from './admin/typesense/link-reindex-middlewares';
import { storeStoreLocationsMiddlewares } from './store/store-locations/middlewares';
import { storeRecurringOrdersMiddlewares } from './store/recurring-orders/middlewares';
import { storeBillingProfilesMiddlewares } from './store/billing-profiles/middlewares';
import { storeCompaniesMiddlewares } from './store/companies/middlewares';
import { storeCorporatesMiddlewares } from './store/corporates/middlewares';
import { adminDeliveryMiddlewares } from './admin/delivery/middlewares';
import { storeDeliveryMiddlewares } from './store/delivery/middlewares';
import { adminErpMiddlewares } from './admin/erp/middlewares';
import { storeTintingMiddlewares } from './store/tinting/middlewares';
import { storeErpMiddlewares } from './store/erp/middlewares';
import { adminKapsoMiddlewares } from './admin/kapso/middlewares';
import { adminAiAssistantMiddlewares } from './admin/ai-assistant/middlewares';
import { mcpMiddlewares } from './mcp/middlewares';
import { mcpOAuthMiddlewares } from './mcp/oauth/middlewares';
import { kapsoWebhookMiddlewares } from './webhooks/kapso/middlewares';
import { adminSeoGeoMiddlewares } from './admin/seo-geo/middlewares';
import { adminRecommendationsMiddlewares } from './admin/recommendations/middlewares';
import { storeRecommendationsMiddlewares } from './store/recommendations/middlewares';
import { adminSitesMiddlewares } from './admin/sites/middlewares';
import { adminPriceListsMiddlewares } from './admin/price-lists/middlewares';
import { adminBundlesMiddlewares } from './admin/bundles/middlewares';
import { storeBundlesMiddlewares } from './store/bundles/middlewares';

export const extensionMiddlewares: MiddlewareRoute[] = [
  ...adminSiteCredentialsMiddlewares,
  ...storeMercadopagoMiddlewares,
  ...typesenseLinkReindexMiddlewares,
  ...storeStoreLocationsMiddlewares,
  ...storeRecurringOrdersMiddlewares,
  ...storeBillingProfilesMiddlewares,
  ...storeCompaniesMiddlewares,
  ...storeCorporatesMiddlewares,
  ...adminDeliveryMiddlewares,
  ...storeDeliveryMiddlewares,
  ...adminErpMiddlewares,
  ...storeTintingMiddlewares,
  ...storeErpMiddlewares,
  ...adminKapsoMiddlewares,
  ...adminAiAssistantMiddlewares,
  ...mcpMiddlewares,
  ...mcpOAuthMiddlewares,
  ...kapsoWebhookMiddlewares,
  ...adminSeoGeoMiddlewares,
  ...adminRecommendationsMiddlewares,
  ...storeRecommendationsMiddlewares,
  ...adminSitesMiddlewares,
  ...adminPriceListsMiddlewares,
  ...adminBundlesMiddlewares,
  ...storeBundlesMiddlewares,
];
