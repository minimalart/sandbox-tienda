import { Input, Label, Text } from '@medusajs/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGoogleMapsApiKey, loadGoogleMaps } from './google-maps-loader';

/**
 * Google Maps address picker for the store-location form.
 *
 * Mirrors the storefront's address-form-with-map approach
 * (apps/storefront/src/modules/common/components/address-form-with-map):
 * Places AutocompleteSuggestion for search + a map with a draggable marker,
 * parsing address_components (route+street_number → street, locality → city,
 * administrative_area_level_1 → province).
 *
 * The script is injected dynamically (no extra dependency). When
 * VITE_GOOGLE_MAPS_API_KEY is not configured the component renders nothing
 * but a hint — the manual inputs in the form keep working as before.
 */

/* Minimal structural typings for the Google Maps JS API (the backend has no
 * @types/google.maps — typed narrowly to what we use). */
type GLatLng = { lat: () => number; lng: () => number };
type GMarker = {
  setPosition: (pos: { lat: number; lng: number }) => void;
  getPosition: () => GLatLng | null | undefined;
  addListener: (event: string, handler: () => void) => void;
  setMap: (map: unknown) => void;
};
type GMap = {
  panTo: (pos: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (event: string, handler: (e: { latLng?: GLatLng }) => void) => void;
};
type GAddressComponent = { long_name: string; short_name: string; types: string[] };
type GPlaceAddressComponent = {
  longText?: string | null;
  shortText?: string | null;
  types?: string[];
};
type GPlace = {
  fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
  location?: GLatLng | null;
  addressComponents?: GPlaceAddressComponent[] | null;
  formattedAddress?: string | null;
};
type GSuggestion = {
  placePrediction?: {
    placeId?: string;
    mainText?: { text?: string } | null;
    secondaryText?: { text?: string } | null;
    text?: { text?: string } | null;
    toPlace: () => GPlace;
  } | null;
};
type GoogleMapsApi = {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
    Marker: new (opts: Record<string, unknown>) => GMarker;
    Geocoder: new () => {
      geocode: (
        req: { location: { lat: number; lng: number } },
        cb: (
          results:
            | { address_components?: GAddressComponent[]; formatted_address?: string }[]
            | null,
          status: string
        ) => void
      ) => void;
    };
    places: {
      AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: (req: {
          input: string;
          includedRegionCodes?: string[];
        }) => Promise<{ suggestions: GSuggestion[] }>;
      };
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __slGoogleMapsCallback?: () => void;
    gm_authFailure?: () => void;
  }
}

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

export interface PickedAddress {
  street: string;
  city: string;
  province: string;
  lat: string;
  lng: string;
}

/** route + street_number → street, locality → city, administrative_area_level_1 → province. */
const parseAddressComponents = (
  components: GAddressComponent[],
  fallbackStreet?: string
): Pick<PickedAddress, 'street' | 'city' | 'province'> => {
  let streetNumber = '';
  let route = '';
  let locality = '';
  let adminArea = '';

  for (const comp of components) {
    const type = comp.types[0];
    if (type === 'street_number') {
      streetNumber = comp.long_name;
    } else if (type === 'route') {
      route = comp.long_name;
    } else if (type === 'locality') {
      locality = comp.long_name;
    } else if (type === 'administrative_area_level_1') {
      adminArea = comp.long_name;
    }
  }

  return {
    street: route ? `${route} ${streetNumber}`.trim() : (fallbackStreet ?? ''),
    city: locality,
    province: adminArea,
  };
};

interface LocationPickerProps {
  lat: string;
  lng: string;
  /** Called with the parsed fields when a place is selected or the marker moves. */
  onPick: (picked: Partial<PickedAddress>) => void;
}

