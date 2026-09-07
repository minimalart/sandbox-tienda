import { MedusaService } from '@medusajs/framework/utils';
import { DynamicGroup, DynamicGroupMembershipLog } from './models';

class DynamicGroupsModuleService extends MedusaService({
  DynamicGroup,
  DynamicGroupMembershipLog,
}) {
  /** Registra una entrada/salida de un cliente en el historial. */
  async logMembership(
    entries: Array<{
      dynamic_group_id: string;
      customer_id: string;
      action: 'added' | 'removed';
      reason?: Record<string, unknown> | null;
    }>,
  ): Promise<void> {
    if (!entries.length) return;
    await this.createDynamicGroupMembershipLogs(entries);
  }
}

export default DynamicGroupsModuleService;
