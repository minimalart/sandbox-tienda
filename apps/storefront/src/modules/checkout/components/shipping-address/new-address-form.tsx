"use client";

import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import type { HttpTypes } from "@medusajs/types";
import FormInput from "@modules/common/components/form-input";
import ResponsiveCombobox from "@modules/common/components/responsive-combobox";
import { useCallback, useEffect, useRef, useState } from "react";

const IC =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]";

const LIBRARIES: ("places" | "marker")[] = ["places", "marker"];
const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const DEBOUNCE_MS = 600;
const MIN_QUERY_LENGTH = 3;

type ParsedAddress = {
  address1: string;
  city: string;
  province: string;
  postalCode: string;
};

function parsePlaceComponents(
  components: google.maps.GeocoderAddressComponent[],
  fallbackAddress?: string,
): ParsedAddress {
  let streetNumber = "";
  let route = "";
  let locality = "";
  let adminArea = "";
  let postal = "";

  for (const comp of components) {
    const t = comp.types[0];
    switch (t) {
      case "street_number":
        streetNumber = comp.long_name;
        break;
      case "route":
        route = comp.long_name;
        break;
      case "locality":
        locality = comp.long_name;
        break;
      case "administrative_area_level_1":
        adminArea = comp.long_name;
        break;
      case "postal_code":
        postal = comp.long_name;
        break;
      default:
        break;
    }
  }

  const addr = route
    ? `${route} ${streetNumber}`.trim()
    : (fallbackAddress ?? "");

  return {
    address1: addr,
    city: locality,
    province: adminArea,
    postalCode: postal,
  };
}

type ShippingAddressNewFormProps = {
  googleMapsApiKey: string;
  formData: Record<string, string>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  region?: HttpTypes.StoreRegion | null | undefined;
};

/**
 * Dispatcher: only mounts the Maps script loader when an API key is configured.
 * Without a key the plain form renders and no Google script is injected.
 */
export default function ShippingAddressNewForm(props: ShippingAddressNewFormProps) {
  if (!props.googleMapsApiKey?.trim()) {
    return <ShippingAddressNewFormImpl {...props} isLoaded={false} />;
  }
  return <ShippingAddressNewFormWithLoader {...props} />;
}

function ShippingAddressNewFormWithLoader(props: ShippingAddressNewFormProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: props.googleMapsApiKey,
    libraries: LIBRARIES,
  });
  return <ShippingAddressNewFormImpl {...props} isLoaded={isLoaded} />;
}

