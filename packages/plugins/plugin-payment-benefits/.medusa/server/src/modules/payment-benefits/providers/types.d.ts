import type PaymentBenefitsModuleService from '../service';
import type { PaymentProviderCode, SyncResult } from '../types';
/** Contexto que recibe un adapter para operar. */
export type ProviderContext = {
    service: PaymentBenefitsModuleService;
    /** Token/credencial del proveedor (p.ej. MERCADOPAGO_ACCESS_TOKEN). */
    accessToken?: string;
    logger?: {
        info: (m: string) => void;
        warn: (m: string) => void;
        error: (m: string) => void;
    };
};
/**
 * Interfaz de un proveedor de beneficios de pago (PRD §9). Cada integración
 * (Mercado Pago, MODO, …) implementa un adapter independiente. Agregar un
 * proveedor nuevo NO cambia el modelo de datos ni la UI (PRD §16).
 */
export interface PaymentBenefitProvider {
    readonly code: PaymentProviderCode;
    /** ¿El proveedor soporta sincronización automática? */
    readonly supportsSync: boolean;
    /** Sincroniza medios/cuotas/beneficios y devuelve el resumen de la corrida. */
    sync(ctx: ProviderContext): Promise<SyncResult>;
    /** Valida credenciales/conectividad (best-effort). */
    validate(ctx: ProviderContext): Promise<{
        ok: boolean;
        message?: string;
    }>;
}
