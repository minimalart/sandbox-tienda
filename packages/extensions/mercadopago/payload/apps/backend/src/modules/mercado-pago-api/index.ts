import { ModuleProvider, Modules } from '@medusajs/framework/utils';
import syncMercadoPagoApiRegions from './loaders/sync-regions';
import MercadoPagoApiProviderService from './service';

export { MERCADO_PAGO_API_PROVIDER_ID } from './constants';

export default ModuleProvider(Modules.PAYMENT, {
  services: [MercadoPagoApiProviderService],
  // Boot-time: auto-link the Checkout API provider to every region (only runs
  // when the provider is registered, i.e. MERCADOPAGO_API_ENABLED=true).
  loaders: [syncMercadoPagoApiRegions],
});
