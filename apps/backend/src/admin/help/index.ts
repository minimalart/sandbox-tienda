import type { ExtensionHelp } from './types';
// abandoned-cart: moved to @minimalart/mercatto-plugin-abandoned-cart
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
// ga4: moved to @minimalart/mercatto-plugin-ga4
import giftCards from './gift-cards';
import landingPages from './landing-pages';
import loyaltyEngine from './loyalty-engine';
import mercadopago from './mercadopago';
import multistore from './multistore';
import paymentBenefits from './payment-benefits';
import recommendationEngine from './recommendation-engine';
import recurringOrders from './recurring-orders';
import seoGeo from './seo-geo';
import storeConfig from './store-config';
import storeImporter from './store-importer';
import typesense from './typesense';
// videos: moved to @minimalart/mercatto-plugin-videos
import whatsapp from './whatsapp';

/**
 * Índice de ayudas.
 *
 * Sigue la convención de agregador de `modules/app-settings/descriptors/index.ts`
 * y `src/api/extension-middlewares.ts`: un import explícito por extensión, en
 * orden alfabético. El composer lo regenera según las extensiones elegidas, así
 * que un proyecto generado sin GA4 tampoco va a tener esa línea.
 *
 * La CLAVE es el slug del DESCRIPTOR (`modules/app-settings/descriptors/<slug>.ts`)
 * y el nombre del markdown generado (`docs/extensions/<slug>.md`). En la mayoría
 * coincide con el directorio de `routes/`, pero NO siempre: `recommendation-engine`
 * vive en `routes/recomendaciones/`, `abandoned-cart` en `routes/abandoned-carts/`,
 * `corporate` en `routes/corporates/`, `loyalty-engine` en `routes/loyalty/`.
 * Por eso `HelpDrawer` recibe el slug EXPLÍCITO y no lo deduce de la ruta: deducirlo
 * funcionaría en 25 de 29 y fallaría en silencio —sin drawer, sin error— justo en
 * las cuatro que no siguen la regla.
 *
 * `mercadopago` es la única sin drawer montado, y no por olvido: **no tiene card
 * en ninguna ruta del admin**. Se creyó que la montaba `payment-benefits/settings`
 * —los únicos `extension:mercadopago` de `src/admin` son comentarios— y montarle
 * un segundo botón ahí habría dejado dos interrogantes idénticos en el mismo
 * header, el segundo sin card al lado que lo explicara. Su ayuda vive como markdown
 * y se alcanza desde el buscador central de ajustes, que es lo que su propia
 * primera sección declara. La pregunta que sí se hace parado en Payment Benefits
 * —dónde se configura el token— la contesta el drawer de esa pantalla.
 *
 * `store-importer` tampoco tiene pantalla de ajustes, pero sí lugar de uso: se
 * opera desde el detalle de tienda (`routes/sites/[id]/`), y ahí está su drawer.
 *
 * Un mapa y no un array porque el consumidor SIEMPRE busca por slug. Un array
 * obligaría a cada llamador a hacer su propio `.find()`, y el día que dos
 * entradas compartan slug ganaría la primera sin que nadie se entere.
 */
export const extensionHelp: Record<string, ExtensionHelp> = {
  // abandoned-cart: moved to @minimalart/mercatto-plugin-abandoned-cart
  'ai-assistant': aiAssistant,
  andreani,
  b2b,
  catalogador,
  'checkout-links': checkoutLinks,
  corporate,
  'correo-argentino': correoArgentino,
  delivery,
  'email-templates': emailTemplates,
  erp,
  'fiscal-documentation': fiscalDocumentation,
  // ga4: moved to @minimalart/mercatto-plugin-ga4
  'gift-cards': giftCards,
  'landing-pages': landingPages,
  'loyalty-engine': loyaltyEngine,
  mercadopago,
  multistore,
  'payment-benefits': paymentBenefits,
  'recommendation-engine': recommendationEngine,
  'recurring-orders': recurringOrders,
  'seo-geo': seoGeo,
  'store-config': storeConfig,
  'store-importer': storeImporter,
  typesense,
  // videos: moved to @minimalart/mercatto-plugin-videos
  whatsapp,
};

/**
 * Devuelve `undefined` —y no lanza— cuando la extensión todavía no migró su
 * texto. El comportamiento correcto es que el botón de ayuda NO se muestre: una
 * extensión sin ayuda es un estado legítimo, no un error.
 */
export const helpFor = (slug: string): ExtensionHelp | undefined => extensionHelp[slug];
