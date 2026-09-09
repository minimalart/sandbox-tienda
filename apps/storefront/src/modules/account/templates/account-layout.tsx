"use client";

import { Box, CreditCard, FileText, Gift, Heart, LogOut, MapPin, Repeat, Star, User } from "lucide-react";
import { useAuth } from "@lib/hooks/use-auth";
import { stripSitePrefix, useSiteHref, useSitePrefix } from "@lib/site-config/context";
import { getCustomerAvatar } from "@lib/util/customer-avatar";
import type { HttpTypes } from "@medusajs/types";
import LogoutConfirmModal from "@modules/account/components/logout-confirm-modal";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import UserAvatar from "@modules/common/components/user-avatar";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState } from "react";

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null;
  hasCredit?: boolean;
  hasRecurring?: boolean;
  children: React.ReactNode;
}

const baseNavigation = [
  { name: "Mis pedidos", shortName: "Pedidos", href: "/account/orders", icon: Box },
  { name: "Favoritos", shortName: "Favoritos", href: "/account/wishlist", icon: Heart },
  { name: "Mis puntos", shortName: "Puntos", href: "/account/loyalty", icon: Star },
  { name: "Gift Cards", shortName: "Gift Cards", href: "/account/gift-cards", icon: Gift },
  { name: "Mi cuenta", shortName: "Cuenta", href: "/account/profile", icon: User },
  { name: "Mis direcciones", shortName: "Dirección", href: "/account/addresses", icon: MapPin },
  { name: "Datos de facturación", shortName: "Facturación", href: "/account/billing", icon: FileText },
];

const creditNavItem = {
  name: "Cuenta Corriente",
  shortName: "Cta. Cte.",
  href: "/account/credit",
  icon: CreditCard,
};

const recurringNavItem = {
  name: "Compras recurrentes",
  shortName: "Recurrentes",
  href: "/account/subscriptions",
  icon: Repeat,
};

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Marca activo el ítem cuya ruta coincide con la actual. El `pathname` llega ya
 * normalizado con stripSitePrefix: dentro de una tienda la URL puede llevar o no
 * el prefijo /demo/{slug} (los links lo ponen, algunos redirects no), y comparar
 * la ruta lógica cubre los dos casos. El `startsWith` cubre las subrutas
 * (p. ej. /account/orders/details/{id} mantiene activo "Mis pedidos").
 */
