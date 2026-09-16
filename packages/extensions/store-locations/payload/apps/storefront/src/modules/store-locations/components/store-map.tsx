"use client";

import type {
  StoreLocatorCategory,
  StoreLocatorLocation,
} from "@lib/types/store-locator";
import { branchTypeLabel, branchTypeStyle } from "@lib/util/branch-types";
import { handleImageError } from "@lib/util/placeholder-image";
import { GoogleMap, InfoWindow, Marker } from "@react-google-maps/api";
import { Clock, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type StoreMapProps = {
  stores: StoreLocatorLocation[];
  selectedStoreId: string | null;
  onStoreSelect: (storeId: string | null) => void;
  searchLocation?: google.maps.LatLngLiteral | null;
  isLoaded: boolean;
  hasApiKey: boolean;
  onLocateMe?: () => void;
  /** Los tipos que configuró la tienda: de acá salen el color del pin y la etiqueta. */
  types: StoreLocatorCategory[];
};

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: -34.6037,
  lng: -58.3816,
};

/** Verde histórico del pin, sólo como red por si no hay --primary-color. */
const FALLBACK_PIN = "#059669";

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  fullscreenControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  zoomControl: true,
};

export default function StoreMap({
  stores,
  selectedStoreId,
  onStoreSelect,
  searchLocation,
  isLoaded,
  hasApiKey,
  onLocateMe,
  types,
}: StoreMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Resolve the active tenant primary (set inline on <html>) so markers of the
  // "primary" palette color follow demo branding instead of a hardcoded green.
  // Google Maps needs a concrete color string, so we read the computed CSS var
  // at runtime.
  const primaryColor = useMemo(() => {
    if (typeof window === "undefined") return FALLBACK_PIN;
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary-color")
      .trim();
    return v || FALLBACK_PIN;
  }, []);
  /**
   * El color del pin sale del tipo configurado. El token `primary` no tiene hex
   * propio (`pin: null`): usa el color de la tienda, que es lo que hacía "Punto
   * de venta" antes de que los tipos fueran configurables.
   */
  const colorForType = (type: StoreLocatorLocation["type"]): string =>
    branchTypeStyle(types, type).pin ?? primaryColor;

  const storesWithCoords = useMemo(
    () =>
      stores.filter(
        (store) => store.lat !== null && store.lng !== null
      ) as Array<StoreLocatorLocation & { lat: number; lng: number }>,
    [stores]
  );

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  useEffect(() => {
    if (!map || !selectedStoreId) {
      return;
    }

    const selectedStore = storesWithCoords.find(
      (store) => store.id === selectedStoreId
    );
    if (selectedStore) {
      map.panTo({ lat: selectedStore.lat, lng: selectedStore.lng });
      map.setZoom(15);
    }
  }, [map, selectedStoreId, storesWithCoords]);

  useEffect(() => {
    if (!map || !searchLocation) {
      return;
    }

    if (storesWithCoords.length === 0) {
      map.panTo(searchLocation);
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(searchLocation);
    storesWithCoords.forEach((store) => {
      bounds.extend({ lat: store.lat, lng: store.lng });
    });
    map.fitBounds(bounds, 80);
  }, [map, searchLocation, storesWithCoords]);

  useEffect(() => {
    if (
      !map ||
      storesWithCoords.length === 0 ||
      selectedStoreId ||
      searchLocation
    ) {
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    storesWithCoords.forEach((store) => {
      bounds.extend({ lat: store.lat, lng: store.lng });
    });
    map.fitBounds(bounds);
  }, [map, storesWithCoords, selectedStoreId, searchLocation]);

  if (!hasApiKey) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-gray-100 p-6 text-center">
        <div>
          <MapPin className="mx-auto h-10 w-10 text-[--primary-color]" />
          <p className="mt-3 font-semibold text-gray-900">Mapa no disponible</p>
          <p className="mt-1 text-gray-500 text-sm">
            Configura GOOGLE_MAPS_API_KEY para activar el mapa interactivo.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center bg-gray-50">
        <div className="w-full max-w-md space-y-4 p-6">
          <div className="animate-pulse space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-gray-200" />
            <div className="mx-auto h-4 w-48 rounded bg-gray-200" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-gray-200" />
              <div className="h-3 w-3/4 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedStore = selectedStoreId
    ? storesWithCoords.find((store) => store.id === selectedStoreId)
    : null;
  // Primera imagen no vacía (el admin deja huecos al borrar una de las 3).
  const selectedImage = (selectedStore?.images ?? []).find((url) =>
    Boolean(url?.trim())
  );

  return (
    <div className="relative h-full w-full">
      {onLocateMe && (
        <button
          className="absolute top-3 left-3 z-10 rounded-full bg-white px-4 py-2 font-medium text-gray-900 text-sm shadow-md ring-1 ring-black/5 hover:bg-gray-50"
          onClick={onLocateMe}
          type="button"
        >
          Localizarme
        </button>
      )}

      <GoogleMap
        center={defaultCenter}
        mapContainerStyle={mapContainerStyle}
        onClick={() => onStoreSelect(null)}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
        zoom={12}
      >
        {storesWithCoords.map((store) => {
          const isSelected = store.id === selectedStoreId;
          const color = colorForType(store.type);

          return (
            <Marker
              icon={{
                fillColor: color,
                fillOpacity: 1,
                path: google.maps.SymbolPath.CIRCLE,
                scale: isSelected ? 10 : 8,
                strokeColor: "#FFFFFF",
                strokeWeight: 3,
              }}
              key={store.id}
              onClick={() => onStoreSelect(store.id)}
              position={{ lat: store.lat, lng: store.lng }}
              title={store.name}
              zIndex={isSelected ? 1000 : 1}
            />
          );
        })}

        {selectedStore && (
          <InfoWindow
            onCloseClick={() => onStoreSelect(null)}
            options={
              {
                headerDisabled: true,
                pixelOffset: new google.maps.Size(0, -12),
              } as google.maps.InfoWindowOptions & { headerDisabled: boolean }
            }
            position={{ lat: selectedStore.lat, lng: selectedStore.lng }}
          >
            <div className="min-w-[260px] max-w-[340px] p-1">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `${colorForType(selectedStore.type)}1A`,
                    color: colorForType(selectedStore.type),
                  }}
                >
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex flex-wrap items-start gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {selectedStore.name}
                      </h3>
                      {branchTypeLabel(types, selectedStore.type) && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-[11px] text-gray-600">
                          {branchTypeLabel(types, selectedStore.type)}
                        </span>
                      )}
                    </div>
                    <button
                      aria-label="Cerrar"
                      className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                      onClick={() => onStoreSelect(null)}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {/* `address` ya viene armado como calle, ciudad, provincia
                      (toLocatorLocation), así que agregar ciudad/provincia acá
                      las repetía. */}
                  <p className="mt-1 text-gray-500 text-xs">
                    {selectedStore.address}
                  </p>
                  {selectedStore.businessHoursSummary && (
                    <div className="mt-2 flex items-start gap-1.5 text-gray-500 text-xs">
                      <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{selectedStore.businessHoursSummary}</span>
                    </div>
                  )}
                </div>
              </div>
              {selectedImage && (
                <img
                  alt={selectedStore.name}
                  className="mt-3 aspect-[16/9] w-full rounded-lg object-cover"
                  loading="lazy"
                  onError={handleImageError}
                  src={selectedImage}
                />
              )}
            </div>
          </InfoWindow>
        )}

        {searchLocation && (
          <Marker
            icon={{
              fillColor: "#EF4444",
              fillOpacity: 1,
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              strokeColor: "#FFFFFF",
              strokeWeight: 3,
            }}
            position={searchLocation}
            title="Mi ubicación"
            zIndex={999}
          />
        )}
      </GoogleMap>
    </div>
  );
}
