/** Marca del portal B2B: logo de Mercatto + atribución Minimalart (igual que el B2C). */

export function MercattoLogo({ className }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/useAltText: alt provisto
    <img
      src="/logos-mercatto/logocompleto-verde.svg"
      alt="Mercatto"
      className={className ?? "h-9 w-auto"}
    />
  );
}

/** Isotipo (solo el ícono, sin la palabra) — para el sidebar colapsado. */
export function MercattoIcon({ className }: { className?: string }) {
  return (
    // biome-ignore lint/a11y/useAltText: alt provisto
    <img
      src="/logos-mercatto/logo-verde.svg"
      alt="Mercatto"
      className={className ?? "h-7 w-auto"}
    />
  );
}

export function MinimalartAttribution({ className }: { className?: string }) {
  return (
    <a
      href="https://minimalart.co/?utm_source=website&utm_medium=ecommerce&utm_campaign=b2b"
      rel="noreferrer"
      target="_blank"
      className={`flex items-center justify-center gap-2 transition-opacity hover:opacity-80 ${className ?? ""}`}
    >
      {/* biome-ignore lint/a11y/useAltText: alt provisto */}
      {/* El SVG es slate oscuro (#1E293B): en modo oscuro lo volvemos blanco para
          contraste (brightness-0 → negro, invert → blanco). */}
      <img src="/minimalart/logo-minimalart.svg" alt="Minimalart" className="h-3 dark:brightness-0 dark:invert" />
      <span className="text-xs text-muted-foreground">| Evolution by design</span>
    </a>
  );
}
