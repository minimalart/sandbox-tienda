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
  options?: { replace?: boolean },
): void {
  if (typeof window === "undefined") return;
  const url = `${window.location.pathname}?step=${step}`;
  if (options?.replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
}
