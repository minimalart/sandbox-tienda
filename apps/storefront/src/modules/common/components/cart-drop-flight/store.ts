"use client";

import { useSyncExternalStore } from "react";

/** Duración de la coreografía de alta; coincide con los keyframes `atc-*`. */
export const CART_DROP_MS = 1100;
/** Entrada del stepper que releva al botón; coincide con `atc-stepper-in`. */
export const STEPPER_IN_MS = 320;

/** Duración de la coreografía de baja; coincide con los keyframes `atc-trash-*`. */
export const CART_TRASH_MS = 1100;

export type CartDropPhase =
  | "idle"
  /** Alta: el ítem cae en el carrito y el botón se retiene. */
  | "dropping"
  /** Alta: el stepper releva al botón y hace su entrada. */
  | "entering"
  /** Baja: el ítem cae al tacho y el stepper se retiene. */
  | "trashing"
  /** Baja: el botón "Agregar al carrito" vuelve y hace su entrada. */
  | "returning";

/**
 * Fase de la animación por variante, FUERA de React.
 *
 * Vive acá y no en el estado del componente porque el quick view remonta su
 * subárbol al cambiar el carrito: con `useState` la fase se reseteaba a mitad
 * de la animación, el stepper entraba a los ~500 ms y la coreografía se cortaba.
 * Un store externo sobrevive ese remontaje y el botón retoma donde estaba.
 */
const phases = new Map<string, CartDropPhase>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

/**
 * Última variante que arrancó una coreografía.
 *
 * Mientras se saca la línea del carrito, el componente pierde por un momento
 * su `selectedVariant` y quedaba consultando el store con `undefined`: la fase
 * volvía a "idle" y la animación se cortaba a los ~300 ms. Cuando no hay id a
 * mano, caemos en esta.
 */
let lastStartedId: string | null = null;

function emit() {
  // `forEach` y no `for...of`: el target de tsconfig es ES5 y iterar un Set
  // exigiría `downlevelIteration`.
  listeners.forEach((listener) => listener());
}

function schedule(variantId: string, ms: number, next: () => void) {
  const previous = timers.get(variantId);
  if (previous) {
    clearTimeout(previous);
  }
  timers.set(variantId, setTimeout(next, ms));
}

/**
 * Arranca la coreografía para una variante. Devuelve `false` si ya está
 * corriendo — así el doble click no la reinicia ni agrega dos veces.
 */
export function startCartDrop(variantId: string): boolean {
  if (phases.get(variantId) === "dropping") {
    return false;
  }
  lastStartedId = variantId;
  phases.set(variantId, "dropping");
  emit();

  schedule(variantId, CART_DROP_MS, () => {
    phases.set(variantId, "entering");
    emit();
    schedule(variantId, STEPPER_IN_MS, () => {
      phases.delete(variantId);
      timers.delete(variantId);
      emit();
    });
  });

  return true;
}

/**
 * Arranca la coreografía inversa: el ítem al tacho y vuelta del botón.
 *
 * Sólo tiene sentido con el tacho a la vista (cantidad 1); con cantidad > 1 el
 * control es un "−" y la línea no desaparece, así que no hay nada que tirar.
 */
export function startCartTrash(variantId: string): boolean {
  if (phases.get(variantId) === "trashing") {
    return false;
  }
  lastStartedId = variantId;
  phases.set(variantId, "trashing");
  emit();

  schedule(variantId, CART_TRASH_MS, () => {
    phases.set(variantId, "returning");
    emit();
    schedule(variantId, STEPPER_IN_MS, () => {
      phases.delete(variantId);
      timers.delete(variantId);
      emit();
    });
  });

  return true;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useCartDropPhase(
  variantId?: string | null,
): CartDropPhase {
  return useSyncExternalStore(
    subscribe,
    () => {
      const id = variantId ?? lastStartedId;
      return id ? (phases.get(id) ?? "idle") : "idle";
    },
    () => "idle",
  );
}
