import type { SyncResult } from '../types';
import type { PaymentBenefitProvider, ProviderContext } from './types';

/**
 * Proveedor "manual": los beneficios se crean/editan a mano desde el backoffice.
 * No hay nada que sincronizar (no-op), pero implementa la interfaz para que el
 * dashboard y la resolución por código traten a todos los proveedores igual.
 */
export const manualAdapter: PaymentBenefitProvider = {
  code: 'manual',
  supportsSync: false,

  async validate() {
    return { ok: true };
  },

  async sync(ctx: ProviderContext): Promise<SyncResult> {
    const result: SyncResult = {
      provider_code: 'manual',
      status: 'ok',
      items_synced: 0,
      message: 'Los beneficios manuales no se sincronizan.',
    };
    await ctx.service.logSync({ ...result, started_at: new Date() });
    return result;
  },
};
