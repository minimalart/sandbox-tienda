import { AddToCartAnimationProvider } from '@lib/context/add-to-cart-animation';
import { BannersProvider } from '@lib/context/banners-context';
import { ChannelProvider } from '@lib/context/channel-context';
import { PromotionsAvailabilityProvider } from '@lib/context/promotions-availability';
import { hasActivePromotionsForChannel } from '@lib/data/active-promotion-ids';
import { getDemoHomeBanners, getHomeBanners } from '@lib/data/banners';
import { listCartOptions, retrieveCart } from '@lib/data/cart';
import { getActiveSalesChannelId, getBranchId } from '@lib/data/cookies';
import { getNavCategories } from '@lib/data/nav-categories';
import { getActivePdfCatalog } from '@lib/data/pdf-catalog';
import { getTintingGate } from '@lib/data/tinting';
import { getSpaceConfigurators } from '@lib/space-designer-slot';
import { getStoreSettings } from '@lib/data/store-settings';
import { retrieveCustomer } from '@lib/data/customer';
import { StoreProvider } from '@lib/stores/store-provider';
import { TenantProvider } from '@lib/site-config/context';
import { tenantForClient } from '@lib/site-config/tenant-for-client';
import {
	getActiveDemoSlug,
	getActiveSitePrefix,
	getActiveTenant,
} from '@lib/site-config/active-tenant';
import { canonicalUrl, getCanonicalOrigin } from '@lib/util/site-url';
import { getCustomerAvatar } from '@lib/util/customer-avatar';
import { WhatsappFloatingButtonSlot } from '@lib/whatsapp-slot';
import type { StoreCartShippingOption } from '@medusajs/types';
import { Toaster } from '@medusajs/ui';
import BackToTop from '@modules/common/components/back-to-top';
import HomeTopbar from '@modules/home/components/topbar';
import BrandsStickyBanner from '@modules/layout/components/brands-sticky-banner';
import CompareFloatingTray from '@modules/layout/components/compare-floating-tray';
import BranchGate from '@modules/layout/components/branch-gate';
import CartMismatchBanner from '@modules/layout/components/cart-mismatch-banner';

import PromoConflictGuard from '@modules/layout/components/promo-conflict-guard';
import CartDrawerMount from '@modules/layout/components/cart-drawer/cart-drawer-mount';
import MobileNavController from '@modules/layout/components/mobile-nav-controller';
import WishlistDrawer from '@modules/layout/components/wishlist-drawer';
import MobileSearchBar from '@modules/layout/components/mobile-search-bar';
import SmartHeader from '@modules/layout/components/smart-header';
import Footer from '@modules/layout/templates/footer';
import Nav from '@modules/layout/templates/nav';
import TechHeader from '@modules/home-technology/components/tech-header';
import TechFooter from '@modules/home-technology/components/tech-footer';
import FashionHeader from '@modules/home-fashion/components/fashion-header';
import FashionFooter from '@modules/home-fashion/components/fashion-footer';
import TrHeader from '@modules/home-tech-retail/components/tr-header';
import TrFooter from '@modules/home-tech-retail/components/tr-footer';
import SportsHeader from '@modules/home-sports/components/sports-header';
import SportsFooter from '@modules/home-sports/components/sports-footer';
import SportsStickyFilters from '@modules/home-sports/components/sports-sticky-filters';
import CampaignHeader from '@modules/home-campaign/components/campaign-header';
import CampaignFooter from '@modules/home-campaign/components/campaign-footer';
import { usesCustomChrome as templateUsesCustomChrome } from '@lib/site-config/template-helpers';
import FreeShippingPriceNudge from '@modules/shipping/components/free-shipping-price-nudge';
import { buildOrganizationJsonLd } from '@lib/util/seo/jsonld';
import JsonLd from '@modules/common/components/json-ld';
import type { Metadata } from 'next';
import { Suspense } from 'react';

// `metadataBase` tiene que ser REQUEST-AWARE: es la base de toda URL absoluta que
// Next genera (canonicals, OG). Estático quedaba congelado al valor de build, así
// que todas las tiendas emitían URLs del sitio principal.
export async function generateMetadata(): Promise<Metadata> {
	return { metadataBase: new URL(await getCanonicalOrigin()) };
}

