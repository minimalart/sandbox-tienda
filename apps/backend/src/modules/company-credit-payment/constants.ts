/**
 * Provider id completo de Medusa: `pp_cuenta_corriente_cuenta_corriente`
 * (prefijo pp_ + id del módulo + identifier del service). El storefront y el
 * subscriber de `order.placed` keyean off este valor.
 *
 * Vive en su propio archivo (no en index.ts) para que el loader/lib lo importen
 * sin crear dependencia circular con el default export del módulo.
 */
export const CUENTA_CORRIENTE_PROVIDER_ID = 'pp_cuenta_corriente_cuenta_corriente';
