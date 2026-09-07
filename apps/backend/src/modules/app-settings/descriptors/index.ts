import type { SettingDescriptor, SettingsNamespace } from './types';
import abandonedCart from './abandoned-cart';
import aiAssistant from './ai-assistant';
import andreani from './andreani';
import b2b from './b2b';
import catalogador from './catalogador';
import checkoutLinks from './checkout-links';
import corporate from './corporate';
import correoArgentino from './correo-argentino';
import delivery from './delivery';
import emailTemplates from './email-templates';
import erp from './erp';
import fiscalDocumentation from './fiscal-documentation';
import ga4 from './ga4';
import giftCards from './gift-cards';
import landingPages from './landing-pages';
import loyaltyEngine from './loyalty-engine';
import mercadopago from './mercadopago';
import multistore from './multistore';
import newsletter from './newsletter';
import paymentBenefits from './payment-benefits';
import recommendationEngine from './recommendation-engine';
import recurringOrders from './recurring-orders';
import seoGeo from './seo-geo';
import storeConfig from './store-config';
import storeImporter from './store-importer';
import typesense from './typesense';
import videos from './videos';
import whatsapp from './whatsapp';

/**
 * Índice de descriptores.
 *
 * Sigue la convención de agregador de `src/api/extension-middlewares.ts`: un
 * import explícito por extensión, en orden alfabético. El composer lo regenera
 * a partir de las extensiones seleccionadas, así que un proyecto generado que no
 * incluya Typesense tampoco va a tener esta línea.
 *
 * Lo importa TANTO el backend COMO el bundle del admin. Todo lo que cuelgue de
 * acá tiene que ser data pura — ver la nota en `types.ts`.
 */
export const settingsNamespaces: SettingsNamespace[] = [
  abandonedCart,
  aiAssistant,
  andreani,
  b2b,
  catalogador,
  checkoutLinks,
  corporate,
  correoArgentino,
  delivery,
  emailTemplates,
  erp,
  fiscalDocumentation,
  ga4,
  giftCards,
  landingPages,
  loyaltyEngine,
  mercadopago,
  multistore,
  newsletter,
  paymentBenefits,
  recommendationEngine,
  recurringOrders,
  seoGeo,
  storeConfig,
  storeImporter,
  typesense,
  videos,
  whatsapp,
];

export const allDescriptors: SettingDescriptor[] = settingsNamespaces.flatMap((n) => n.settings);

export const findNamespace = (namespace: string): SettingsNamespace | null =>
  settingsNamespaces.find((n) => n.namespace === namespace) ?? null;

export const findDescriptor = (namespace: string, key: string): SettingDescriptor | null =>
  findNamespace(namespace)?.settings.find((s) => s.key === key) ?? null;

export type {
  EnvOnlyEntry,
  SettingDescriptor,
  SettingTier,
  SettingType,
  SettingsNamespace,
} from './types';
