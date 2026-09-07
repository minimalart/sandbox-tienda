import type { MedusaContainer } from '@medusajs/framework/types';
/**
 * Barrido periódico de grupos dinámicos. Necesario para reglas TEMPORALES que
 * no disparan por evento: inactividad ("días sin comprar"), "cumpleaños del
 * mes", antigüedad. También reconcilia cualquier deriva. El tiempo real
 * (subscribers) cubre las transiciones por compra/alta; este cron cubre el resto.
 *
 * Schedule configurable con DYNAMIC_GROUPS_RECALC_CRON (default: 3am diario).
 */
export default function recalculateDynamicGroupsJob(container: MedusaContainer): Promise<void>;
export declare const config: {
    name: string;
    schedule: string;
};
