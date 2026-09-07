"use client";

import { type ArcaTaxpayer, lookupArcaTaxpayer } from "@lib/data/arca-client";
import { validateCuit } from "@lib/util/cuit";
import { useState } from "react";

export type ArcaLookupStatus =
  | "idle"
  | "loading"
  | "verified"
  | "incompatible"
  | "error";

type Options = {
  /** Condiciones IVA aceptadas; las demás marcan "incompatible" (no bloquea). */
  compatibleConditions?: ReadonlyArray<ArcaTaxpayer["tax_condition"]>;
  incompatibleMessage?: string;
};

/**
 * Estado compartido del botón "Buscar en ARCA": ejecuta el lookup y expone el
 * estado para la UI (badge/mensajes) y para el patrón "campos bloqueados hasta
 * la primera búsqueda": `attempted` queda true ante cualquier desenlace real
 * (éxito O error) — si ARCA está caído el usuario sigue completando a mano,
 * la búsqueda nunca puede bloquear un formulario.
 */
export function useArcaLookup(options?: Options) {
  const [status, setStatus] = useState<ArcaLookupStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [taxpayer, setTaxpayer] = useState<ArcaTaxpayer | null>(null);
  const [attempted, setAttempted] = useState(false);

  const lookup = async (cuit: string): Promise<ArcaTaxpayer | null> => {
    if (!validateCuit(cuit)) {
      setStatus("error");
      setMessage("Ingresá un CUIT válido para buscar en ARCA.");
      return null;
    }
    setStatus("loading");
    setMessage(null);
    const result = await lookupArcaTaxpayer(cuit);
    setAttempted(true);
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return null;
    }
    setTaxpayer(result.data);
    const compatible =
      !options?.compatibleConditions ||
      options.compatibleConditions.includes(result.data.tax_condition);
    if (compatible) {
      setStatus("verified");
    } else {
      setStatus("incompatible");
      setMessage(
        options?.incompatibleMessage ??
          "Este CUIT no registra una condición compatible. Verificá los datos o continuá a mano.",
      );
    }
    return result.data;
  };

  /** Vuelve a idle (p.ej. al editar un campo verificado). No re-bloquea campos. */
  const reset = () => {
    setStatus("idle");
    setMessage(null);
  };

  return { status, message, taxpayer, attempted, lookup, reset };
}
