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
export function validateCuit(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const clean = String(cuit).replace(/\D/g, '');
  if (clean.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(clean[i]) * mult[i]!;
  }
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false; // CUIT inválido por convención
  return check === Number(clean[10]);
}
