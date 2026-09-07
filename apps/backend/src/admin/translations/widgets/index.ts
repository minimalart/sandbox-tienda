import type { i18n as I18nInstance } from 'i18next';

const WIDGETS_NAMESPACE = 'widgets';
let registered = false;

export const en = {
  // product-brand-widget
  BRAND_HEADING: 'Brand',
  BRAND_LOADING: 'Loading...',
  BRAND_SELECT_PLACEHOLDER: 'Select a brand',
  BRAND_NONE: 'No brand',
  BRAND_ASSIGN_SUCCESS: 'Brand assigned successfully',
  BRAND_ASSIGN_FAILED: 'Failed to assign brand: {{message}}',
  BRAND_REMOVE_SUCCESS: 'Brand removed successfully',
  BRAND_REMOVE_FAILED: 'Failed to remove brand: {{message}}',
  // order-andreani-widget
  ANDREANI_HEADING: 'Andreani',
  ANDREANI_LOADING: 'Loading shipments…',
  ANDREANI_NO_TRACKING: 'No tracking',
  ANDREANI_CONTRACT_PREFIX: 'Contract:',
  ANDREANI_VIEW_TRACKING: 'View tracking',
  ANDREANI_DOWNLOAD_LABEL: 'Download label',
  ANDREANI_GENERATE_LABEL: 'Generate label',
  ANDREANI_GENERATE_OK: 'Label generated — tracking {{tracking}}',
  ANDREANI_GENERATE_ERR: 'Could not generate label: {{message}}',
  ANDREANI_LABEL_ERR: 'Could not open label: {{message}}',
  ANDREANI_TICKET_BADGE: 'Label #{{n}}',
  // billing-profile widgets
  BILLING_PROFILES_HEADING: 'Billing profiles',
  BILLING_SNAPSHOT_HEADING: 'Billing details',
  BILLING_LOADING: 'Loading…',
  BILLING_EMPTY: 'No billing profiles.',
  BILLING_LABEL: 'Label',
  BILLING_LEGAL_NAME: 'Legal name',
  BILLING_CUIT: 'CUIT',
  BILLING_TAX_CONDITION: 'Tax condition',
  BILLING_DEFAULT: 'Default',
  BILLING_INVOICE_TYPE: 'Invoice type',
  BILLING_EMAIL: 'Billing email',
  BILLING_PHONE: 'Phone',
  BILLING_ADDRESS: 'Tax address',
  BILLING_CITY: 'City',
  BILLING_PROVINCE: 'Province',
  BILLING_POSTAL_CODE: 'Postal code',
  BILLING_COUNTRY: 'Country',
};

export const es = {
  // product-brand-widget
  BRAND_HEADING: 'Marca',
  BRAND_LOADING: 'Cargando...',
  BRAND_SELECT_PLACEHOLDER: 'Seleccione una marca',
  BRAND_NONE: 'Sin marca',
  BRAND_ASSIGN_SUCCESS: 'Marca asignada correctamente',
  BRAND_ASSIGN_FAILED: 'Error al asignar la marca: {{message}}',
  BRAND_REMOVE_SUCCESS: 'Marca eliminada correctamente',
  BRAND_REMOVE_FAILED: 'Error al eliminar la marca: {{message}}',
  // order-andreani-widget
  ANDREANI_HEADING: 'Andreani',
  ANDREANI_LOADING: 'Cargando envíos…',
  ANDREANI_NO_TRACKING: 'Sin tracking',
  ANDREANI_CONTRACT_PREFIX: 'Contrato:',
  ANDREANI_VIEW_TRACKING: 'Ver seguimiento',
  ANDREANI_DOWNLOAD_LABEL: 'Descargar etiqueta',
  ANDREANI_GENERATE_LABEL: 'Generar etiqueta',
  ANDREANI_GENERATE_OK: 'Etiqueta generada — tracking {{tracking}}',
  ANDREANI_GENERATE_ERR: 'No se pudo generar la etiqueta: {{message}}',
  ANDREANI_LABEL_ERR: 'No se pudo abrir la etiqueta: {{message}}',
  ANDREANI_TICKET_BADGE: 'Etiqueta #{{n}}',
  // billing-profile widgets
  BILLING_PROFILES_HEADING: 'Perfiles de facturación',
  BILLING_SNAPSHOT_HEADING: 'Datos de facturación',
  BILLING_LOADING: 'Cargando…',
  BILLING_EMPTY: 'Sin perfiles de facturación.',
  BILLING_LABEL: 'Etiqueta',
  BILLING_LEGAL_NAME: 'Razón social',
  BILLING_CUIT: 'CUIT',
  BILLING_TAX_CONDITION: 'Condición fiscal',
  BILLING_DEFAULT: 'Default',
  BILLING_INVOICE_TYPE: 'Tipo de factura',
  BILLING_EMAIL: 'Email de facturación',
  BILLING_PHONE: 'Teléfono',
  BILLING_ADDRESS: 'Domicilio fiscal',
  BILLING_CITY: 'Localidad',
  BILLING_PROVINCE: 'Provincia',
  BILLING_POSTAL_CODE: 'Código postal',
  BILLING_COUNTRY: 'País',
};

/**
 * Registers the Widgets translation bundles on the i18n instance that
 * Medusa's admin actually initialized.
 *
 * IMPORTANT: pass the `i18n` instance from `useTranslation()` — do NOT call the
 * bare `i18next` singleton. With pnpm, the admin bundle can resolve a second,
 * uninitialized copy of i18next whose `addResourceBundle` is unavailable
 * ("addResourceBundle is not a function"). The hook's instance is always the
 * live, initialized one.
 */
export const registerWidgetsTranslations = (i18n: I18nInstance) => {
  if (registered || typeof i18n?.addResourceBundle !== 'function') {
    return;
  }

  i18n.addResourceBundle('en', WIDGETS_NAMESPACE, en, true, true);
  i18n.addResourceBundle('es', WIDGETS_NAMESPACE, es, true, true);

  // Mark the namespace as loaded so react-i18next re-renders components
  // that read it before registration (otherwise raw keys stick).
  void i18n.loadNamespaces(WIDGETS_NAMESPACE);

  registered = true;
};
