import type { HttpTypes } from "@medusajs/types";

/**
 * Valida si una dirección tiene los campos mínimos requeridos
 */
export function isAddressComplete(
  address: HttpTypes.StoreCartAddress | null | undefined
): boolean {
  if (!address) return false;

  // Campos requeridos para una dirección válida
  const requiredFields = [
    address.first_name,
    address.last_name,
    address.address_1,
    address.city,
    address.postal_code,
    address.country_code,
  ];

  // Verificar que todos los campos requeridos tengan valor
  return requiredFields.every(
    (field) => field && typeof field === "string" && field.trim().length > 0
  );
}

export default isAddressComplete;
