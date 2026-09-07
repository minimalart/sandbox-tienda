export type NotifyAbandonedCartInput = {
    abandonedCartId: string;
    /** Fuerza un paso puntual (reenvío manual desde el admin). */
    forceStep?: number;
};
export declare const notifyAbandonedCartWorkflow: import("@medusajs/framework/workflows-sdk").ReturnWorkflow<NotifyAbandonedCartInput, {
    sent: number;
    skipped: boolean;
    reason: string | null;
    step: number | null;
}, []>;
