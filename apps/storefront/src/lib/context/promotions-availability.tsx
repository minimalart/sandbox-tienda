"use client";

import type React from "react";
import { createContext, useContext } from "react";

/**
 * ¿Hay al menos una promoción activa para el canal actual?
 *
 * Se siembra desde el layout server-side (una sola consulta cacheada) y lo
 * consumen los accesos a "Promociones" del chrome (nav desktop, menú mobile,
 * bottom nav) para no ofrecer una PLP que va a salir vacía.
 *
 * Default `false` (fail-closed): sin provider no hay forma de saber si hay
 * promociones, y ofrecer una vidriera de ofertas que no existen es peor que no
 * ofrecerla (DESDEELSUR-30). Hoy el único consumidor del árbol es el layout de
 * `(main)`, que siempre siembra el provider, así que el default es red de
 * seguridad — no el camino normal.
 */
const PromotionsAvailabilityContext = createContext<boolean>(false);

export const PromotionsAvailabilityProvider = ({
  children,
  hasActivePromotions,
}: {
  children: React.ReactNode;
  hasActivePromotions: boolean;
}) => (
  <PromotionsAvailabilityContext.Provider value={hasActivePromotions}>
    {children}
  </PromotionsAvailabilityContext.Provider>
);

export const useHasActivePromotions = (): boolean =>
  useContext(PromotionsAvailabilityContext);
