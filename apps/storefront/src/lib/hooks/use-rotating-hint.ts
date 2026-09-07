"use client";

import { useEffect, useState } from "react";

export const SEARCH_HINTS = [
  "Buscar productos...",
  "Indumentaria...",
  "Calzado...",
  "Accesorios...",
  "Novedades...",
  "Ofertas...",
];

export function useRotatingHint(texts: string[], intervalMs = 2500) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % texts.length),
      intervalMs,
    );
    return () => clearInterval(timer);
  }, [texts.length, intervalMs]);
  return texts[index];
}