function ShippingAddressNewFormImpl({
  formData,
  setFormData,
  handleChange,
  region,
  isLoaded,
}: ShippingAddressNewFormProps & { isLoaded: boolean }) {

  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null,
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const lat = formData["shipping_address.latitude"]
    ? Number(formData["shipping_address.latitude"])
    : null;
  const lng = formData["shipping_address.longitude"]
    ? Number(formData["shipping_address.longitude"])
    : null;
  const countryOptions =
    region?.countries?.map((country) => ({
      value: country.iso_2 ?? "",
      label: country.display_name ?? country.iso_2 ?? "",
    })) ?? [{ value: "ar", label: "Argentina" }];

  const mapCenter = lat != null && lng != null ? { lat, lng } : DEFAULT_CENTER;

  const applyParsed = useCallback(
    (parsed: ParsedAddress, newLat?: number, newLng?: number) => {
      setFormData((prev) => ({
        ...prev,
        "shipping_address.address_1": parsed.address1,
        ...(parsed.city ? { "shipping_address.city": parsed.city } : {}),
        ...(parsed.province
          ? { "shipping_address.province": parsed.province }
          : {}),
        ...(parsed.postalCode
          ? { "shipping_address.postal_code": parsed.postalCode }
          : {}),
        ...(newLat != null
          ? { "shipping_address.latitude": String(newLat) }
          : {}),
        ...(newLng != null
          ? { "shipping_address.longitude": String(newLng) }
          : {}),
      }));
    },
    [setFormData],
  );

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!isLoaded || query.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            {
              input: query,
              includedRegionCodes: ["ar"],
            },
          );
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [isLoaded],
  );

  const handleAddressSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions],
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      const pp = suggestion.placePrediction;
      if (!pp) return;
      const label = pp.mainText?.text ?? pp.text?.text ?? "";
      setSuggestions([]);
      setShowSuggestions(false);
      if (autocompleteInputRef.current) {
        autocompleteInputRef.current.value = label;
      }
      try {
        const place = pp.toPlace();
        await place.fetchFields({
          fields: ["addressComponents", "location", "formattedAddress"],
        });
        if (!place.location) return;
        const placeLat = place.location.lat();
        const placeLng = place.location.lng();
        const parsed = parsePlaceComponents(
          (place.addressComponents ?? []).map((c) => ({
            long_name: c.longText ?? "",
            short_name: c.shortText ?? "",
            types: c.types ?? [],
          })) as google.maps.GeocoderAddressComponent[],
          place.formattedAddress ?? undefined,
        );
        applyParsed(parsed, placeLat, placeLng);
        const displayAddr = parsed.address1 || label;
        if (autocompleteInputRef.current) {
          autocompleteInputRef.current.value = displayAddr;
        }
        mapRef.current?.panTo({ lat: placeLat, lng: placeLng });
        mapRef.current?.setZoom(16);
      } catch {
        // keep label as-is
      }
    },
    [applyParsed],
  );

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) {
        return;
      }
      const clickLat = e.latLng.lat();
      const clickLng = e.latLng.lng();

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat: clickLat, lng: clickLng } },
        (results, status) => {
          if (status !== "OK" || !results?.[0]) {
            return;
          }
          const parsed = parsePlaceComponents(
            results[0].address_components ?? [],
            results[0].formatted_address,
          );
          applyParsed(parsed, clickLat, clickLng);
          if (autocompleteInputRef.current) {
            autocompleteInputRef.current.value = parsed.address1;
          }
        },
      );
    },
    [applyParsed],
  );

  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const position = { lat, lng };
    if (markerRef.current) {
      markerRef.current.position = position;
    } else {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        gmpDraggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const pos = markerRef.current?.position;
        if (!pos) return;
        const latLng =
          pos instanceof google.maps.LatLng
            ? pos
            : new google.maps.LatLng(
                (pos as google.maps.LatLngLiteral).lat,
                (pos as google.maps.LatLngLiteral).lng,
              );
        handleMapClick({ latLng } as google.maps.MapMouseEvent);
      });
    }
  }, [lat, lng, handleMapClick]);

  return (
    <div className="space-y-4">
      {/* Google Maps address search */}
      <div>
        <div className="relative">
          <FormInput
            label="Buscá tu dirección"
            defaultValue={formData["shipping_address.address_1"]}
            id="shipping-address-autocomplete"
            onChange={handleAddressSearch}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Ej: Av. Corrientes 1234"
            ref={autocompleteInputRef}
            type="text"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li
                  key={s.placePrediction?.placeId}
                  className="cursor-pointer px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                  onMouseDown={() => handleSelectSuggestion(s)}
                >
                  <span className="font-medium">
                    {s.placePrediction?.mainText?.text}
                  </span>
                  <span className="ml-1 text-gray-500 text-xs">
                    {s.placePrediction?.secondaryText?.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {isLoaded && (
          <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
            <GoogleMap
              center={mapCenter}
              mapContainerStyle={{ width: "100%", height: "180px" }}
              onClick={handleMapClick}
              onLoad={handleMapLoad}
              zoom={lat != null ? 16 : 12}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: "greedy",
                mapId: "mercatto_map",
              }}
            />
          </div>
        )}
      </div>

      {/* Standard fields */}
      <div className="grid grid-cols-2 gap-3">
        <FormInput
          autoComplete="given-name"
          data-testid="shipping-first-name-input"
          id="s-first-name"
          label="Nombre"
          name="shipping_address.first_name"
          onChange={handleChange}
          placeholder="Ej: Juan"
          required
          type="text"
          value={formData["shipping_address.first_name"]}
        />
        <FormInput
          autoComplete="family-name"
          data-testid="shipping-last-name-input"
          id="s-last-name"
          label="Apellido"
          name="shipping_address.last_name"
          onChange={handleChange}
          placeholder="Ej: Pérez"
          required
          type="text"
          value={formData["shipping_address.last_name"]}
        />
        <FormInput
          autoComplete="address-line1"
          data-testid="shipping-address-input"
          id="s-addr1"
          label="Dirección"
          name="shipping_address.address_1"
          onChange={handleChange}
          placeholder="Ej: Av. Corrientes 1234"
          required
          type="text"
          value={formData["shipping_address.address_1"]}
        />
        <FormInput
          autoComplete="address-line2"
          data-testid="shipping-company-input"
          id="s-company"
          label="Depto / Piso"
          name="shipping_address.company"
          onChange={handleChange}
          placeholder="Ej: 3B"
          type="text"
          value={formData["shipping_address.company"]}
        />
        <FormInput
          autoComplete="postal-code"
          data-testid="shipping-postal-code-input"
          id="s-postal"
          label="Código postal"
          name="shipping_address.postal_code"
          onChange={handleChange}
          placeholder="Ej: 1414"
          required
          type="text"
          value={formData["shipping_address.postal_code"]}
        />
        <FormInput
          autoComplete="address-level2"
          data-testid="shipping-city-input"
          id="s-city"
          label="Ciudad"
          name="shipping_address.city"
          onChange={handleChange}
          placeholder="Ej: Buenos Aires"
          required
          type="text"
          value={formData["shipping_address.city"]}
        />
        <FormInput
          autoComplete="address-level1"
          data-testid="shipping-province-input"
          id="s-province"
          label="Provincia"
          name="shipping_address.province"
          onChange={handleChange}
          placeholder="Ej: Buenos Aires"
          type="text"
          value={formData["shipping_address.province"]}
        />
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-medium text-gray-600"
            htmlFor="s-country"
          >
            País *
          </label>
          <ResponsiveCombobox
            autoComplete="country"
            data-testid="shipping-country-select"
            id="s-country"
            name="shipping_address.country_code"
            onValueChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                "shipping_address.country_code": value,
              }))
            }
            placeholder="Seleccionar país"
            required
            searchPlaceholder="Buscar país..."
            triggerClassName={IC}
            value={formData["shipping_address.country_code"]}
            options={countryOptions}
          />
        </div>
      </div>
    </div>
  );
}
