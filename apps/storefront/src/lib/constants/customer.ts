/**
 * Constantes para el módulo de customers multi-tenant
 */

// Error code para cuando un customer intenta login en un tenant diferente al que se registró
export const TENANT_MISMATCH_ERROR = "Cuenta registrada en otra tienda";

// Error code para cuando un customer intenta registrarse con un email que ya existe en otro tenant
export const EMAIL_EXISTS_IN_OTHER_TENANT = "EMAIL_EXISTS_IN_OTHER_TENANT";