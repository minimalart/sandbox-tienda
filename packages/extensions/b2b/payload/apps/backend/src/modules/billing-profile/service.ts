import { MedusaService, MedusaError } from '@medusajs/framework/utils';
import { BillingProfile } from './models';

class BillingProfileModuleService extends MedusaService({
  BillingProfile,
}) {
  /** Perfiles de un customer (más reciente primero). */
  async listByCustomer(customerId: string) {
    return this.listBillingProfiles(
      { customer_id: customerId },
      { order: { created_at: 'DESC' } },
    );
  }

  /** Perfil default del customer (o null). */
  async getDefault(customerId: string) {
    const rows = await this.listBillingProfiles({
      customer_id: customerId,
      is_default: true,
    });
    return rows[0] ?? null;
  }

  /** Marca un perfil como default y desmarca el resto del customer. */
  async setDefault(customerId: string, profileId: string): Promise<void> {
    const profiles = await this.listBillingProfiles({ customer_id: customerId });
    const updates = profiles
      .filter((p) => p.is_default !== (p.id === profileId))
      .map((p) => ({ id: p.id, is_default: p.id === profileId }));
    if (updates.length) {
      await this.updateBillingProfiles(updates as any);
    }
  }
}

/** Lanza si el perfil no pertenece al customer. */
export function assertOwner(
  profile: { customer_id?: string } | null | undefined,
  customerId: string,
): void {
  if (!profile || profile.customer_id !== customerId) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El perfil de facturación no pertenece a este cliente.',
    );
  }
}

export default BillingProfileModuleService;