const isActiveHref = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  hasCredit = false,
  hasRecurring = false,
  children,
}) => {
  const secondaryNavigation = [
    ...baseNavigation.slice(0, 1),
    // "Compras recurrentes" va pegado a "Mis pedidos": son ambos historial de compra.
    ...(hasRecurring ? [recurringNavItem] : []),
    ...baseNavigation.slice(1),
    ...(hasCredit ? [creditNavItem] : []),
  ];
  const pathname = usePathname();
  const { logout, isLoading: isAuthLoading } = useAuth();
  const siteHref = useSiteHref();
  const sitePrefix = useSitePrefix();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const normalizedPath = stripSitePrefix(pathname || "/", sitePrefix);

  const { avatarUrl, initials } = getCustomerAvatar(customer);

  const Avatar = ({ size }: { size: number }) => (
    <UserAvatar
      alt={`Foto de ${customer?.first_name ?? "perfil"}`}
      avatarUrl={avatarUrl}
      className="ring-1 ring-gray-200"
      initials={initials}
      size={size}
    />
  );

  const handleLogout = async () => {
    if (!(await logout())) return;
    // En un demo volvemos a su home (/demo/{slug}) en vez de la raíz, que sale
    // del demo y lleva a Mercatto.
    window.location.href = siteHref("/");
  };

  return (
    <div
      className="mx-auto max-w-7xl pt-8 lg:flex lg:gap-x-16 lg:px-8"
      data-testid="account-page"
    >
      {customer && (
        <>
          {/* ── Mobile nav ── */}
          <div className="lg:hidden">
            <div className="flex items-center gap-3 px-4 pb-3">
              <Avatar size={48} />
              <div>
                <h1 className="font-bold text-gray-900 text-xl leading-6">
                  Hola,
                  <br />
                  {customer.first_name}
                </h1>
              </div>
            </div>
            <div className="overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex gap-3 px-4">
                {secondaryNavigation.map((item) => {
                  const isCurrent = isActiveHref(normalizedPath, item.href);
                  return (
                    <LocalizedClientLink
                      className={classNames(
                        isCurrent
                          ? "border-[--primary-color]"
                          : "border-gray-200 bg-white",
                        "flex w-[80px] h-[80px] flex-none flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-3 transition-colors"
                      )}
                      href={item.href}
                      key={item.name}
                      style={
                        isCurrent
                          ? {
                              backgroundColor:
                                "color-mix(in srgb, var(--primary-color) 12%, white)",
                            }
                          : undefined
                      }
                    >
                      <item.icon
                        className={classNames(
                          isCurrent ? "text-[--primary-color]" : "text-gray-500",
                          "h-5 w-5"
                        )}
                        strokeWidth={1.75}
                      />
                      <span
                        className={classNames(
                          isCurrent ? "text-[--primary-color]" : "text-gray-600",
                          "text-center font-semibold text-xs leading-tight"
                        )}
                      >
                        {item.shortName}
                      </span>
                    </LocalizedClientLink>
                  );
                })}
                <button
                  className="flex w-[80px] flex-none flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  onClick={() => setShowLogoutModal(true)}
                  type="button"
                >
                  <LogOut className="h-5 w-5" strokeWidth={1.75} />
                  <span className="text-center font-semibold text-xs leading-tight">
                    Salir
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Desktop sidebar ── */}
          <aside className="hidden lg:block lg:w-64 lg:flex-none lg:py-8">
            <div className="flex items-center gap-3 pb-6">
              <Avatar size={56} />
              <div>
                <h2 className="font-bold text-gray-900 text-2xl leading-7">
                  Hola,
                  <br />
                  {customer.first_name}
                </h2>
              </div>
            </div>
            <nav>
              <ul className="flex flex-col gap-y-1" role="list">
                {secondaryNavigation.map((item) => {
                  const isCurrent = isActiveHref(normalizedPath, item.href);
                  return (
                    <li key={item.name}>
                      <LocalizedClientLink
                        aria-current={isCurrent ? "page" : undefined}
                        className={classNames(
                          // El activo se distingue del hover con una barra a la
                          // izquierda: el tinte solo (6% del primario) es
                          // demasiado sutil y se confunde con el hover.
                          isCurrent
                            ? "text-[--primary-color] before:absolute before:inset-y-1 before:left-0 before:w-1 before:rounded-full before:bg-[--primary-color] before:content-['']"
                            : "text-gray-700 hover:bg-[--mc-green-soft] hover:text-[--primary-color]",
                          "group relative flex gap-x-3 rounded-md py-2 pr-3 pl-3 font-semibold text-sm/6 transition-colors"
                        )}
                        href={item.href}
                        // Tailwind 3 no aplica el modificador de opacidad sobre
                        // --primary-color: el tinte va inline con color-mix.
                        style={
                          isCurrent
                            ? {
                                backgroundColor:
                                  "color-mix(in srgb, var(--primary-color) 12%, white)",
                              }
                            : undefined
                        }
                      >
                        <item.icon
                          aria-hidden="true"
                          className={classNames(
                            isCurrent
                              ? "text-[--primary-color]"
                              : "text-gray-400 group-hover:text-[--primary-color]",
                            "size-5 shrink-0"
                          )}
                          strokeWidth={1.75}
                        />
                        {item.name}
                      </LocalizedClientLink>
                    </li>
                  );
                })}
                <li>
                  <button
                    className="group flex w-full gap-x-3 rounded-md py-2 pr-3 pl-2 font-semibold text-gray-700 text-sm/6 transition-colors hover:bg-[--mc-green-soft] hover:text-red-600"
                    onClick={() => setShowLogoutModal(true)}
                    type="button"
                  >
                    <LogOut
                      aria-hidden="true"
                      className="size-5 shrink-0 text-gray-400 group-hover:text-red-600"
                      strokeWidth={1.75}
                    />
                    Salir
                  </button>
                </li>
              </ul>
            </nav>
          </aside>
        </>
      )}

      <LogoutConfirmModal
        isLoading={isAuthLoading}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        open={showLogoutModal}
      />

      <main className="px-4 py-5 sm:px-6 lg:flex-auto lg:px-0 lg:py-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AccountLayout;
