/**
 * Valida un CUIT argentino: 11 dígitos + dígito verificador (módulo 11).
 * Acepta con o sin guiones. Misma lógica que el backend.
 */
export function validateCuit(cuit: string | null | undefined): boolean {
  if (!cuit) return false;
  const clean = String(cuit).replace(/\D/g, "");
  if (clean.length !== 11) return false;
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(clean[i]) * (mult[i] as number);
  }
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(clean[10]);
}
