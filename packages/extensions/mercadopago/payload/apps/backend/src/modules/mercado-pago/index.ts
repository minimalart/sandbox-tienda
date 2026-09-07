import { ModuleProvider, Modules } from '@medusajs/framework/utils';
import syncMercadoPagoRegions from './loaders/sync-regions';
import MercadoPagoProviderService from './service';

export { MERCADO_PAGO_PROVIDER_ID } from './constants';

export default ModuleProvider(Modules.PAYMENT, {
  services: [MercadoPagoProviderService],
  // Boot-time: auto-link MercadoPago to every region (the provider is only
  // registered when MERCADOPAGO_ENABLED=true, so this only runs when enabled).
  loaders: [syncMercadoPagoRegions],
});
