"use client";

import { Radio, RadioGroup } from "@headlessui/react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import {
  ArchiveBoxIcon,
  CheckIcon,
  TruckIcon,
} from "@heroicons/react/24/solid";
import {
  CARRIER_REGISTRY,
  type CarrierDefinition,
  matchCarrier,
} from "@lib/constants";
import { calculatePriceForShippingOption } from "@lib/data/fulfillment";

import {
  type CarrierBranch,
  useCarrierBranches,
} from "@lib/hooks/use-carrier-branches";
import {
  type StorePickupLocation,
  useStorePickupLocations,
} from "@lib/hooks/use-store-pickup-locations";

// CDE and Kit are out of scope for this boilerplate — stubs kept for compilation
type CdeLocation = {
  id: string;
  name: string;
  street: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  whatsapp: string | null;
  business_hours: string | null;
  business_hours_summary: string | null;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
};
const useCdeLocations = (_active?: boolean) => ({
  cdeLocations: [] as CdeLocation[],
  isLoading: false,
  error: null as string | null,
  fetchCdeLocations: () => Promise.resolve(),
});
const haversineKm = (_lat1: number, _lon1: number, _lat2: number, _lon2: number): number => 0;
const cartHasKit = (_cart: HttpTypes.StoreCart): boolean => false;

import { goToCheckoutStep } from "@lib/util/checkout-step";
import { convertToLocale } from "@lib/util/money";
import { Loader } from "@medusajs/icons";
import type { HttpTypes } from "@medusajs/types";
import { clx, Text } from "@medusajs/ui";
import ErrorMessage from "@modules/checkout/components/error-message";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

type DeliveryModeKind = "home" | "branch" | "cde";

// Modalidad de entrega (dónde se recibe el pedido) y carrier que la opera,
// como dos ejes separados. Antes un solo string ("shipping" | "pickup" | "cde")
// conflacionaba ambos, lo que no dejaba lugar a un segundo carrier de pickup:
// "pickup" no distinguía si la sucursal era de Andreani o de la red propia.
// `carrier` es null para modalidades sin carrier (CDE, retiro en tienda propia).
type DeliveryMode = {
  mode: DeliveryModeKind;
  carrier: string | null;
};

type ShippingProps = {
  disableAutoSelect?: boolean;
  cart: HttpTypes.StoreCart;
  availableShippingMethods: HttpTypes.StoreCartShippingOption[] | null;
  // Próximo step al que ir tras "Continuar" — permite al parent decidir según policy
  // (ej: cuando `benefits` está deshabilitado, saltar a `recipients` o `payment`).
  // Default 'benefits' preserva el comportamiento previo para consumidores sin fix.
  nextStep?: string;
  onCartUpdate?: (
    cart?: HttpTypes.StoreCart | null,
  ) => Promise<HttpTypes.StoreCart | null>;
  // Opcional: ausente o `evaluated: false` = feature apagada o sin cart/coords
  // para evaluar, mismo comportamiento de siempre.
  shippingCoverage?: { evaluated: boolean; covered: boolean };
  // El padre está re-pidiendo /shipping-options porque cambió la dirección.
  // Mientras esto es true, `availableShippingMethods` puede ser la lista
  // VIEJA (calculada contra la dirección anterior) — no se puede pintar como
  // si fuera válida. Opcional y default false: el resto de los consumidores
  // de Shipping no reciben este ciclo de recálculo.
  refreshingOptions?: boolean;
};

// El nombre de la shipping option en el backend puede llevar un sufijo
// "@<carrier>"/"@<red>" (convención real, no un artefacto de display) que acá
// solo se recorta para el label. Se arma a partir del registry de carriers +
// sus redes para no tener que tocar este archivo cuando se sume un carrier
// nuevo (hoy da exactamente /@(?:andreani|hop)\b/gi, igual que antes).
const SHIPPING_PROVIDER_TAG_REGEX = new RegExp(
  `@(?:${Object.values(CARRIER_REGISTRY)
    .flatMap((carrier) => [
      carrier.id,
      ...Object.keys(carrier.networkBadges ?? {}),
    ])
    .join("|")})\\b`,
  "gi",
);

// ============================================================================
// HELPERS DE CLASIFICACIÓN (puros — no dependen de estado del componente)
// ============================================================================

// Configurable por env: el ID de la shipping option de CDE es un valor de DB
// literal, no algo que se pueda derivar del nombre. Default preserva el valor
// histórico para no requerir la env var en ambientes que todavía no la seteen.
const CDE_SHIPPING_OPTION_ID =
  process.env.NEXT_PUBLIC_CDE_SHIPPING_OPTION_ID ||
  "so_01KN5516WTYBPEVNQQDEZ3T9S6";

function isCdeShippingOption(sm: HttpTypes.StoreCartShippingOption): boolean {
  const name = sm.name?.toLowerCase() ?? "";
  return (
    sm.id === CDE_SHIPPING_OPTION_ID ||
    name.includes("centro de distribución") ||
    name.includes("centro de distribucion")
  );
}

// Pickup detection: fulfillment_set type OR name contains "retiro"
function isPickupOption(sm: HttpTypes.StoreCartShippingOption): boolean {
  const serviceZone = (sm as any).service_zone;
  return (
    serviceZone?.fulfillment_set?.type === "pickup" ||
    !!sm.name?.toLowerCase().includes("retiro")
  );
}

function isDropzone(sm: HttpTypes.StoreCartShippingOption): boolean {
  return !!sm.name?.toLowerCase().includes("dropzone");
}

// Retiro en sucursal DE UN CARRIER (hoy solo Andreani; un segundo carrier de
// pickup se suma solo agregando su entrada al CARRIER_REGISTRY).
function isCarrierPickupOption(sm: HttpTypes.StoreCartShippingOption): boolean {
  return isPickupOption(sm) && matchCarrier(sm.name, sm.provider_id) !== null;
}

// Retiro en tienda propia: marcado EN POSITIVO por la propia shipping option
// (ver seed-store-pickup-shipping.ts, data.pickup_kind: 'store'), no por
// descarte de todo lo que no sea un carrier o CDE. La definición negativa
// anterior clasificaba cualquier pickup no reconocido como tienda propia,
// mostrando la lista de sucursales equivocada.
function isStorePickupOption(sm: HttpTypes.StoreCartShippingOption): boolean {
  return sm.data?.pickup_kind === "store";
}

/**
 * Stock location a la que está anclada una shipping option, vía su service
 * zone. Es el único puente entre una opción y una sucursal física.
 *
 * El id viaja porque `lib/data/fulfillment.ts` pide explícitamente
 * `*service_zone.fulfillment_set.location.address` — sin ese `fields` la
 * expansión no viene y esto devuelve `null` para todas.
 */
function stockLocationIdOf(
  sm: HttpTypes.StoreCartShippingOption,
): string | null {
  const zone = (
    sm as unknown as {
      service_zone?: { fulfillment_set?: { location?: { id?: string } } };
    }
  ).service_zone;
  return zone?.fulfillment_set?.location?.id ?? null;
}

/**
 * La opción de "retiro en tienda" que corresponde a una sucursal.
 *
 * Con un fulfillment set por sucursal hay N opciones de retiro homónimas, una
 * por stock location. Quedarse con la PRIMERA —lo que se hacía antes— mandaba
 * TODAS las órdenes de retiro a la misma sucursal: la elegida de verdad sólo
 * viajaba en `cart.metadata.store_id`, que el admin no mira. El modal de
 * "Crear fulfillment" de Medusa preselecciona la ubicación siguiendo
 * `order.shipping_methods[0].shipping_option_id → service_zone.fulfillment_set.location`,
 * así que proponía siempre la misma sucursal y el operador tenía que
 * corregirla a mano, pedido por pedido.
 *
 * El fallback a la primera disponible es deliberado: una tienda con una sola
 * opción de retiro (el caso del boilerplate) no tiene nada que emparejar y
 * tiene que seguir comportándose igual que siempre.
 */