export const LocationPicker = ({ lat, lng, onPick }: LocationPickerProps) => {
  const { t } = useTranslation('storeLocations');
  const apiKey = getGoogleMapsApiKey();

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasMapError, setHasMapError] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!apiKey) {
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (!cancelled) {
          setHasMapError(false);
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasMapError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const reverseGeocode = useCallback((latNum: number, lngNum: number) => {
    const google = window.google;
    if (!google) {
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat: latNum, lng: lngNum } }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) {
        return;
      }
      const parsed = parseAddressComponents(
        results[0].address_components ?? [],
        results[0].formatted_address
      );
      onPickRef.current({
        ...parsed,
        lat: latNum.toFixed(6),
        lng: lngNum.toFixed(6),
      });
    });
  }, []);

  const moveMarker = useCallback((latNum: number, lngNum: number) => {
    markerRef.current?.setPosition({ lat: latNum, lng: lngNum });
    mapRef.current?.panTo({ lat: latNum, lng: lngNum });
  }, []);

  // Init map + draggable marker once the script is loaded.
  useEffect(() => {
    const google = window.google;
    if (!isLoaded || !google || !mapDivRef.current || mapRef.current) {
      return;
    }

    const latNum = Number.parseFloat(lat);
    const lngNum = Number.parseFloat(lng);
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);
    const center = hasCoords ? { lat: latNum, lng: lngNum } : DEFAULT_CENTER;

    const map = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: hasCoords ? 16 : 12,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
    });
    mapRef.current = map;

    const marker = new google.maps.Marker({
      map,
      position: center,
      draggable: true,
    });
    markerRef.current = marker;

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (!pos) {
        return;
      }
      const newLat = pos.lat();
      const newLng = pos.lng();
      onPickRef.current({ lat: newLat.toFixed(6), lng: newLng.toFixed(6) });
      reverseGeocode(newLat, newLng);
    });

    map.addListener('click', (e) => {
      if (!e.latLng) {
        return;
      }
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      marker.setPosition({ lat: newLat, lng: newLng });
      onPickRef.current({ lat: newLat.toFixed(6), lng: newLng.toFixed(6) });
      reverseGeocode(newLat, newLng);
    });
  }, [isLoaded, reverseGeocode]);

  // Keep the marker in sync when lat/lng are edited manually.
  useEffect(() => {
    const latNum = Number.parseFloat(lat);
    const lngNum = Number.parseFloat(lng);
    if (!isLoaded || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
      return;
    }
    moveMarker(latNum, lngNum);
  }, [isLoaded, lat, lng, moveMarker]);

  const fetchSuggestions = useCallback(async (input: string) => {
    const google = window.google;
    if (!google || input.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const { suggestions: results } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          includedRegionCodes: ['ar', 'uy'],
        });
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(value);
    }, DEBOUNCE_MS);
  };

  const handleSelectSuggestion = async (suggestion: GSuggestion) => {
    const prediction = suggestion.placePrediction;
    if (!prediction) {
      return;
    }
    const label = prediction.mainText?.text ?? prediction.text?.text ?? '';
    setSuggestions([]);
    setShowSuggestions(false);
    setQuery(label);

    try {
      const place = prediction.toPlace();
      await place.fetchFields({
        fields: ['addressComponents', 'location', 'formattedAddress'],
      });
      if (!place.location) {
        return;
      }
      const latNum = place.location.lat();
      const lngNum = place.location.lng();
      const parsed = parseAddressComponents(
        (place.addressComponents ?? []).map((c) => ({
          long_name: c.longText ?? '',
          short_name: c.shortText ?? '',
          types: c.types ?? [],
        })),
        place.formattedAddress ?? undefined
      );
      onPickRef.current({
        ...parsed,
        lat: latNum.toFixed(6),
        lng: lngNum.toFixed(6),
      });
      setQuery(parsed.street || label);
      moveMarker(latNum, lngNum);
      mapRef.current?.setZoom(16);
    } catch {
      /* keep the typed label */
    }
  };

  if (!apiKey) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        {t('MAPS_NO_KEY_HINT')}
      </Text>
    );
  }

  if (hasMapError) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        {t('MAPS_KEY_ERROR')}
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="sl-address-search">{t('FIELD_ADDRESS_SEARCH_LABEL')}</Label>
      <div className="relative">
        <Input
          id="sl-address-search"
          autoComplete="off"
          placeholder={t('FIELD_ADDRESS_SEARCH_PLACEHOLDER')}
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout">
            {suggestions.map((s) => (
              <li
                key={s.placePrediction?.placeId}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-ui-bg-base-hover"
                onMouseDown={() => void handleSelectSuggestion(s)}
              >
                <span className="font-medium text-ui-fg-base">
                  {s.placePrediction?.mainText?.text}
                </span>
                <span className="ml-1 text-ui-fg-muted text-xs">
                  {s.placePrediction?.secondaryText?.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {isLoaded ? (
        <>
          <div
            ref={mapDivRef}
            className="h-[200px] w-full overflow-hidden rounded-lg border border-ui-border-base"
          />
          <Text size="small" className="text-ui-fg-subtle">
            {t('MAPS_MARKER_HINT')}
          </Text>
        </>
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          {t('MAPS_LOADING')}
        </Text>
      )}
    </div>
  );
};
