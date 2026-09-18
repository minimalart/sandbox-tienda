"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * In-memory + sessionStorage state of the bundle wizard.
 *
 * PRD §47: no server-side persistence in V1. sessionStorage keyed by
 * `bundle_id + cart_id` survives accidental navigation but resets across
 * sessions.
 */

export type BundleSelection = {
  bundle_item_id: string;
  variant_id: string | null;
};

type WizardState = {
  selections: Record<string, string | null>; // bundle_item_id → variant_id
  currentStep: number;
};

const storageKey = (bundleId: string, cartId: string | null) =>
  `bundle-wizard:${bundleId}:${cartId ?? "anonymous"}`;

const readState = (bundleId: string, cartId: string | null): WizardState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(bundleId, cartId));
    return raw ? (JSON.parse(raw) as WizardState) : null;
  } catch {
    return null;
  }
};

const writeState = (
  bundleId: string,
  cartId: string | null,
  state: WizardState,
): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(bundleId, cartId), JSON.stringify(state));
  } catch {
    /* quota exceeded — fine, wizard is still usable in-memory */
  }
};

interface UseBundleWizardArgs {
  bundleId: string;
  cartId: string | null;
  autoResolvedItems: Array<{ bundle_item_id: string; variant_id: string }>;
  configurableItemIds: string[];
  /**
   * Selecciones pre-existentes cuando el wizard está en modo EDIT. Prevalecen
   * sobre `autoResolvedItems` (para respetar la variante que el operador ya
   * había elegido en la instancia que está editando). El estado guardado en
   * sessionStorage pierde prioridad frente a estas — arrancar a editar
   * SIEMPRE hidrata desde el line item actual del carrito, no desde un
   * borrador de wizard que hubiese quedado colgado.
   */
  initialSelections?: Record<string, string>;
}

export const useBundleWizard = ({
  bundleId,
  cartId,
  autoResolvedItems,
  configurableItemIds,
  initialSelections,
}: UseBundleWizardArgs) => {
  const initial = useMemo<WizardState>(() => {
    // MODO EDIT: initialSelections gana. Ver el JSDoc.
    if (initialSelections && Object.keys(initialSelections).length) {
      const selections: Record<string, string | null> = {};
      for (const auto of autoResolvedItems) selections[auto.bundle_item_id] = auto.variant_id;
      for (const id of configurableItemIds) selections[id] = null;
      for (const [itemId, variantId] of Object.entries(initialSelections)) {
        selections[itemId] = variantId;
      }
      return { selections, currentStep: 0 };
    }
    const saved = readState(bundleId, cartId);
    if (saved) return saved;
    const selections: Record<string, string | null> = {};
    for (const auto of autoResolvedItems) selections[auto.bundle_item_id] = auto.variant_id;
    for (const id of configurableItemIds) selections[id] = null;
    return { selections, currentStep: 0 };
  }, [bundleId, cartId, autoResolvedItems, configurableItemIds, initialSelections]);

  const [state, setState] = useState<WizardState>(initial);

  useEffect(() => {
    writeState(bundleId, cartId, state);
  }, [state, bundleId, cartId]);

  const selectVariant = useCallback((bundleItemId: string, variantId: string) => {
    setState((prev) => ({
      ...prev,
      selections: { ...prev.selections, [bundleItemId]: variantId },
    }));
  }, []);

  const goToStep = useCallback((idx: number) => {
    setState((prev) => ({ ...prev, currentStep: idx }));
  }, []);

  const allSelected = configurableItemIds.every((id) => state.selections[id]);

  return {
    selections: state.selections,
    currentStep: state.currentStep,
    selectVariant,
    goToStep,
    allSelected,
  };
};