function pickupOptionForStore(
  methods: HttpTypes.StoreCartShippingOption[] | undefined,
  store: StorePickupLocation | null,
): HttpTypes.StoreCartShippingOption | undefined {
  const available = methods?.filter(
    (m) => isStorePickupOption(m) && !m.insufficient_inventory,
  );
  if (!available?.length) return undefined;
  const stockLocationId = store?.stock_location_id;
  const matching = stockLocationId
    ? available.find((m) => stockLocationIdOf(m) === stockLocationId)
    : undefined;
  return matching ?? available[0];
}

function isKitShippingOption(sm: HttpTypes.StoreCartShippingOption): boolean {
  return !!(sm as any).data?.kit_prices;
}

// Única fuente de verdad para pasar de una shipping option a su DeliveryMode.
// Reemplaza el sniffing de substrings que antes vivía duplicado en el estado
// inicial (savedDeliveryMode), en el onChange del RadioGroup y en los reverts
// de error de handleSetShippingMethod.
function resolveDeliveryMode(
  sm: HttpTypes.StoreCartShippingOption,
): DeliveryMode {
  if (isCdeShippingOption(sm)) return { mode: "cde", carrier: null };
  if (isPickupOption(sm)) {
    return { mode: "branch", carrier: matchCarrier(sm.name, sm.provider_id)?.id ?? null };
  }
  return { mode: "home", carrier: matchCarrier(sm.name, sm.provider_id)?.id ?? null };
}

// ============================================================================
// HELPERS
// ============================================================================

async function saveShippingMetadata(
  metadata: Record<string, string>,
): Promise<HttpTypes.StoreCart | null> {
  try {
    const response = await fetch("/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateMetadata", metadata }),
    });
    const data = await response.json();
    return data.cart || null;
  } catch {
    // Non-blocking: metadata save failure shouldn't block checkout
    return null;
  }
}

