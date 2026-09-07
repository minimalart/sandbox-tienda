// Feedback háptico sutil para acciones clave en dispositivos móviles.
//
// Usa la Web Vibration API (navigator.vibrate): funciona en Android/Chrome y
// navegadores que la soporten. En iOS Safari la API no existe, así que es un
// no-op silencioso (no rompe nada). Solo vibra en dispositivos táctiles y
// respeta `prefers-reduced-motion`, para que la confirmación sea sutil y no
// invasiva.

export type HapticIntensity = "light" | "medium" | "success";

// Patrones en milisegundos. Cortos a propósito (confirmación, no alerta).
const PATTERNS: Record<HapticIntensity, number | number[]> = {
  light: 8, // confirmación mínima: agregar al carrito, favoritos, cambiar de página
  medium: 14, // acción algo más relevante: aplicar promoción / gift card
  success: [10, 30, 10], // doble toque corto para cerrar la compra
};

/**
 * ¿El dispositivo puede (y debería) vibrar ahora? Táctil + soporte de la API +
 * sin `prefers-reduced-motion`.
 */
function canVibrate(): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.vibrate !== "function"
  ) {
    return false;
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    // Solo dispositivos táctiles (evita vibraciones fantasma en desktop).
    if (!window.matchMedia("(pointer: coarse)").matches) return false;
    // Accesibilidad: si el usuario pidió menos movimiento, no vibramos.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
  }
  return true;
}

/**
 * Dispara una vibración corta y sutil de confirmación. Seguro de llamar en
 * cualquier contexto (SSR, desktop, iOS): si no se puede vibrar, no hace nada.
 */
export function triggerHaptic(intensity: HapticIntensity = "light"): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(PATTERNS[intensity]);
  } catch {
    // Algunos navegadores lanzan si la página aún no tuvo interacción del usuario.
  }
}
