import type { MedusaContainer } from '@medusajs/framework/types';
/**
 * Barrido periódico de carritos abandonados. Tres fases:
 *  1) DETECTAR: carritos `completed_at IS NULL` con items cuya última actividad
 *     cae DENTRO de la ventana (inactivos ≥ primer paso, no más viejos que
 *     `maxAgeHours`), y hace upsert del tracking. Se trackea tengan contacto o no:
 *     el contacto decide si se puede notificar, no si se mide.
 *  2) RECONCILIAR: cierra como `recovered` el tracking cuyo carrito ya se completó
 *     (red de seguridad para las órdenes cuyo evento se perdió).
 *  3) NOTIFICAR: dispara el workflow para cada tracking vencido (`next_eligible_at`).
 * Fire-and-forget: nunca propaga; cada error se loguea y sigue.
 */
export default function scanAbandonedCartsJob(container: MedusaContainer): Promise<void>;
export declare const config: {
    name: string;
    schedule: string;
};
