import { AddToCartAnimationProvider } from "@lib/context/add-to-cart-animation";
import { retrieveCart } from "@lib/data/cart";
import { retrieveCustomer } from "@lib/data/customer";
import { TenantProvider } from "@lib/site-config/context";
import { tenantForClient } from "@lib/site-config/tenant-for-client";
import {
  getActiveDemoSlug,
  getActiveSitePrefix,
  getActiveTenant,
} from "@lib/site-config/active-tenant";
import { storeFeedHref } from "@lib/site-config/template-helpers";
import { getTenantThemeStyles } from "@lib/site-config/theme/inject-theme";
import { StoreProvider } from "@lib/stores/store-provider";
import { getCustomerAvatar } from "@lib/util/customer-avatar";
import { ArrowLeftIcon, UserIcon } from "@heroicons/react/24/outline";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import UserAvatar from "@modules/common/components/user-avatar";
import "@modules/home-sports/sports-theme.css";
import "@modules/home-campaign/campaign-theme.css";
import CartDrawerMount from "@modules/layout/components/cart-drawer/cart-drawer-mount";
import PromoConflictGuard from "@modules/layout/components/promo-conflict-guard";
import { Toaster } from "@medusajs/ui";

export default async function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getActiveTenant();
  const demoSlug = await getActiveDemoSlug();
  const sitePrefix = await getActiveSitePrefix();
  const themeStyles = await getTenantThemeStyles();
  const customer = await retrieveCustomer();
  const cart = await retrieveCart();
  const isSportsTemplate = tenant.template === "sports";
  const isCampaignTemplate = tenant.template === "campaign";
  const { avatarUrl, initials } = getCustomerAvatar(customer);
  const logoSrc =
    tenant.assets.logos?.main ?? "/logos-mercatto/logocompleto-verde.svg";

  return (
    <TenantProvider tenant={tenantForClient(tenant)} siteSlug={demoSlug ?? undefined} sitePrefix={sitePrefix}>
      <StoreProvider cart={cart}>
        {/* El carrusel de sugerencias abre el quick view, y ProductActions usa la
            animación de "vuelo al carrito": sin este provider el click en una
            card tiraba el checkout entero. */}
        <AddToCartAnimationProvider>
        <div
          className={
            isSportsTemplate
              ? "sports-checkout min-h-screen bg-white"
              : isCampaignTemplate
                ? "campaign-checkout min-h-screen bg-white"
                : "min-h-screen bg-gray-50"
          }
          style={themeStyles}
        >
          <header
            className={
              isSportsTemplate
                ? "border-[--sp-ink] border-b-2 bg-[--sp-paper]"
                : isCampaignTemplate
                  ? "border-b border-gray-200 bg-white"
                  : "bg-white shadow-sm"
            }
          >
            <div
              className={
                isSportsTemplate
                  ? "relative mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-10"
                  : "relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
              }
            >
              <LocalizedClientLink
                className={
                  isSportsTemplate
                    ? "flex items-center gap-2 font-bold text-[--sp-ink] text-xs uppercase tracking-[0.08em] hover:opacity-70"
                    : "flex items-center gap-2 font-semibold text-gray-600 text-sm hover:text-[--primary-color]"
                }
                data-testid="back-to-store-link"
                href={storeFeedHref(tenant.template)}
              >
                <ArrowLeftIcon aria-hidden className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Volver a la tienda</span>
              </LocalizedClientLink>
              <LocalizedClientLink
                className="absolute left-1/2 -translate-x-1/2"
                data-testid="store-link"
                href="/"
              >
                {/* biome-ignore lint/a11y/useAltText: alt provisto */}
                <img
                  alt={tenant.name}
                  className={
                    isSportsTemplate
                      ? "h-7 w-auto object-contain sm:h-8"
                      : "h-10 w-auto sm:h-12"
                  }
                  src={logoSrc}
                />
              </LocalizedClientLink>
              {/* Campaign es un flow de compra como invitado (institucional):
                  no hay onboarding de cuenta. Ocultamos el link para no
                  invitar a un flow inexistente. Otros templates lo muestran. */}
              {!isCampaignTemplate && (
                <LocalizedClientLink
                  className={
                    isSportsTemplate
                      ? "flex items-center gap-2 font-bold text-[--sp-ink] text-xs uppercase tracking-[0.08em] hover:opacity-70"
                      : "flex items-center gap-2 font-medium text-gray-600 text-sm hover:text-[--primary-color]"
                  }
                  href="/account"
                >
                  {customer ? (
                    <UserAvatar
                      alt={`Foto de ${customer.first_name ?? "perfil"}`}
                      avatarUrl={avatarUrl}
                      className="text-[11px]"
                      initials={initials}
                      size={24}
                    />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                  <span className="hidden sm:inline">
                    {customer
                      ? customer.first_name || "Mi cuenta"
                      : "Iniciar sesión"}
                  </span>
                </LocalizedClientLink>
              )}
            </div>
          </header>
          <div className="relative" data-testid="checkout-container">
            {children}
          </div>
          <CartDrawerMount
            themeClassName={isSportsTemplate ? "sports-cart" : undefined}
          />
          <PromoConflictGuard />
          <Toaster />
        </div>
        </AddToCartAnimationProvider>
      </StoreProvider>
    </TenantProvider>
  );
}
