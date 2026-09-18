import type { i18n as I18nInstance } from 'i18next';

const NAMESPACE = 'productSalesMode';
let registered = false;

export const en = {
  TITLE: 'Sales mode',
  HELP: 'Where this product can be sold in each store. It does not change the product itself.',
  SINGLE_TENANT: 'This project has no stores configured, so the product is sold normally.',
  MODE_STANDALONE: 'Individual',
  MODE_BUNDLE_ONLY: 'Bundles only',
  MODE_STANDALONE_AND_BUNDLE: 'Individual and bundles',
  MODE_STANDALONE_HELP: 'Listed and sold on its own. It should not be part of bundles.',
  MODE_BUNDLE_ONLY_HELP: 'Hidden from catalog and search. Only reachable inside a bundle.',
  MODE_STANDALONE_AND_BUNDLE_HELP: 'Sold on its own and can also be part of bundles.',
  SAVED: 'Sales mode saved.',
  ERROR: 'Could not save the sales mode.',
  LOADING: 'Loading stores…',
};

export const es = {
  TITLE: 'Modo de venta',
  HELP: 'Dónde se puede vender este producto en cada tienda. No cambia el producto en sí.',
  SINGLE_TENANT: 'Este proyecto no tiene tiendas configuradas, así que el producto se vende normalmente.',
  MODE_STANDALONE: 'Individual',
  MODE_BUNDLE_ONLY: 'Solo en bundles',
  MODE_STANDALONE_AND_BUNDLE: 'Individual y bundles',
  MODE_STANDALONE_HELP: 'Se lista y se vende solo. No debería formar parte de bundles.',
  MODE_BUNDLE_ONLY_HELP: 'No aparece en catálogo ni en búsqueda. Solo se llega dentro de un bundle.',
  MODE_STANDALONE_AND_BUNDLE_HELP: 'Se vende solo y además puede formar parte de bundles.',
  SAVED: 'Modo de venta guardado.',
  ERROR: 'No se pudo guardar el modo de venta.',
  LOADING: 'Cargando tiendas…',
};

export const registerProductSalesModeTranslations = (i18n: I18nInstance): void => {
  if (registered) return;
  i18n.addResourceBundle('en', NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', NAMESPACE, es, true, true);
  registered = true;
};
