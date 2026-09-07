/**
 * Validador de CUIT — vendorizado del host (`apps/backend/src/modules/billing-profile/types.ts`).
 *
 * `billing-profile` es un módulo AJENO al plugin (vive en el host) y el plugin
 * sólo necesita una función pura de validación (sin acceso al container ni a la
 * DB), así que se vendoriza acá para evitar acoplar el bundle del plugin al
 * árbol del host.
 *
 * Si el algoritmo cambia en el host, actualizar los dos lados —o promover esta
 * función a un paquete compartido tipo `@minimalart/mercatto-shared`.
 */
export declare function validateCuit(cuit: string | null | undefined): boolean;
