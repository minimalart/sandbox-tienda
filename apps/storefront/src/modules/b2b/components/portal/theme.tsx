"use client";

import { createContext, useContext, useEffect, useState } from "react";

type ThemeCtx = { dark: boolean; toggle: () => void };
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export const usePortalTheme = () => useContext(Ctx);

/**
 * Tema del portal B2B (light/dark) scopeado: aplica la clase `dark` solo sobre el
 * subárbol del portal (no afecta el B2C). Persiste en localStorage.
 */
export function PortalThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(localStorage.getItem("b2b-theme") === "dark");
  }, []);

  const toggle = () =>
    setDark((d) => {
      const next = !d;
      try {
        localStorage.setItem("b2b-theme", next ? "dark" : "light");
      } catch {
        /* noop */
      }
      return next;
    });

  return (
    <Ctx.Provider value={{ dark, toggle }}>
      <div className={dark ? "dark" : undefined}>{children}</div>
    </Ctx.Provider>
  );
}
