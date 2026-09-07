/**
 * Formatea el título de un producto a formato título capitalizado
 * Convierte "FRAGANCIA AMBIENTAL .INVICTO" a "Fragancia ambiental invicto"
 * 
 * @param title - El título del producto a formatear
 * @returns El título formateado en formato título capitalizado
 */
export function formatProductTitle(title?: string | null): string {
  if (!title) {
    return "";
  }

  // Convertir a minúsculas
  let formatted = title.toLowerCase();

  // Remover puntos antes de palabras (ej: ".invicto" -> "invicto")
  formatted = formatted.replace(/\.\s*/g, " ");

  // Remover espacios múltiples
  formatted = formatted.replace(/\s+/g, " ");

  // Trim espacios al inicio y final
  formatted = formatted.trim();

  // Capitalizar la primera letra
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  return formatted;
}

/**
 * Formatea el título de un producto a formato título con cada palabra capitalizada
 * Convierte "FRAGANCIA AMBIENTAL .INVICTO" a "Fragancia Ambiental Invicto"
 * 
 * @param title - El título del producto a formatear
 * @returns El título formateado con cada palabra capitalizada
 */
export function formatProductTitleCapitalized(title?: string | null): string {
  if (!title) {
    return "";
  }

  // Convertir a minúsculas
  let formatted = title.toLowerCase();

  // Remover puntos antes de palabras
  formatted = formatted.replace(/\.\s*/g, " ");

  // Remover espacios múltiples
  formatted = formatted.replace(/\s+/g, " ");

  // Trim espacios
  formatted = formatted.trim();

  // Capitalizar cada palabra
  formatted = formatted
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return formatted;
}
