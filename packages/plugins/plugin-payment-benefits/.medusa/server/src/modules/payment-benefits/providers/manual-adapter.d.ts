import type { PaymentBenefitProvider } from './types';
/**
 * Proveedor "manual": los beneficios se crean/editan a mano desde el backoffice.
 * No hay nada que sincronizar (no-op), pero implementa la interfaz para que el
 * dashboard y la resolución por código traten a todos los proveedores igual.
 */
export declare const manualAdapter: PaymentBenefitProvider;
