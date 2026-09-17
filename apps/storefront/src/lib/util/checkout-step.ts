/**
 * Cambia el paso del checkout actualizando solo el query param `?step=` con la
 * History API nativa, sin disparar una navegación RSC al servidor.
 *
 * POR QUÉ no usar router.push/replace:
 * El checkout vive en el route group (checkout) con su propio layout, y la URL
 * limpia (/checkout) la reescribe el middleware a /ar/checkout. Un router.push()
 * dispara un fetch RSC cuyo payload queda "keyed" a la ruta reescrita y cruza de
 * un route group a otro; Next no puede reconciliar ese árbol contra el del
 * cliente y tira "An unexpected response was received from the server.".
 *
 * El paso es estado de UI puro: lo lee useSearchParams() en un árbol 100%
 * client-side (CheckoutPageClient trae el cart por fetch). No necesita
 * round-trip al servidor. pushState/replaceState actualizan useSearchParams()
 * reactivamente (App Router integra la History API nativa) sin tocar el server.
 */
export function goToCheckoutStep(
  step: string,
  options?: { replace?: boolean; editing?: boolean },
): void {
  if (typeof window === "undefined") return;
  const target = options?.editing ? "edit-" + step.replace(/^edit-/, "") : step;
  const url = `${window.location.pathname}?step=${target}`;
  if (options?.replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
}

/** Only the active step can be editing; explicit URL intent survives remounts. */
export function isCheckoutStepEditing(
  requested: string,
  active: string,
  step: string,
  submitted: ReadonlySet<string> = new Set(),
): boolean {
  return active === step && (requested === "edit-" + step || submitted.has(step));
}

/**
 * Siguiente paso visible después de `current`.
 *
 * El orden de pasos NO es fijo: sale de la policy de la tienda, que puede
 * ocultar bloques enteros (una tienda de retiro en el colegio no muestra
 * `address` ni `delivery`). Por eso ningún formulario puede hardcodear a dónde
 * va el "Continuar" — tiene que preguntarle al `stepOrder` ya filtrado por
 * visibilidad. `fallback` cubre el caso de que `current` no esté en la lista.
 */
export function nextVisibleStep(
  stepOrder: readonly string[],
  current: string,
  fallback?: string,
): string | undefined {
  const idx = stepOrder.indexOf(current.replace(/^edit-/, ""));
  return (idx >= 0 ? stepOrder[idx + 1] : undefined) ?? fallback;
}