function sanitizeShippingLabel(value?: string | null): string {
  return (value ?? "")
    .replace(SHIPPING_PROVIDER_TAG_REGEX, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getCartCoordinates(cart: HttpTypes.StoreCart): {
  latitude: number;
  longitude: number;
} | null {
  const addrMeta = cart.shipping_address?.metadata as
    | { latitude?: string | number; longitude?: string | number }
    | undefined;
  const cartMeta = cart.metadata as
    | { shipping_lat?: string | number; shipping_lng?: string | number }
    | undefined;
  const rawLat = cartMeta?.shipping_lat ?? addrMeta?.latitude;
  const rawLng = cartMeta?.shipping_lng ?? addrMeta?.longitude;
  const latitude = rawLat != null ? Number(rawLat) : NaN;
  const longitude = rawLng != null ? Number(rawLng) : NaN;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Consume el registry de carriers directamente — antes esto y
// `getShippingIcon` (en @lib/constants, sin consumidores) eran dos mecanismos
// de branding paralelos que podían divergir. `network` selecciona el badge de
// una sub-red del carrier (ej. "hop" dentro de Andreani) en vez del logo
// principal.
function ShippingProviderBadge({
  carrier,
  network,
}: {
  carrier: CarrierDefinition;
  network?: string;
}) {
  const badge = network ? carrier.networkBadges?.[network] : undefined;
  const src = badge?.logoSrc ?? carrier.logoSrc;
  const alt = badge?.label ?? carrier.label;
  const width = badge?.badgeWidth ?? carrier.badgeWidth;
  const scale = badge?.badgeScale ?? carrier.badgeScale;

  return (
    <span className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
      <span className="relative h-7 overflow-hidden px-1" style={{ width: `${width}px` }}>
        <Image
          alt={alt}
          className="object-contain object-center"
          fill
          sizes={`${width}px`}
          src={src}
          style={{ transform: `scale(${scale})` }}
        />
      </span>
    </span>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

const Shipping: React.FC<ShippingProps> = ({
  cart,
  availableShippingMethods,
  onCartUpdate,
  shippingCoverage,
  refreshingOptions = false,
  disableAutoSelect = false,
  nextStep = 'benefits',
}) => {
  const hasNoCoverage =
    !!shippingCoverage?.evaluated && !shippingCoverage.covered;

  // Restore state from cart metadata (component remounts when step changes)
  const cartMeta = (cart as any).metadata as Record<string, string> | undefined;
  const savedShippingMethodId =
    cart.shipping_methods?.at(-1)?.shipping_option_id || null;
  // The selected shipping OPTION is authoritative for the flow (pickup vs
  // domicilio vs cde) — cart metadata (retiro_sucursal…) can lag behind it, and
  // if it does, deliveryMode would init as { mode: "home" } while a pickup
  // option is selected, leaving the branch list hidden until the user re-toggles.
  const savedSelectedOption =
    availableShippingMethods?.find((m) => m.id === savedShippingMethodId) ||
    null;
  const savedDeliveryMode: DeliveryMode | null = (() => {
    if (savedSelectedOption) {
      return resolveDeliveryMode(savedSelectedOption);
    }
    // No option resolved yet → fall back to the cart metadata hint. El
    // carrier se desconoce hasta que la opción resuelva (efecto de "upgrade"
    // más abajo la corrige apenas availableShippingMethods esté listo).
    if (
      cartMeta?.shipping_method === "retiro_sucursal" ||
      cartMeta?.shipping_method === "retiro_store"
    )
      return { mode: "branch", carrier: null };
    if (cartMeta?.shipping_method === "retiro_cde")
      return { mode: "cde", carrier: null };
    return savedShippingMethodId ? { mode: "home", carrier: null } : null;
  })();
  const savedBranch: CarrierBranch | null =
    cartMeta?.pickup_branch_id && cartMeta?.pickup_branch_name
      ? {
          id: cartMeta.pickup_branch_id,
          description: cartMeta.pickup_branch_name.split(" - ")[0] || "",
          address: "",
          city: "",
          province: "",
          postalCode: "",
          phone: "",
          type: "",
          network: "",
          businessHours: "",
        }
      : null;

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(
    savedDeliveryMode,
  );
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [shippingMethodId, setShippingMethodId] = useState<string | null>(
    savedShippingMethodId,
  );
  const savedCde: CdeLocation | null =
    cartMeta?.selected_cde_id && cartMeta?.selected_cde_name
      ? {
          id: cartMeta.selected_cde_id,
          name: cartMeta.selected_cde_name,
          street: null,
          city: null,
          province: null,
          phone: null,
          whatsapp: null,
          business_hours: null,
          business_hours_summary: null,
          code: null,
          latitude: null,
          longitude: null,
        }
      : null;

  const savedStore: StorePickupLocation | null =
    cartMeta?.store_id && cartMeta?.store_name
      ? {
          id: cartMeta.store_id,
          name: cartMeta.store_name,
          address: cartMeta.store_address ?? "",
          city: cartMeta.store_city ?? "",
          province: "",
          latitude: null,
          longitude: null,
          // La metadata del carrito no guarda la stock location: quien la
          // necesita para emparejar la opción de retiro es `handleSelectStore`,
          // y ahí la sucursal viene de la lista del endpoint, no de acá.
          stock_location_id: null,
        }
      : null;

  const [selectedBranch, setSelectedBranch] = useState<CarrierBranch | null>(
    savedBranch,
  );
  const [selectedCde, setSelectedCde] = useState<CdeLocation | null>(savedCde);
  const [selectedStore, setSelectedStore] = useState<StorePickupLocation | null>(
    savedStore,
  );
  const hasAutoSelected = useRef(!!savedShippingMethodId);
  // Mirrors isLoading so handlers can short-circuit without stale-closure risk.
  const isLoadingRef = useRef(false);

  const searchParams = useSearchParams();

  const isOpen = searchParams.get("step")?.replace(/^edit-/, '') === "delivery";

  // Postal code from the user's shipping address (pre-filled, no re-entry)
  const postalCode = cart.shipping_address?.postal_code || "";

  const hasKit = cartHasKit(cart);

  const _shippingMethods = availableShippingMethods?.filter(
    (sm) =>
      !isPickupOption(sm) &&
      !isDropzone(sm) &&
      (hasKit ? isKitShippingOption(sm) : !isKitShippingOption(sm)),
  );

  // Same kit/no-kit rule as _shippingMethods: kit carts only see kit-priced
  // pickup options, non-kit carts only see the flat (free) pickup options.
  // Without this, a kit cart would see both the free "Retiro por sucursal" and
  // the kit-priced one simultaneously.
  const _pickupMethods = availableShippingMethods?.filter(
    (sm) =>
      isPickupOption(sm) &&
      !isDropzone(sm) &&
      !isCdeShippingOption(sm) &&
      (hasKit ? isKitShippingOption(sm) : !isKitShippingOption(sm)),
  );

  const _cdeMethods = availableShippingMethods?.filter(
    (sm) => isCdeShippingOption(sm) && !isDropzone(sm) && hasKit,
  );

  // Las opciones de retiro en tienda son N copias del MISMO gesto comercial
  // —una por stock location—, así que renderizarlas todas dibujaba una lista de
  // radios homónimos ("Retiro en tienda" cinco veces en desdeelsur) entre los
  // que no hay forma de elegir. Se muestra uno solo: la sucursal se elige en la
  // lista de abajo y ESA elección fija la opción real (ver pickupOptionForStore).
  //
  // El representante es el que está seleccionado, si lo hay, para que el radio
  // siga marcado cuando la opción efectiva es la de otra sucursal.
  const _storePickupMethods =
    _pickupMethods?.filter((sm) => isStorePickupOption(sm)) ?? [];
  const _representativeStorePickup =
    _storePickupMethods.find((sm) => sm.id === shippingMethodId) ??
    _storePickupMethods.find((sm) => !sm.insufficient_inventory) ??
    _storePickupMethods[0];
  const _visiblePickupMethods = (_pickupMethods ?? []).filter(
    (sm) =>
      !isStorePickupOption(sm) || sm.id === _representativeStorePickup?.id,
  );

  const hasPickupOptions = !!_pickupMethods?.length;
  const hasCarrierPickupOptions =
    _pickupMethods?.some((method) => isCarrierPickupOption(method)) || false;
  const selectedShippingOption =
    availableShippingMethods?.find(
      (method) => method.id === shippingMethodId,
    ) || null;
  const isCarrierPickupSelected =
    selectedShippingOption !== null &&
    isCarrierPickupOption(selectedShippingOption);
  // El carrier de la opción de pickup seleccionada, para elegir qué badge de
  // marca mostrar en la lista de sucursales.
  const pickupCarrier = selectedShippingOption
    ? matchCarrier(selectedShippingOption.name, selectedShippingOption.provider_id)
    : null;
  const isStorePickupSelected =
    selectedShippingOption !== null &&
    isStorePickupOption(selectedShippingOption);
  const hasStorePickupOptions =
    _pickupMethods?.some((m) => isStorePickupOption(m)) || false;

  // Pickup elegido que no resuelve NI a carrier NI a tienda propia. Pasa cuando
  // la shipping option se creó a mano desde el Admin (que no expone `data`), así
  // que le falta el marker `data.pickup_kind: 'store'` y su nombre tampoco
  // matchea ningún carrier del CARRIER_REGISTRY. No hay lista de sucursales que
  // renderizar, por lo que `pickupComplete` falla cerrado y el paso quedaría
  // trabado EN SILENCIO — el aviso de más abajo es lo que lo hace visible.
  const isUnclassifiedPickupSelected =
    selectedShippingOption !== null &&
    isPickupOption(selectedShippingOption) &&
    !isCdeShippingOption(selectedShippingOption) &&
    !isCarrierPickupSelected &&
    !isStorePickupSelected;

  // El carrier activo para la búsqueda de sucursales: el de la opción de
  // pickup seleccionada o, si todavía no hay una elegida, el primer carrier
  // de pickup disponible en el cart. Con un solo carrier registrado esto
  // siempre resuelve a "andreani"; con dos, cada uno trae sus propias
  // sucursales sin tocar este componente.
  const activeCarrierId =
    pickupCarrier?.id ??
    _pickupMethods
      ?.map((m) => matchCarrier(m.name, m.provider_id)?.id)
      .find((id): id is string => !!id);

  // Carrier branches hook — auto-fetches when pickup mode is active
  const {
    branches: carrierBranches,
    isLoading: isLoadingBranches,
    error: branchesError,
    fetchBranches,
    // No service type → the route merges todas las redes de retiro del
    // carrier (para Andreani: Sucursal + HOP), así que "Retiro en sucursales"
    // lista todas.
  } = useCarrierBranches(
    activeCarrierId,
    deliveryMode?.mode === "branch" ? postalCode : undefined,
  );

  // CDE locations hook
  const {
    cdeLocations,
    isLoading: isLoadingCdeLocations,
    error: cdeLocationsError,
    fetchCdeLocations,
  } = useCdeLocations(deliveryMode?.mode === "cde");

  // Sucursales propias para retiro — se cargan cuando hay opción de retiro en
  // sucursal y el modo activo es pickup.
  const {
    locations: storeLocations,
    isLoading: isLoadingStores,
    error: storesError,
  } = useStorePickupLocations(
    deliveryMode?.mode === "branch" && hasStorePickupOptions,
  );
  const [showAllStores, setShowAllStores] = useState(false);
  const visibleStores = showAllStores
    ? storeLocations
    : storeLocations.slice(0, 4);
  const hiddenStoresCount = Math.max(0, storeLocations.length - 4);

  const shouldFetchCarrierBranches =
    deliveryMode?.mode === "branch" &&
    postalCode.length >= 4 &&
    (selectedShippingOption
      ? isCarrierPickupOption(selectedShippingOption)
      : hasCarrierPickupOptions);

  const userCoordinates = useMemo(() => getCartCoordinates(cart), [cart]);

  // Sort carrier branches by proximity to the user's shipping address.
  // Branches missing coordinates fall to the end preserving their original order.
  const [showAllBranches, setShowAllBranches] = useState(false);
  const sortedBranches = useMemo(() => {
    if (!userCoordinates) return carrierBranches;

    const withDistance = carrierBranches.map((b, idx) => {
      const dist =
        b.latitude != null && b.longitude != null
          ? haversineKm(
              userCoordinates.latitude,
              userCoordinates.longitude,
              b.latitude,
              b.longitude,
            )
          : Number.POSITIVE_INFINITY;
      return { b, dist, idx };
    });
    withDistance.sort((a, z) =>
      a.dist === z.dist ? a.idx - z.idx : a.dist - z.dist,
    );
    return withDistance.map((x) => x.b);
  }, [carrierBranches, userCoordinates]);

  const visibleBranches = showAllBranches
    ? sortedBranches
    : sortedBranches.slice(0, 4);
  const hiddenBranchesCount = Math.max(0, sortedBranches.length - 4);

  const [showAllCdeLocations, setShowAllCdeLocations] = useState(false);
  const sortedCdeLocations = useMemo(() => {
    if (!userCoordinates) return cdeLocations;

    const withDistance = cdeLocations.map((cde, idx) => {
      const dist =
        cde.latitude != null && cde.longitude != null
          ? haversineKm(
              userCoordinates.latitude,
              userCoordinates.longitude,
              cde.latitude,
              cde.longitude,
            )
          : Number.POSITIVE_INFINITY;
      return { cde, dist, idx };
    });
    withDistance.sort((a, z) =>
      a.dist === z.dist ? a.idx - z.idx : a.dist - z.dist,
    );
    return withDistance.map((x) => x.cde);
  }, [cdeLocations, userCoordinates]);

  const visibleCdeLocations = showAllCdeLocations
    ? sortedCdeLocations
    : sortedCdeLocations.slice(0, 4);
  const hiddenCdeLocationsCount = Math.max(0, sortedCdeLocations.length - 4);

  const getCdeDistanceLabel = useCallback(
    (cde: CdeLocation) => {
      if (
        !userCoordinates ||
        cde.latitude == null ||
        cde.longitude == null
      ) {
        return null;
      }

      return formatDistance(
        haversineKm(
          userCoordinates.latitude,
          userCoordinates.longitude,
          cde.latitude,
          cde.longitude,
        ),
      );
    },
    [userCoordinates],
  );

  // If user had a branch restored/selected that isn't in the first 4, auto-expand
  useEffect(() => {
    if (!selectedBranch || showAllBranches) return;
    const inFirstFour = sortedBranches
      .slice(0, 4)
      .some((b) => b.id === selectedBranch.id);
    if (
      !inFirstFour &&
      sortedBranches.some((b) => b.id === selectedBranch.id)
    ) {
      setShowAllBranches(true);
    }
  }, [selectedBranch, sortedBranches, showAllBranches]);

  useEffect(() => {
    if (!selectedCde || showAllCdeLocations) return;
    const inFirstFour = sortedCdeLocations
      .slice(0, 4)
      .some((cde) => cde.id === selectedCde.id);
    if (
      !inFirstFour &&
      sortedCdeLocations.some((cde) => cde.id === selectedCde.id)
    ) {
      setShowAllCdeLocations(true);
    }
  }, [selectedCde, sortedCdeLocations, showAllCdeLocations]);

  // Upgrade restored selectedBranch to full branch data once fetched
  useEffect(() => {
    if (
      selectedBranch &&
      carrierBranches.length > 0 &&
      !carrierBranches.find(
        (b) =>
          b.id === selectedBranch.id && b.address === selectedBranch.address,
      )
    ) {
      const fullBranch = carrierBranches.find(
        (b) => b.id === selectedBranch.id,
      );
      if (fullBranch) {
        setSelectedBranch(fullBranch);
      }
    }
  }, [carrierBranches, selectedBranch]);

  useEffect(() => {
    if (
      selectedCde &&
      cdeLocations.length > 0 &&
      !cdeLocations.find(
        (cde) =>
          cde.id === selectedCde.id && cde.street === selectedCde.street,
      )
    ) {
      const fullCde = cdeLocations.find((cde) => cde.id === selectedCde.id);
      if (fullCde) {
        setSelectedCde(fullCde);
      }
    }
  }, [cdeLocations, selectedCde]);

  // Resuelve el DeliveryMode de un shippingMethodId buscándolo en las listas
  // filtradas (cde → pickup → shipping, en ese orden — igual precedencia que
  // antes). Único punto usado tanto para inicializar deliveryMode desde un
  // método restaurado como para revertirlo si un setShippingMethod falla.
  const resolveDeliveryModeForId = useCallback(
    (id: string | null): DeliveryMode | null => {
      if (!id) return null;
      const cdeOption = _cdeMethods?.find((m) => m.id === id);
      if (cdeOption) return resolveDeliveryMode(cdeOption);
      const pickupOption = _pickupMethods?.find((m) => m.id === id);
      if (pickupOption) return resolveDeliveryMode(pickupOption);
      const shippingOption = _shippingMethods?.find((m) => m.id === id);
      if (shippingOption) return resolveDeliveryMode(shippingOption);
      return { mode: "home", carrier: null };
    },
    [_cdeMethods, _pickupMethods, _shippingMethods],
  );

  // Initialize delivery mode from previously selected method
  useEffect(() => {
    if (deliveryMode !== null) return;
    if (shippingMethodId) {
      setDeliveryMode(resolveDeliveryModeForId(shippingMethodId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMethodId, _pickupMethods?.length, _cdeMethods?.length]);

  // Auto-select first shipping method if none selected
  useEffect(() => {
    if (hasAutoSelected.current || disableAutoSelect) return;

    if (
      !shippingMethodId &&
      _shippingMethods &&
      _shippingMethods.length > 0 &&
      cart.id &&
      !isLoading
    ) {
      const firstAvailable =
        _shippingMethods.find(
          (sm) => !sm.insufficient_inventory && sm.price_type === "flat",
        ) || _shippingMethods[0];

      if (firstAvailable) {
        const mode = resolveDeliveryMode(firstAvailable);
        hasAutoSelected.current = true;
        isLoadingRef.current = true;
        setIsLoading(true);
        setShippingMethodId(firstAvailable.id);
        setDeliveryMode(mode);
        fetch("/api/store/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "setShippingMethod",
            shippingMethodId: firstAvailable.id,
            ...(mode.carrier ? { data: { carrier: mode.carrier } } : {}),
          }),
        })
          .then(async (res) => {
            const data = await res.json();
            await saveShippingMetadata({
              shipping_method: "domicilio",
              pickup_branch_id: "",
              pickup_branch_name: "",
            });
            return onCartUpdate?.(data.cart);
          })
          .catch((err: Error) => {
            console.error("Error auto-selecting shipping method:", err);
            setShippingMethodId(null);
            setDeliveryMode(null);
            hasAutoSelected.current = false;
          })
          .finally(() => {
            isLoadingRef.current = false;
            setIsLoading(false);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_shippingMethods?.length, cart.id, isLoading]);

  // Calculate prices for calculated-type shipping options (both shipping and pickup).
  // Pickup options used to be flat/free so their price was never computed here,
  // but kit carts introduce calculated pickup options (Retiro por sucursal with
  // kit_prices) whose amount comes from the provider/middleware and must be
  // read into calculatedPricesMap, otherwise the UI shows "-".
  useEffect(() => {
    setIsLoadingPrices(true);

    const calculableOptions = [
      ...(_shippingMethods ?? []),
      ...(_pickupMethods ?? []),
      ...(_cdeMethods ?? []),
    ];

    if (calculableOptions.length) {
      // Seed map with amounts already injected by the middleware in the list response
      const prefilledMap: Record<string, number> = {};
      calculableOptions.forEach((sm) => {
        if (sm.price_type === "calculated" && typeof sm.amount === "number") {
          prefilledMap[sm.id] = sm.amount;
        }
      });

      // Only call the calculate endpoint for options that have no amount yet
      const calculatedOptions = calculableOptions.filter(
        (sm) => sm.price_type === "calculated" && typeof sm.amount !== "number",
      );

      const promises = calculatedOptions.map((sm) =>
        calculatePriceForShippingOption(sm.id, cart.id),
      );

      if (promises.length) {
        Promise.allSettled(promises).then((res) => {
          const pricesMap: Record<string, number> = { ...prefilledMap };
          res.forEach((r) => {
            if (r.status === "fulfilled") {
              pricesMap[r.value?.id || ""] = r.value?.amount!;
            }
          });

          setCalculatedPricesMap(pricesMap);
          setIsLoadingPrices(false);
        });
      } else {
        setCalculatedPricesMap(prefilledMap);
        setIsLoadingPrices(false);
      }
    } else {
      setIsLoadingPrices(false);
    }
    // Recompute when the destination changes: Andreani calculated prices depend
    // on the cart's shipping postal code, so a new address must re-quote.
    // También cuando cambia la sucursal elegida — hoy ningún carrier cotiza
    // por sucursal, pero si el precio llegara a depender de ella (un carrier
    // futuro) esto asegura que se recotice en vez de quedar con el precio de
    // la sucursal anterior. selectedBranch?.id (no el objeto entero) para no
    // disparar un fetch extra cuando el "upgrade" de datos de sucursal
    // reemplaza la referencia sin cambiar el id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    availableShippingMethods,
    cart.id,
    cart.shipping_address?.postal_code,
    selectedBranch?.id,
  ]);

  // ── Handlers ──────────────────────────────────────────

  const handleSetShippingMethod = useCallback(
    async (
      id: string,
      mode: DeliveryMode,
      amount?: number,
      extraData?: Record<string, unknown>,
    ) => {
      // Prevent overlap with an in-flight auto-select or a prior user click.
      if (isLoadingRef.current) return;

      setError(null);

      let currentId: string | null = null;
      isLoadingRef.current = true;
      setIsLoading(true);
      setShippingMethodId((prev) => {
        currentId = prev;
        return id;
      });

      try {
        const body: Record<string, unknown> = {
          action: "setShippingMethod",
          shippingMethodId: id,
        };
        // El data del shipping method viaja al pedido y lo lee classify() en el
        // backend. `carrier` sale de mode.carrier (null para CDE/tienda propia).
        // Para "Retiro en sucursal" mandamos pickup_kind:'store' (el provider
        // manual no preserva el data sembrado en la opción).
        const mergedData = {
          ...(typeof amount === "number" ? { amount } : {}),
          ...(mode.carrier ? { carrier: mode.carrier } : {}),
          ...(extraData ?? {}),
        };
        if (Object.keys(mergedData).length > 0) {
          body.data = mergedData;
        }
        const response = await fetch("/api/store/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setShippingMethodId(currentId);
          // Revert deliveryMode to match the reverted shippingMethodId
          setDeliveryMode(resolveDeliveryModeForId(currentId));
          setError(result.message || "Error al seleccionar método de envío");
        } else {
          // Use result.cart which includes *items.variant.product.categories (via retrieveCart)
          // metaCart from updateCart lacks that expansion, so avoid using it as the primary cart
          if (mode.mode === "home") {
            await saveShippingMetadata({
              shipping_method: "domicilio",
              pickup_branch_id: "",
              pickup_branch_name: "",
              selected_cde_id: "",
              selected_cde_name: "",
              store_id: "",
              store_name: "",
            });
            setSelectedBranch(null);
            setSelectedCde(null);
            setSelectedStore(null);
          } else if (mode.mode === "cde") {
            await saveShippingMetadata({
              shipping_method: "retiro_cde",
              pickup_branch_id: "",
              pickup_branch_name: "",
              store_id: "",
              store_name: "",
            });
            setSelectedBranch(null);
            setSelectedStore(null);
          }
          await onCartUpdate?.(result.cart);
        }
      } catch (err: unknown) {
        setShippingMethodId(currentId);
        setDeliveryMode(resolveDeliveryModeForId(currentId));
        setError(
          err instanceof Error
            ? err.message
            : "Error al seleccionar método de envío",
        );
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    },
    [onCartUpdate, resolveDeliveryModeForId],
  );

  // Reenvía `data` para un shipping method YA seleccionado, sin pasar por el
  // flujo completo de handleSetShippingMethod (no toca isLoading/shippingMethodId
  // ni dispara su revert-on-error): se usa para refrescar branch_id cuando el
  // comprador cambia de sucursal dentro de la misma opción de pickup, algo que
  // antes solo viajaba por metadata del carrito y quedaba desactualizado.
  const resyncShippingMethodData = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      try {
        await fetch("/api/store/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setShippingMethod", shippingMethodId: id, data }),
        });
      } catch {
        // No bloqueante: si falla, pickup_branch_id sigue viajando por
        // metadata del carrito (mecanismo preexistente) y el checkout sigue.
      }
    },
    [],
  );

  const handleSelectCarrierBranch = useCallback(
    async (branch: CarrierBranch) => {
      setSelectedBranch(branch);
      setIsSavingMetadata(true);
      try {
        await saveShippingMetadata({
          shipping_method: "retiro_sucursal",
          pickup_branch_id: branch.id,
          pickup_branch_name: `${branch.description} - ${branch.address}, ${branch.city}`,
          // Persist the full address so label generation doesn't depend on a
          // live carrier lookup (which can 503/timeout). Read back by the
          // ticket-generation workflow from order metadata.
          pickup_branch_address: branch.address ?? "",
          pickup_branch_city: branch.city ?? "",
          pickup_branch_province: branch.province ?? "",
          pickup_branch_postal: branch.postalCode ?? "",
          // Limpiar selección de retiro en sucursal propia.
          store_id: "",
          store_name: "",
        });
        setSelectedStore(null);

        // If no pickup method selected yet, select the first one
        const currentPickupMethod = _pickupMethods?.find(
          (m) => m.id === shippingMethodId,
        );
        const targetMethod =
          currentPickupMethod ??
          _pickupMethods?.find((m) => !m.insufficient_inventory);

        if (targetMethod) {
          if (!currentPickupMethod) {
            handleSetShippingMethod(targetMethod.id, resolveDeliveryMode(targetMethod), undefined, {
              branch_id: branch.id,
              branch_code: branch.code,
            });
          } else {
            // Ya había un método de pickup seleccionado — solo cambió la
            // sucursal. Reenviamos `data` en silencio (sin loading state) para
            // que branch_id no quede desactualizado; antes esta rama solo
            // refetcheaba el cart y el id de sucursal vivía nada más que en
            // metadata.
            await resyncShippingMethodData(targetMethod.id, {
              carrier: resolveDeliveryMode(targetMethod).carrier,
              branch_id: branch.id,
              branch_code: branch.code,
            });
            await onCartUpdate?.();
          }
        } else {
          await onCartUpdate?.();
        }
      } finally {
        setIsSavingMetadata(false);
      }
    },
    [
      _pickupMethods,
      shippingMethodId,
      handleSetShippingMethod,
      resyncShippingMethodData,
      onCartUpdate,
    ],
  );

  const handleSelectStore = useCallback(
    async (store: StorePickupLocation) => {
      setSelectedStore(store);
      setIsSavingMetadata(true);
      try {
        await saveShippingMetadata({
          shipping_method: "retiro_store",
          store_id: store.id,
          store_name: store.name,
          store_address: store.address ?? "",
          store_city: store.city ?? "",
          // Limpiar selección de otros modos de retiro.
          pickup_branch_id: "",
          pickup_branch_name: "",
          selected_cde_id: "",
          selected_cde_name: "",
        });

        // La opción de retiro tiene que ser la de ESTA sucursal, no la que
        // hubiera quedado seleccionada. Antes esta rama sólo actuaba si no
        // había ningún pickup elegido, y tomaba la primera de la lista: la
        // sucursal real quedaba únicamente en la metadata del carrito y el
        // `shipping_option_id` de la orden —que es de donde el admin deduce la
        // ubicación de despacho— apuntaba siempre a la misma.
        const target = pickupOptionForStore(_pickupMethods, store);
        if (target && target.id !== shippingMethodId) {
          await handleSetShippingMethod(
            target.id,
            resolveDeliveryMode(target),
            undefined,
            { pickup_kind: "store" },
          );
        } else {
          await onCartUpdate?.();
        }
      } finally {
        setIsSavingMetadata(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_pickupMethods, shippingMethodId, handleSetShippingMethod, onCartUpdate],
  );

  const handleSelectCde = useCallback(
    async (cde: CdeLocation) => {
      setSelectedCde(cde);
      setIsSavingMetadata(true);
      try {
        await saveShippingMetadata({
          shipping_method: "retiro_cde",
          selected_cde_id: cde.id,
          selected_cde_name: cde.name,
          pickup_branch_id: "",
          pickup_branch_name: "",
        });

        const currentIsCde = _cdeMethods?.find(
          (m) => m.id === shippingMethodId,
        );
        if (!currentIsCde) {
          const first = _cdeMethods?.find((m) => !m.insufficient_inventory);
          if (first) {
            await handleSetShippingMethod(first.id, resolveDeliveryMode(first));
          }
        } else {
          // CDE method already set — refetch full cart so shipping_methods.name is included
          await onCartUpdate?.();
        }
      } finally {
        setIsSavingMetadata(false);
      }
    },
    [_cdeMethods, shippingMethodId, handleSetShippingMethod, onCartUpdate],
  );

  const handleSubmit = useCallback(() => {
    goToCheckoutStep(nextStep);
  }, [nextStep]);

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  // Force-fetch branches when step re-opens in pickup mode (component remounts)
  useEffect(() => {
    if (isOpen && shouldFetchCarrierBranches) {
      fetchBranches(postalCode);
    }
    if (isOpen && deliveryMode?.mode === "cde") {
      fetchCdeLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, shouldFetchCarrierBranches, postalCode]);

  // La opción está rota a nivel DATOS, no a nivel usuario. Dejamos rastro en
  // consola para no tener que reproducir el checkout entero para diagnosticarlo.
  useEffect(() => {
    if (!isUnclassifiedPickupSelected || !selectedShippingOption) return;
    console.error(
      `[checkout] Shipping option de retiro sin clasificar: "${selectedShippingOption.name}" (${selectedShippingOption.id}). ` +
        "Le falta data.pickup_kind = 'store' o un carrier reconocido en CARRIER_REGISTRY. " +
        "Corregila con: medusa exec ./src/scripts/backfill-store-pickup-marker.ts",
    );
  }, [isUnclassifiedPickupSelected, selectedShippingOption]);

  // ── Validation ────────────────────────────────────────

  const isPickupMode = deliveryMode?.mode === "branch";
  const isShippingMode = deliveryMode?.mode === "home";
  const isCdeMode = deliveryMode?.mode === "cde";

  // For pickup mode: require shipping method, branch selected, AND branches loaded
  const pickupComplete =
    isPickupMode &&
    !!shippingMethodId &&
    (isCarrierPickupSelected
      ? selectedBranch !== null && carrierBranches.length > 0
      : isStorePickupSelected
        ? selectedStore !== null
        // Pickup sin clasificar: falla CERRADO, no abierto. Antes este `true`
        // dejaba pasar cualquier pickup sin sucursal elegida. Se mantiene
        // cerrado, pero ahora `isUnclassifiedPickupSelected` renderiza el
        // aviso que explica por qué el botón no habilita.
        : false);

  // For shipping mode: require a shipping method selected AND que esa opción
  // siga estando en la lista vigente. `selectedShippingOption` ya vuelve
  // `null` cuando `shippingMethodId` no matchea ningún id de
  // `availableShippingMethods` — pasa después de un refetch por cambio de
  // dirección si el gate de cobertura sacó la flota propia. Sin este chequeo
  // el botón "Continuar" quedaba habilitado con una selección fantasma (pickup
  // y cde ya estaban a salvo de esto porque derivan de selectedShippingOption
  // indirectamente vía isCarrierPickupSelected/isStorePickupSelected).
  const shippingComplete =
    isShippingMode && !!shippingMethodId && selectedShippingOption !== null;

  // For CDE mode: require shipping method AND a CDE selected
  const cdeComplete = isCdeMode && !!shippingMethodId && selectedCde !== null;

  // Cannot continue unless a delivery mode is selected AND that mode is fully configured
  const canContinue =
    !isLoading &&
    !isSavingMetadata &&
    deliveryMode !== null &&
    (shippingComplete || pickupComplete || cdeComplete);

  // Quedó seleccionado un envío a domicilio que el refetch ya no trae en la
  // lista (ver comentario de shippingComplete). El radio no se ve tildado —
  // ninguna opción matchea shippingMethodId — pero sin este aviso no queda
  // claro POR QUÉ "Continuar" está deshabilitado.
  const hasStaleShippingSelection =
    isShippingMode &&
    !!shippingMethodId &&
    selectedShippingOption === null &&
    !refreshingOptions &&
    !!availableShippingMethods?.length;

  // ── Render ────────────────────────────────────────────

  if (!isOpen) {
    return null;
  }

  // El padre está recalculando /shipping-options contra la dirección nueva.
  // `availableShippingMethods` puede seguir siendo la lista vieja acá adentro
  // (el padre no la limpia mientras espera la respuesta) — pintarla sería
  // mostrar como válidas opciones que quizás ya no correspondan (ej. flota
  // propia que salió de cobertura). Se corta el render acá, antes de tocar
  // ninguno de los datos derivados de la lista.
  if (refreshingOptions) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-6 text-gray-500 text-sm"
        data-testid="shipping-options-refreshing"
      >
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
        Recalculando opciones de envío para tu dirección...
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg bg-white">
        <div data-testid="delivery-options-container">
          {!availableShippingMethods ||
          availableShippingMethods.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <Text className="txt-medium mb-2 text-ui-fg-base">
                Método de envío estándar
              </Text>
              <Text className="txt-medium text-ui-fg-muted">
                Se aplicará el método de envío estándar. El costo se calculará
                al finalizar la compra.
              </Text>
            </div>
          ) : (
            <RadioGroup
              disabled={isLoading}
              onChange={(v) => {
                if (!v || typeof v !== "string") {
                  return;
                }

                const cdeOption = _cdeMethods?.find((m) => m.id === v);
                const pickupMethod = _pickupMethods?.find((m) => m.id === v);
                const shippingOption = _shippingMethods?.find((m) => m.id === v);
                const optAmount = calculatedPricesMap[v];

                if (cdeOption) {
                  const mode = resolveDeliveryMode(cdeOption);
                  setDeliveryMode(mode);
                  setSelectedBranch(null);
                  fetchCdeLocations();
                  handleSetShippingMethod(v, mode, optAmount);
                  return;
                }

                if (pickupMethod) {
                  const mode = resolveDeliveryMode(pickupMethod);
                  setDeliveryMode(mode);
                  setSelectedCde(null);

                  if (isCarrierPickupOption(pickupMethod) && postalCode) {
                    fetchBranches(postalCode);
                  }

                  const isStorePickup = isStorePickupOption(pickupMethod);
                  // El radio de "retiro en tienda" es el representante de N
                  // opciones homónimas: si ya hay sucursal elegida, la que vale
                  // es la de esa sucursal, no la que el radio lleva pegada.
                  const targetId = isStorePickup
                    ? (pickupOptionForStore(_pickupMethods, selectedStore)?.id ??
                      v)
                    : v;
                  handleSetShippingMethod(
                    targetId,
                    mode,
                    calculatedPricesMap[targetId] ?? optAmount,
                    isStorePickup ? { pickup_kind: "store" } : undefined,
                  );
                  return;
                }

                const mode: DeliveryMode = shippingOption
                  ? resolveDeliveryMode(shippingOption)
                  : { mode: "home", carrier: null };
                setDeliveryMode(mode);
                setSelectedBranch(null);
                setSelectedCde(null);
                handleSetShippingMethod(v, mode, optAmount);
              }}
              value={shippingMethodId || ""}
            >
              {[
                ...(_shippingMethods || []),
                ..._visiblePickupMethods,
                ...(_cdeMethods || []),
              ].map((option) => {
                const isDisabled =
                  option.price_type === "calculated" &&
                  !isLoadingPrices &&
                  typeof calculatedPricesMap[option.id] !== "number";

                return (() => {
                  const isSelected = option.id === shippingMethodId;
                  const isPickupOpt = isPickupOption(option);
                  const isCdeOpt = isCdeShippingOption(option);
                  const IconComp =
                    isPickupOpt || isCdeOpt ? ArchiveBoxIcon : TruckIcon;

                  const priceLabel = (() => {
                    const formatShippingAmount = (amount: number) =>
                      amount === 0
                        ? "Gratuito"
                        : `$ ${convertToLocale({
                            amount,
                            currency_code: cart?.currency_code,
                          })}`;

                    if (option.price_type === "flat") {
                      return formatShippingAmount(option.amount ?? 0);
                    }
                    if (typeof calculatedPricesMap[option.id] === "number") {
                      return formatShippingAmount(
                        calculatedPricesMap[option.id],
                      );
                    }
                    return isLoadingPrices ? "..." : "-";
                  })();

                  const optionCarrier = matchCarrier(
                    option.name,
                    option.provider_id,
                  );
                  const optionLabel =
                    sanitizeShippingLabel(option.name) || option.name;
                  const subtitle = priceLabel;

                  return (
                    <Radio
                      className={clx(
                        "mb-2 flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-4 transition-all",
                        {
                          "border-[--primary-color] bg-[--shipping-option-bg]":
                            isSelected,
                          "border-gray-200 bg-white hover:border-gray-300":
                            !isSelected && !isDisabled,
                          "cursor-not-allowed opacity-60": isDisabled,
                          "cursor-not-allowed opacity-80":
                            isLoading && !isDisabled,
                        },
                      )}
                      data-testid="delivery-option-radio"
                      disabled={isDisabled}
                      key={option.id}
                      value={option.id}
                    >
                      <div
                        className={clx(
                          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                          {
                            "bg-[--primary-color]": isSelected,
                            "border border-gray-200 bg-white": !isSelected,
                          },
                        )}
                      >
                        <IconComp
                          className={clx("h-6 w-6", {
                            "text-white": isSelected,
                            "text-gray-400": !isSelected,
                          })}
                        />
                      </div>

                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[--primary-color] text-sm">
                            {optionLabel}
                          </span>
                          {optionCarrier && (
                            <ShippingProviderBadge carrier={optionCarrier} />
                          )}
                          {/* Retiro en sucursales incluye las sub-redes del
                              carrier (ej. los puntos HOP de Andreani) →
                              mostrar también su badge en la opción de pickup. */}
                          {optionCarrier &&
                            isPickupOpt &&
                            Object.keys(optionCarrier.networkBadges ?? {}).map(
                              (networkId) => (
                                <ShippingProviderBadge
                                  carrier={optionCarrier}
                                  key={networkId}
                                  network={networkId}
                                />
                              ),
                            )}
                        </div>
                        <span className="text-gray-500 text-sm">
                          {subtitle}
                        </span>
                      </div>

                      <div
                        className={clx(
                          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full",
                          {
                            "bg-[--primary-color]": isSelected,
                            "border-2 border-gray-300": !isSelected,
                          },
                        )}
                      >
                        {isSelected && (
                          <CheckIcon className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </Radio>
                  );
                })();
              })}
            </RadioGroup>
          )}

          {/* Fuera de cobertura: el backend ya filtró "Envío Estándar" de la
              lista — acá solo avisamos, no volvemos a filtrar nada. */}
          {hasNoCoverage && (
            <div
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm"
              data-testid="no-coverage-warning"
            >
              <p className="font-medium">
                No realizamos envíos a esta ubicación
              </p>
              <p className="mt-1">
                Tu dirección está fuera de nuestras zonas de cobertura. Elegí{" "}
                <strong>Retiro en tienda</strong> para continuar con tu
                compra.
              </p>
            </div>
          )}

          {/* El envío a domicilio que tenía elegido salió de la lista tras un
              refetch (ver comentario de shippingComplete/hasStaleShippingSelection
              más arriba) — acá se explica por qué ningún radio quedó tildado. */}
          {hasStaleShippingSelection && (
            <div
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm"
              data-testid="stale-shipping-selection-warning"
            >
              <p className="font-medium">
                Tu método de envío ya no está disponible
              </p>
              <p className="mt-1">
                Cambió algo en tu dirección y esa opción dejó de aplicar.
                Elegí de nuevo un método de envío para continuar.
              </p>
            </div>
          )}
        </div>

        {/* ──── Pickup: branch selection (when retiro por sucursal is chosen) ──── */}
        {isPickupMode && isCarrierPickupSelected && pickupCarrier && (
          <div className="mt-2 pt-4">
            <div className="mb-3 flex flex-col">
              <span className="txt-medium font-medium text-ui-fg-base">
                Sucursales cercanas a CP {postalCode}
              </span>
              <span className="txt-medium text-ui-fg-muted">
                Elegí dónde retirar tu pedido
              </span>
            </div>

            {/* Loading state */}
            {isLoadingBranches && (
              <div className="flex items-center gap-2 py-6 text-gray-500 text-sm">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Buscando sucursales...
              </div>
            )}

            {/* Branches error */}
            {branchesError && !isLoadingBranches && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
                {branchesError}
              </div>
            )}

            {/* Carrier branches from API */}
            {!isLoadingBranches && carrierBranches.length > 0 && (
              <div className="mb-3 flex flex-col gap-2 pr-1">
                {visibleBranches.map((branch) => {
                  const isSelected = selectedBranch?.id === branch.id;
                  const branchLabel =
                    sanitizeShippingLabel(branch.description) ||
                    branch.description;
                  return (
                    <button
                      className={clx(
                        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                        {
                          "border-[--primary-color] bg-[--shipping-option-bg]":
                            isSelected,
                          "border-gray-200 hover:border-gray-300 hover:shadow-sm":
                            !isSelected,
                        },
                      )}
                      data-testid="delivery-branch-row"
                      key={branch.id}
                      onClick={() => handleSelectCarrierBranch(branch)}
                      type="button"
                    >
                      <div className="pt-0.5">
                        <div
                          className={clx(
                            "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                            {
                              "border-[--primary-color] bg-[--primary-color]":
                                isSelected,
                              "border-gray-300 bg-white": !isSelected,
                            },
                          )}
                        >
                          {isSelected && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {branchLabel}
                          </span>
                          <ShippingProviderBadge
                            carrier={pickupCarrier}
                            network={
                              pickupCarrier.networkBadges?.[branch.network]
                                ? branch.network
                                : undefined
                            }
                          />
                        </div>
                        <p className="mt-0.5 text-gray-600 text-xs">
                          {branch.address}
                          {branch.city ? `, ${branch.city}` : ""}
                        </p>
                        {branch.businessHours && (
                          <p className="mt-0.5 text-gray-400 text-xs">
                            {branch.businessHours}
                          </p>
                        )}
                      </div>
                      <MapPinIcon className="h-4 w-4 flex-shrink-0 self-center text-gray-400" />
                    </button>
                  );
                })}

                {hiddenBranchesCount > 0 && (
                  <button
                    className="mt-1 self-center rounded-full border border-gray-200 px-4 py-1.5 font-medium text-[--primary-color] text-xs hover:bg-gray-50"
                    onClick={() => setShowAllBranches((v) => !v)}
                    type="button"
                  >
                    {showAllBranches
                      ? "Ver menos"
                      : `Ver ${hiddenBranchesCount} sucursal${hiddenBranchesCount === 1 ? "" : "es"} más`}
                  </button>
                )}
              </div>
            )}

            {/* No branches found */}
            {!isLoadingBranches && carrierBranches.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm">
                <p className="font-medium">No hay sucursales disponibles</p>
                <p className="mt-1">
                  No se encontraron sucursales de retiro para el código postal{" "}
                  <strong>{postalCode}</strong>. Seleccioná{" "}
                  <strong>Envío a domicilio</strong> para continuar.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ──── Pickup: store selection (retiro en sucursal propia) ──── */}
        {isPickupMode && isStorePickupSelected && (
          <div className="mt-2 pt-4">
            <div className="mb-3 flex flex-col">
              <span className="txt-medium font-medium text-ui-fg-base">
                Elegí la sucursal donde retirás tu pedido
              </span>
              <span className="txt-medium text-ui-fg-muted">
                Vas a retirar tu pedido en la sucursal seleccionada
              </span>
            </div>

            {isLoadingStores && (
              <div className="flex items-center gap-2 py-6 text-gray-500 text-sm">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Cargando sucursales...
              </div>
            )}

            {storesError && !isLoadingStores && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
                {storesError}
              </div>
            )}

            {!isLoadingStores && storeLocations.length > 0 && (
              <div className="mb-3 flex flex-col gap-2 pr-1">
                {visibleStores.map((store) => {
                  const isSelected = selectedStore?.id === store.id;
                  const addressParts = [store.address, store.city, store.province]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <button
                      className={clx(
                        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                        {
                          "border-[--primary-color] bg-[--shipping-option-bg]":
                            isSelected,
                          "border-gray-200 hover:border-gray-300 hover:shadow-sm":
                            !isSelected,
                        },
                      )}
                      data-testid="delivery-store-row"
                      key={store.id}
                      onClick={() => handleSelectStore(store)}
                      type="button"
                    >
                      <div className="pt-0.5">
                        <div
                          className={clx(
                            "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                            {
                              "border-[--primary-color] bg-[--primary-color]":
                                isSelected,
                              "border-gray-300 bg-white": !isSelected,
                            },
                          )}
                        >
                          {isSelected && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 text-sm">
                          {store.name}
                        </span>
                        {addressParts && (
                          <p className="mt-0.5 text-gray-600 text-xs">
                            {addressParts}
                          </p>
                        )}
                      </div>
                      <MapPinIcon className="h-4 w-4 flex-shrink-0 self-center text-gray-400" />
                    </button>
                  );
                })}

                {hiddenStoresCount > 0 && (
                  <button
                    className="mt-1 self-center rounded-full border border-gray-200 px-4 py-1.5 font-medium text-[--primary-color] text-xs hover:bg-gray-50"
                    onClick={() => setShowAllStores((v) => !v)}
                    type="button"
                  >
                    {showAllStores
                      ? "Ver menos"
                      : `Ver ${hiddenStoresCount} sucursal${hiddenStoresCount === 1 ? "" : "es"} más`}
                  </button>
                )}
              </div>
            )}

            {!isLoadingStores && storeLocations.length === 0 && !storesError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm">
                <p className="font-medium">No hay sucursales disponibles</p>
                <p className="mt-1">
                  No hay sucursales habilitadas para retiro. Seleccioná otro
                  método de envío para continuar.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ──── Pickup sin clasificar: shipping option mal configurada ──── */}
        {/* Sin este bloque el usuario ve un "Continuar" gris y ningún motivo:
            los dos hints de "Seleccioná una sucursal" cuelgan de
            isCarrierPickupSelected / isStorePickupSelected, ambos false acá. */}
        {isPickupMode && isUnclassifiedPickupSelected && (
          <div className="mt-2 pt-4">
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm"
              data-testid="unclassified-pickup-warning"
            >
              <p className="font-medium">
                Esta opción de retiro no está disponible
              </p>
              <p className="mt-1">
                No pudimos cargar los puntos de retiro para{" "}
                <strong>
                  {sanitizeShippingLabel(selectedShippingOption?.name) ||
                    "esta opción"}
                </strong>
                . Elegí otro método de envío para continuar.
              </p>
            </div>
          </div>
        )}

        {/* ──── CDE: distribution center selection ──── */}
        {isCdeMode && (
          <div className="mt-2 pt-4">
            <div className="mb-3 flex flex-col">
              <span className="txt-medium font-medium text-ui-fg-base">
                {userCoordinates
                  ? "Centros de distribución cercanos a tu dirección"
                  : "Elegí el centro donde retirarás tu pedido"}
              </span>
              <span className="txt-medium text-ui-fg-muted">
                {userCoordinates
                  ? "Ordenados por cercanía según la dirección cargada"
                  : "Mostramos primero los centros disponibles para retirar"}
              </span>
            </div>

            {isLoadingCdeLocations && (
              <div className="flex items-center gap-2 py-6 text-gray-500 text-sm">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Cargando centros de distribución...
              </div>
            )}

            {cdeLocationsError && !isLoadingCdeLocations && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-700 text-sm">
                {cdeLocationsError}
              </div>
            )}

            {!isLoadingCdeLocations && cdeLocations.length > 0 && (
              <div className="mb-3 flex flex-col gap-2 pr-1">
                {visibleCdeLocations.map((cde) => {
                  const isSelected = selectedCde?.id === cde.id;
                  const addressParts = [cde.street, cde.city, cde.province]
                    .filter(Boolean)
                    .join(", ");
                  const distanceLabel = getCdeDistanceLabel(cde);
                  return (
                    <button
                      className={clx(
                        "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                        {
                          "border-[--primary-color] bg-[--shipping-option-bg]":
                            isSelected,
                          "border-gray-200 hover:border-gray-300 hover:shadow-sm":
                            !isSelected,
                        },
                      )}
                      key={cde.id}
                      onClick={() => handleSelectCde(cde)}
                      type="button"
                    >
                      <div className="pt-0.5">
                        <div
                          className={clx(
                            "flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors",
                            {
                              "border-[--primary-color] bg-[--primary-color]":
                                isSelected,
                              "border-gray-300 bg-white": !isSelected,
                            },
                          )}
                        >
                          {isSelected && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium text-gray-900 text-sm">
                            {cde.name}
                          </span>
                          {distanceLabel && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 text-[11px]">
                              {distanceLabel}
                            </span>
                          )}
                        </div>
                        {addressParts && (
                          <p className="mt-0.5 text-gray-600 text-xs">
                            {addressParts}
                          </p>
                        )}
                        {cde.business_hours_summary && (
                          <p className="mt-0.5 text-gray-500 text-xs">
                            {cde.business_hours_summary}
                          </p>
                        )}
                        {isSelected && cde.phone && (
                          <p className="mt-0.5 text-gray-400 text-xs">
                            Tel: {cde.phone}
                          </p>
                        )}
                      </div>
                      <MapPinIcon className="h-4 w-4 flex-shrink-0 self-center text-gray-400" />
                    </button>
                  );
                })}

                {hiddenCdeLocationsCount > 0 && (
                  <button
                    className="mt-1 self-center rounded-full border border-gray-200 px-4 py-1.5 font-medium text-[--primary-color] text-xs hover:bg-gray-50"
                    onClick={() => setShowAllCdeLocations((v) => !v)}
                    type="button"
                  >
                    {showAllCdeLocations
                      ? "Ver menos"
                      : `Ver ${hiddenCdeLocationsCount} centro${hiddenCdeLocationsCount === 1 ? "" : "s"} más`}
                  </button>
                )}
              </div>
            )}

            {!isLoadingCdeLocations &&
              cdeLocations.length === 0 &&
              !cdeLocationsError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm">
                  <p className="font-medium">No hay centros disponibles</p>
                  <p className="mt-1">
                    No hay centros de distribución habilitados en este momento.
                    Seleccioná otro método de envío para continuar.
                  </p>
                </div>
              )}
          </div>
        )}

        {/* ──── Error & Submit ──── */}
        <div>
          <ErrorMessage
            data-testid="delivery-option-error-message"
            error={error}
          />

          {!deliveryMode && (
            <p className="mt-3 text-amber-600 text-sm">
              Seleccioná un método de envío para continuar
            </p>
          )}

          {isPickupMode &&
            isCarrierPickupSelected &&
            !pickupComplete &&
            !isLoadingBranches &&
            carrierBranches.length > 0 && (
              <p className="mt-3 text-amber-600 text-sm">
                Seleccioná una sucursal para continuar
              </p>
            )}

          {isPickupMode &&
            isStorePickupSelected &&
            !pickupComplete &&
            !isLoadingStores &&
            storeLocations.length > 0 && (
              <p className="mt-3 text-amber-600 text-sm">
                Seleccioná una sucursal para continuar
              </p>
            )}

          {isCdeMode &&
            !cdeComplete &&
            !isLoadingCdeLocations &&
            cdeLocations.length > 0 && (
              <p className="mt-3 text-amber-600 text-sm">
                Por favor, seleccioná el centro de distribución donde retirás tu
                pedido.
              </p>
            )}

          <button
            className="mt-6 w-full rounded-lg bg-[--primary-color] px-4 py-3 font-medium text-base text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="submit-delivery-option-button"
            disabled={!canContinue}
            onClick={handleSubmit}
            type="button"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                Procesando...
              </span>
            ) : (
              "Continuar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Shipping;
