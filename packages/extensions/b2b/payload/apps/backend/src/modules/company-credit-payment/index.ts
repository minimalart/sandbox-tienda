import { ModuleProvider, Modules } from '@medusajs/framework/utils';
import CuentaCorrienteProviderService from './service';

export { CUENTA_CORRIENTE_PROVIDER_ID } from './constants';

// El provider se registra siempre que exista el módulo (como Stripe): el alta/baja
// por región la controla el admin desde la UI de Regiones. NO se auto-linkea en el
// boot para no pisar lo que configure el admin (por eso no hay `loaders` acá).
export default ModuleProvider(Modules.PAYMENT, {
  services: [CuentaCorrienteProviderService],
});