export default async function PageLayout(props: {
	children: React.ReactNode;
	params: Promise<{ countryCode: string }>;
}) {
	const { countryCode } = await props.params;
	// Datos independientes: resolverlos en paralelo en vez de en cascada.
	const [
		tenant,
		demoSlug,
		sitePrefix,
		rawHomeBanners,
		customer,
		cart,
		activeSalesChannelId,
		branchId,
		storeSettings,
		pdfCatalog,
		navCategories,
		tintingGate,
		spaceConfigurators,
	] =
		await Promise.all([
			getActiveTenant(),
			getActiveDemoSlug(),
			getActiveSitePrefix(),
			getHomeBanners(),
			retrieveCustomer(),
			retrieveCart(),
			getActiveSalesChannelId(),
			getBranchId(),
			getStoreSettings(),
			// Sólo para decidir si mostrar el link "Catálogo" en el nav (cacheado).
			getActivePdfCatalog(countryCode),
			// Árbol del menú "Categorías" del nav (cacheado 5 min; [] si falla).
			getNavCategories(),
			// Sólo para decidir si mostrar el link "Buscá tu color" (cacheado 5 min).
			getTintingGate(),
			getSpaceConfigurators(),
		]);
	const hasPdfCatalog = !!pdfCatalog;
	const hasSpaceDesigner = spaceConfigurators.length > 0;
	// En demos, los banners se eligen por sales channel: sembramos el contexto
	// solo con los banners asignados explícitamente al canal de la demo (estricto).
	// Si la demo no tiene banners propios, el contexto queda vacío y el hero se
	// oculta (no hereda los banners del store principal). Fuera de demo, sin cambios.
	const homeBanners = demoSlug ? await getDemoHomeBanners() : rawHomeBanners;
	const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? '';
	// Multi-sucursal se configura en Admin → Preferencias. Apagado (default) ⇒ un
	// solo canal, sin gate (comportamiento estándar).
	const multiBranchEnabled = storeSettings.multi_branch_enabled;
	/**
	 * La BARRA del selector de zona es un sub-toggle: `multi_branch_enabled`
	 * gobernaba cinco comportamientos a la vez (esta barra, la resolución de
	 * sucursal al guardar dirección, la del login, la del checkout y el gate de
	 * cobertura de `/store/shipping-options`), así que una tienda que necesitaba el
	 * gate de cobertura no podía prenderlo sin arrastrar la barra.
	 *
	 * Apagarlo NO desactiva la resolución de sucursal: sigue pasando sola al
	 * guardar la dirección y en el checkout. Lo único que se cae es el prompt.
	 * Default `true`, así que ninguna tienda con multi-sucursal cambia de aspecto.
	 */
	const branchGatePromptEnabled = storeSettings.branch_gate_prompt_enabled;
	let shippingOptions: StoreCartShippingOption[] = [];

	if (cart) {
		const { shipping_options } = await listCartOptions();

		shippingOptions = shipping_options;
	}

	// El canal activo (sucursal resuelta) debe propagarse al contexto cliente.
	// ChannelProvider prioriza el canal del TenantProvider, así que inyectamos el
	// canal resuelto en el tenant que pasamos al provider (no en getTenant(), que
	// debe seguir siendo client-safe / estático).
	const resolvedChannelId =
		activeSalesChannelId || tenant.medusa.salesChannelId || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID;
	const tenantWithChannel = {
		...tenant,
		medusa: { ...tenant.medusa, salesChannelId: resolvedChannelId as string },
	};

	// Per-vertical templates swap the grocery chrome (SmartHeader / HomeTopbar /
	// Footer) for a dedicated header + footer. Providers and floating helpers
	// stay shared, so cart/account/search keep working. The grocery path
	// (default) is left exactly as-is.
	const isTechTemplate = tenant.template === 'technology';
	const isFashionTemplate = tenant.template === 'fashion';
	const isTechRetailTemplate = tenant.template === 'tech-retail';
	const isSportsTemplate = tenant.template === 'sports';
	const isCampaignTemplate = tenant.template === 'campaign';
	const usesCustomChrome = templateUsesCustomChrome(tenant.template);
	const customWrapperClass = isTechTemplate
		? 'tech-home'
		: isFashionTemplate
			? 'fashion-home'
			: isTechRetailTemplate
				? 'tech-retail-home'
				: isSportsTemplate
					? 'sports-home'
					: isCampaignTemplate
						? 'campaign-home'
						: undefined;
	const cartCount = cart?.items?.reduce((acc, item) => acc + (item.quantity || 0), 0) ?? 0;

	// Los accesos a "Promociones" (pill del nav, menú mobile, bottom nav) llevan a
	// la PLP filtrada por promo: sin promociones activas en el canal quedaría
	// vacía, así que los escondemos. Consulta cacheada 5 min y fail-CLOSED: si no
	// se puede averiguar tampoco se muestran (ver `promotions-gate.ts`).
	const hasActivePromotions = await hasActivePromotionsForChannel(resolvedChannelId);

	// Identidad de la tienda (schema.org/Organization) para TODO el árbol `(main)`, no
	// sólo para la home: la auditoría del 19/08 encontró 37 de 57 páginas sin ningún dato
	// estructurado, porque el único `<JsonLd/>` fuera de la PDP vivía en `page.tsx`.
	const organizationJsonLd = buildOrganizationJsonLd({
		name: tenant.metadata?.name || tenant.name,
		url: await canonicalUrl('/'),
		logo: tenant.assets?.logos?.main || null,
	});

	return (
		<PromotionsAvailabilityProvider hasActivePromotions={hasActivePromotions}>
		<JsonLd data={organizationJsonLd} />
		<TenantProvider tenant={tenantForClient(tenantWithChannel)} siteSlug={demoSlug ?? undefined} sitePrefix={sitePrefix}>
			<ChannelProvider
				customerGroupId={tenant.medusa.customerGroupId || process.env.NEXT_PUBLIC_CUSTOMER_GROUP_ID}
				salesChannelId={resolvedChannelId}
			>
				<StoreProvider cart={cart}>
					<AddToCartAnimationProvider>
						<BannersProvider initialBanners={homeBanners}>
							{isTechTemplate ? (
								<TechHeader initialCartCount={cartCount} isLoggedIn={!!customer} hasSpaceDesigner={hasSpaceDesigner} />
							) : isFashionTemplate ? (
								<FashionHeader initialCartCount={cartCount} isLoggedIn={!!customer} hasSpaceDesigner={hasSpaceDesigner} />
							) : isTechRetailTemplate ? (
								<TrHeader initialCartCount={cartCount} isLoggedIn={!!customer} hasSpaceDesigner={hasSpaceDesigner} />
							) : isSportsTemplate ? (
								<SportsHeader
									hasSpaceDesigner={hasSpaceDesigner}
									initialCartCount={cartCount}
									isLoggedIn={!!customer}
									{...getCustomerAvatar(customer)}
								/>
							) : isCampaignTemplate ? (
								<CampaignHeader initialCartCount={cartCount} hasSpaceDesigner={hasSpaceDesigner} />
							) : (
								<SmartHeader
									categories={navCategories}
									hasSpaceDesigner={hasSpaceDesigner}
									hasTinting={tintingGate.catalogReady}
									topbar={<HomeTopbar />}
									nav={
										<Suspense fallback={null}>
											<Nav
												hasSpaceDesigner={hasSpaceDesigner}
												cart={cart}
												categories={navCategories}
												customer={customer}
												hasPdfCatalog={hasPdfCatalog}
												hasTinting={tintingGate.catalogReady}
											/>
										</Suspense>
									}
									searchBar={
										<Suspense fallback={null}>
											<MobileSearchBar />
										</Suspense>
									}
									isLoggedIn={!!customer}
									{...getCustomerAvatar(customer)}
								/>
							)}
							<div className={customWrapperClass}>
								{/* Grocery-only chrome (branch gate, mismatch banner, shipping
								    nudge) is suppressed on the editorial/premium templates. */}
								{!usesCustomChrome && multiBranchEnabled && branchGatePromptEnabled && (
									<BranchGate googleMapsApiKey={googleMapsApiKey} hasBranch={!!branchId} />
								)}
								{!usesCustomChrome && customer && cart && (
									<CartMismatchBanner cart={cart} customer={customer} />
								)}

								{!usesCustomChrome && cart && (
									<FreeShippingPriceNudge cart={cart} shippingOptions={shippingOptions} variant='popup' />
								)}
								{props.children}
							</div>
							{isTechTemplate ? (
								<TechFooter />
							) : isFashionTemplate ? (
								<FashionFooter />
							) : isTechRetailTemplate ? (
								<TrFooter />
							) : isSportsTemplate ? (
								<SportsFooter />
							) : isCampaignTemplate ? (
								<CampaignFooter />
							) : (
								<Footer />
							)}
							{/* Una sola instancia: SmartHeader monta Nav para mobile y desktop. */}
							<CartDrawerMount themeClassName={isSportsTemplate ? 'sports-cart' : undefined} />
							{usesCustomChrome ? (
								<>
									{/* El drawer de favoritos no vive en el chrome grocery
									    (MobileNavController); lo montamos acá para que los templates
									    por vertical (sports/tech/fashion) también puedan abrirlo,
									    incluido el invitado (favoritos en cookie). */}
									<WishlistDrawer />
								</>
							) : (
								<MobileNavController customer={customer} hasTinting={tintingGate.catalogReady} hasSpaceDesigner={hasSpaceDesigner} />
							)}
							<BackToTop />
							<CompareFloatingTray />
							{isSportsTemplate ? (
								<SportsStickyFilters />
							) : (
								<Suspense fallback={null}>
									<BrandsStickyBanner />
								</Suspense>
							)}
							{/* Botón flotante de WhatsApp: solo si el toggle está activo en
							    Admin → WhatsApp → Ajustes (el slot resuelve la config y, sin la
							    extensión instalada, no renderiza nada). */}
							<Suspense fallback={null}>
								<WhatsappFloatingButtonSlot />
							</Suspense>
							<PromoConflictGuard />
							<Toaster />
						</BannersProvider>
					</AddToCartAnimationProvider>
				</StoreProvider>
			</ChannelProvider>
		</TenantProvider>
		</PromotionsAvailabilityProvider>
	);
}
