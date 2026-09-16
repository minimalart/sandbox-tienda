import type { i18n as I18nInstance } from 'i18next';

/**
 * i18n keys for the Price List → Sales Channels widget.
 *
 * Pattern identical to other translation modules in this directory.
 * Register once per runtime using `registerPricingTranslations(i18n)`.
 *
 * Related ticket: EDUCABOT-9
 */

const PRICING_NAMESPACE = 'pricing';
let registered = false;

export const en = {
  PLR_SALES_CHANNELS_TITLE: 'Sales Channels',
  PLR_SALES_CHANNELS_HELP:
    'Assign one or more sales channels. Prices in this list will apply when customers access the store through any of the selected channels.',
  PLR_SALES_CHANNELS_SAVE: 'Save',
  PLR_SALES_CHANNELS_SAVED: 'Sales channel rule saved',
  PLR_SALES_CHANNELS_SAVE_ERROR: 'Could not save sales channel rule: {{message}}',
  PLR_SALES_CHANNELS_EMPTY: 'No channels selected. The rule will be removed.',
  PLR_SALES_CHANNELS_REMOVE: 'Remove rule',
  PLR_SALES_CHANNELS_REMOVED: 'Sales channel rule removed',
  PLR_SALES_CHANNELS_REMOVE_ERROR: 'Could not remove rule: {{message}}',
  PLR_SALES_CHANNELS_LOADING: 'Loading…',
  PLR_SALES_CHANNELS_NO_CHANNELS: 'No sales channels available.',
};

export const es = {
  PLR_SALES_CHANNELS_TITLE: 'Canales de venta',
  PLR_SALES_CHANNELS_HELP:
    'Asigná uno o más canales de venta. Los precios de esta lista se aplican cuando los compradores acceden al comercio a través de los canales seleccionados.',
  PLR_SALES_CHANNELS_SAVE: 'Guardar',
  PLR_SALES_CHANNELS_SAVED: 'Regla de canal guardada',
  PLR_SALES_CHANNELS_SAVE_ERROR: 'No se pudo guardar la regla de canal: {{message}}',
  PLR_SALES_CHANNELS_EMPTY: 'Sin canales seleccionados. La regla será eliminada.',
  PLR_SALES_CHANNELS_REMOVE: 'Eliminar regla',
  PLR_SALES_CHANNELS_REMOVED: 'Regla de canal eliminada',
  PLR_SALES_CHANNELS_REMOVE_ERROR: 'No se pudo eliminar la regla: {{message}}',
  PLR_SALES_CHANNELS_LOADING: 'Cargando…',
  PLR_SALES_CHANNELS_NO_CHANNELS: 'No hay canales de venta disponibles.',
};

/**
 * Registers the Pricing translation bundles on the live i18n instance.
 *
 * Pass the `i18n` instance from `useTranslation()` — do NOT use the bare
 * `i18next` singleton (same caveat as other translation modules here).
 */
export const registerPricingTranslations = (i18n: I18nInstance): void => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', PRICING_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', PRICING_NAMESPACE, es, true, true);

  void i18n.loadNamespaces(PRICING_NAMESPACE);

  registered = true;
};
