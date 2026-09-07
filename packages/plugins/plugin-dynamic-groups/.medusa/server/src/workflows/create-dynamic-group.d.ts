import type { Condition } from '../modules/dynamic-groups/types';
export type CreateDynamicGroupInput = {
    name: string;
    handle?: string;
    description?: string | null;
    match?: 'all' | 'any';
    conditions: Condition[];
    update_mode?: 'realtime' | 'manual';
    is_active?: boolean;
    metadata?: Record<string, unknown> | null;
    /**
     * La tienda dueña del grupo. Tiene que estar en el tipo Y enumerarse en el step:
     * el paso arma el objeto campo por campo, así que un `site_id` que sólo viaje en
     * el input se descarta EN SILENCIO — el grupo nace global y el listado filtrado
     * ya no lo encuentra donde se creó.
     */
    site_id?: string | null;
};
export declare const createDynamicGroupWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<CreateDynamicGroupInput, any, []>;
