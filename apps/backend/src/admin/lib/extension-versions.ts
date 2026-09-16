/**
 * Registro central de versiones de las extensiones propias del backoffice.
 *
 * IMPORTANTE: subir la versión a mano en cada deploy que modifique la extensión.
 * Seguir semver: patch (fix), minor (feature compatible), major (breaking).
 *
 * Una sola fuente de verdad: este archivo. El badge <ExtensionVersion /> lee de acá.
 */
export const EXTENSION_VERSIONS = {
  marketplaces: '1.2.0',
  // abandoned-cart: moved to @minimalart/mercatto-plugin-abandoned-cart
  'ai-assistant': '1.34.5',
  andreani: '1.4.0',
  b2b: '1.23.4',
  // banners: moved to @minimalart/mercatto-plugin-banners
  // blog: moved to @minimalart/mercatto-plugin-blog
  // brands: moved to @minimalart/mercatto-plugin-brands
  // catalogador: moved to @minimalart/mercatto-plugin-catalogador
  // checkout-links: moved to @minimalart/mercatto-plugin-checkout-links
  // comments: moved to @minimalart/mercatto-plugin-comments
  // commerce-dashboard: moved to @minimalart/mercatto-plugin-commerce-dashboard
  // contact: moved to @minimalart/mercatto-plugin-contact
  corporate: '1.10.1',
  'demo-stores': '1.12.3',
  'correo-argentino': '1.2.0',
  // database-explorer: moved to @minimalart/mercatto-plugin-database-explorer
  delivery: '1.5.0',
  'delivery-routes': '1.1.0',
  // dynamic-groups: moved to @minimalart/mercatto-plugin-dynamic-groups
  erp: '2.29.1',
  'email-templates': '1.10.0',
  // fiscal-documentation: moved to @minimalart/mercatto-plugin-fiscal-documentation
  // ga4: moved to @minimalart/mercatto-plugin-ga4
  // gift-cards: moved to @minimalart/mercatto-plugin-gift-cards
  // landing-pages: moved to @minimalart/mercatto-plugin-landing-pages
  // loyalty: moved to @minimalart/mercatto-plugin-loyalty
  // media-library: moved to @minimalart/mercatto-plugin-media-library
  multistore: '1.14.1',
  newsletter: '1.0.0',
  // payment-benefits: moved to @minimalart/mercatto-plugin-payment-benefits
  // pdf-catalog: moved to @minimalart/mercatto-plugin-pdf-catalog
  'recommendation-engine': '1.1.0',
  'recommendation-widgets': '1.1.0',
  'recurring-orders': '2.0.3',
  'seo-geo': '1.8.1',
  // shop-by-looks: moved to @minimalart/mercatto-plugin-shop-by-looks
  // space-designer: moved to @minimalart/mercatto-plugin-space-designer
  'store-config': '1.16.0',
  'store-locations': '1.12.1',
  typesense: '1.5.1',
  // videos: moved to @minimalart/mercatto-plugin-videos
  whatsapp: '1.18.0',
  // wishlist: moved to @minimalart/mercatto-plugin-wishlist
} as const;

export type ExtensionKey = keyof typeof EXTENSION_VERSIONS;

export function getExtensionVersion(key: ExtensionKey): string {
  return EXTENSION_VERSIONS[key];
}
