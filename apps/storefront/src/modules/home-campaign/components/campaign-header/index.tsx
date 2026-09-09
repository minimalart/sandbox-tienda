"use client";

import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useTenant } from "@lib/site-config/context";
import { selectTotalItems, useCartStore } from "@lib/stores/cart.store";
import { pickContrastText } from "@lib/util/contrast";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import HomeTopbar from "@modules/home/components/topbar";
import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";
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
 *
 * `chrome.backgroundColor` (opcional) pisa el fondo; sin config el preset
 * default es blanco. El resto de los tokens (subtitle color, borders, badge
 * del cart count) se derivan por contraste automático del fondo — el operador
 * pisa un solo valor y el resto se ajusta.
 */
export default function CampaignHeader({
  initialCartCount = 0,
  hasSpaceDesigner = false,
}: CampaignHeaderProps) {
  const tenant = useTenant();
  const campaign = tenant.assets.campaign;
  const chrome = campaign?.chrome;
  const logo = tenant.assets.logos?.main;

  const liveCount = useCartStore(selectTotalItems);
  const openCart = useCartStore((state) => state.openCart);
  const cartCount = liveCount || initialCartCount;

  // Registrar el botón del carrito como target de la animación "fly-to-cart".
  const { registerCartIcon } = useAddToCartAnimation();
  const cartBtnRef = useCallback(
    (el: HTMLButtonElement | null) => registerCartIcon(el),
    [registerCartIcon],
  );

  const bg = chrome?.backgroundColor?.trim() || undefined;
  const fg = bg ? (pickContrastText(bg) ?? "#0f1114") : "#ffffff";
  const isDarkText = fg !== "#ffffff";
  const headerStyle: React.CSSProperties = bg
    ? { backgroundColor: bg, color: fg }
    : {};
  // Tokens condicionales: sin bg custom preserva el treatment previo
  // (bg--campaign-bg + text-white). Con bg custom todo se deriva del contraste.
  const subtitleClass = isDarkText ? "text-neutral-600" : "text-white/60";
  const nameClass = isDarkText ? "text-neutral-900" : "text-white";
  const borderClass = isDarkText ? "border-neutral-200" : "border-white/20";
  const pillBgClass = isDarkText ? "bg-transparent" : "bg-white/5";
  const pillTextClass = isDarkText ? "text-neutral-700" : "text-white/80";
  const pillHoverClass = isDarkText
    ? "hover:border-neutral-400"
    : "hover:border-white/40 hover:bg-white/10";
  const logoBgClass = isDarkText ? "bg-neutral-100" : "bg-white/10";
  // Cart count badge: sobre bg oscuro es blanco con texto oscuro; sobre bg
  // claro es un pill de acento (--campaign-accent = accent-color del tenant).
  const cartBadgeStyle: React.CSSProperties = isDarkText
    ? { backgroundColor: "var(--campaign-accent)", color: "#ffffff" }
    : { backgroundColor: "#ffffff", color: "var(--campaign-bg, #0f1114)" };

  return (
    <>
      {/* Topbar unificada con el resto de templates: se edita desde el plugin
          `banners` en admin (`/app/banners`) con placement `top_bar`. Reemplaza
          el campo hardcoded `assets.campaign.announcement`, que queda en el
          schema por compat pero ya no se renderiza. */}
      <HomeTopbar />

      <header
        className={
          bg
            ? "campaign-home sticky top-0 z-40 w-full"
            : "campaign-home sticky top-0 z-40 w-full bg-[color:var(--campaign-bg,#0f1114)] text-white"
        }
        style={headerStyle}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
          <LocalizedClientLink href="/" className="flex items-center gap-3">
            {logo ? (
              <span
                className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full ${logoBgClass}`}
              >
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
              <span className={`text-sm font-semibold sm:text-base ${nameClass}`}>
                {tenant.name}
              </span>
              {chrome?.subtitle ? (
                <span
                  className={`text-[10px] font-medium tracking-widest ${subtitleClass}`}
                >
                  {chrome.subtitle}
                </span>
              ) : null}
            </span>
          </LocalizedClientLink>

          <div className="ml-auto flex items-center gap-3">
            {hasSpaceDesigner && (
              <LocalizedClientLink
                href="/espacios"
                className={`hidden rounded-full border px-3 py-1.5 text-xs transition sm:inline-flex ${borderClass} ${pillTextClass} ${pillHoverClass}`}
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
                  className={`hidden rounded-full border px-3 py-1.5 text-xs transition sm:inline-flex ${borderClass} ${pillTextClass} ${pillHoverClass}`}
                >
                  {chrome.poweredByLabel}
                </a>
              ) : (
                <span
                  className={`hidden rounded-full border px-3 py-1.5 text-xs sm:inline-flex ${borderClass} ${pillTextClass}`}
                >
                  {chrome.poweredByLabel}
                </span>
              )
            ) : null}
            <button
              ref={cartBtnRef}
              type="button"
              onClick={openCart}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${borderClass} ${pillBgClass} ${pillTextClass} ${pillHoverClass}`}
              aria-label={`Mi carrito (${cartCount} items)`}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Mi carrito</span>
              {cartCount > 0 ? (
                <span
                  className="rounded-full px-2 text-xs font-semibold"
                  style={cartBadgeStyle}
                >
                  {cartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        {hasSpaceDesigner && (
          <nav
            aria-label="Diseñador de espacios"
            className={`border-t px-4 sm:hidden ${borderClass}`}
          >
            <LocalizedClientLink
              href="/espacios"
              className={`block py-3 text-sm font-medium transition ${pillTextClass}`}
            >
              Diseñá tu espacio
            </LocalizedClientLink>
          </nav>
        )}
      </header>
    </>
  );
}
