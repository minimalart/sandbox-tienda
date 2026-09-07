"use client";

import { useTenant } from "@lib/site-config/context";
import { selectTotalItems, useCartStore } from "@lib/stores/cart.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import "../../campaign-theme.css";

type CampaignHeaderProps = {
  /** Cart count resuelto en el server; el store lo hidrata luego. */
  initialCartCount?: number;
  hasSpaceDesigner?: boolean;
};

/**
 * Header del template Campaña (landing institucional).
 *
 * Minimalista: announcement bar arriba (opcional), header sticky con logo +
 * subtítulo institucional, pill "Powered by" (opcional) y botón de carrito.
 * A diferencia del header tecnológico NO tiene search prominente ni menú de
 * categorías — el catálogo es acotado y todo el nav es anchor al `#tienda`.
 */
export default function CampaignHeader({
  initialCartCount = 0,
  hasSpaceDesigner = false,
}: CampaignHeaderProps) {
  const tenant = useTenant();
  const campaign = tenant.assets.campaign;
  const chrome = campaign?.chrome;
  const announcement = campaign?.announcement;
  const logo = tenant.assets.logos?.main;

  const liveCount = useCartStore(selectTotalItems);
  const cartCount = liveCount || initialCartCount;

  return (
    <>
      {announcement?.text ? (
        <div className="w-full bg-[color:var(--campaign-bg-alt,#191b1f)] text-white/80">
          <div className="mx-auto max-w-6xl px-4 py-2 text-center text-xs sm:px-6">
            {announcement.href ? (
              <LocalizedClientLink
                href={announcement.href}
                className="underline-offset-2 hover:underline"
              >
                {announcement.text}
              </LocalizedClientLink>
            ) : (
              <span>{announcement.text}</span>
            )}
          </div>
        </div>
      ) : null}

      <header className="campaign-home sticky top-0 z-40 w-full bg-[color:var(--campaign-bg,#0f1114)] text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <LocalizedClientLink
            href="/"
            className="flex items-center gap-3"
          >
            {logo ? (
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10">
                <Image
                  src={logo}
                  alt={tenant.name}
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                />
              </span>
            ) : null}
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold sm:text-base">
                {tenant.name}
              </span>
              {chrome?.subtitle ? (
                <span className="text-[10px] font-medium tracking-widest text-white/60">
                  {chrome.subtitle}
                </span>
              ) : null}
            </span>
          </LocalizedClientLink>

          <div className="ml-auto flex items-center gap-3">
            {hasSpaceDesigner && (
              <LocalizedClientLink
                href="/espacios"
                className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/40 sm:inline-flex"
              >
                Diseñá tu espacio
              </LocalizedClientLink>
            )}
            {chrome?.poweredByLabel ? (
              chrome.poweredByHref ? (
                <a
                  href={chrome.poweredByHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 transition hover:border-white/40 sm:inline-flex"
                >
                  {chrome.poweredByLabel}
                </a>
              ) : (
                <span className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/80 sm:inline-flex">
                  {chrome.poweredByLabel}
                </span>
              )
            ) : null}
            <LocalizedClientLink
              href="/cart"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
              aria-label={`Mi carrito (${cartCount} items)`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Mi carrito</span>
              {cartCount > 0 ? (
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-[color:var(--campaign-bg,#0f1114)]">
                  {cartCount}
                </span>
              ) : null}
            </LocalizedClientLink>
          </div>
        </div>
        {hasSpaceDesigner && (
          <nav aria-label="Diseñador de espacios" className="border-t border-white/10 px-4 sm:hidden">
            <LocalizedClientLink
              href="/espacios"
              className="block py-3 text-sm font-medium text-white/90 transition hover:text-white"
            >
              Diseñá tu espacio
            </LocalizedClientLink>
          </nav>
        )}
      </header>
    </>
  );
}
