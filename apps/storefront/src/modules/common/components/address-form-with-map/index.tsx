'use client';

import { makeAddressSchema } from '@lib/validation/address';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { PhoneInput, defaultCountries, parseCountry } from 'react-international-phone';
import 'react-international-phone/style.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import FormInput from '@modules/common/components/form-input';
import { composeGeocodeQuery } from './compose-geocode-query';

const LIBRARIES: ('places' | 'marker')[] = ['places', 'marker'];
const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };
const DEBOUNCE_MS = 600;
const MIN_QUERY_LENGTH = 3;
const ADDRESS_TAGS = ['Casa', 'Trabajo', 'Otro'] as const;

const countries = defaultCountries
  .filter((c) => {
    const parsed = parseCountry(c);
    return parsed.iso2 === 'ar' || parsed.iso2 === 'uy';
  })
  .map((c) => {
    const parsed = parseCountry(c);
    if (parsed.iso2 === 'ar') {
      return [
        parsed.name,
        parsed.iso2,
        parsed.dialCode,
        '.. .... ....',
        ...(parsed.priority ? [parsed.priority] : []),
      ] as typeof c;
    }
    return c;
  });

export type AddressFormData = {
  firstName: string;
  lastName: string;
  addressName: string;
  address1: string;
  address2: string;
  city: string;
  province: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
};

type AddressFormWithMapProps = {
  googleMapsApiKey: string;
  initialData?: Partial<AddressFormData>;
  onSubmit: (data: AddressFormData) => void | Promise<void>;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  error?: string | null;
  hideNameFields?: boolean;
};

type ParsedAddress = {
  address1: string;
  city: string;
  province: string;
  postalCode: string;
};

function parsePlaceComponents(
  components: google.maps.GeocoderAddressComponent[],
  fallbackAddress?: string
): ParsedAddress {
  let streetNumber = '';
  let route = '';
  let locality = '';
  let adminArea = '';
  let postal = '';

  for (const comp of components) {
    const t = comp.types[0];
    switch (t) {
      case 'street_number':
        streetNumber = comp.long_name;
        break;
      case 'route':
        route = comp.long_name;
        break;
      case 'locality':
        locality = comp.long_name;
        break;
      case 'administrative_area_level_1':
        adminArea = comp.long_name;
        break;
      case 'postal_code':
        postal = comp.long_name;
        break;
      default:
        break;
    }
  }

  const addr = route ? `${route} ${streetNumber}`.trim() : (fallbackAddress ?? '');

  return {
    address1: addr,
    city: locality,
    province: adminArea,
    postalCode: postal,
  };
}

/* ── Subcomponents ─────────────────────────────────── */

function AddressNameField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const showCustomInput = value !== 'Casa' && value !== 'Trabajo';

  return (
    <fieldset>
      <legend className="mb-1.5 font-medium text-gray-700 text-sm">Nombre de la dirección *</legend>
      <div className="mb-2 flex flex-wrap gap-2">
        {ADDRESS_TAGS.map((tag) => (
          <button
            className={`rounded-full border px-4 py-1.5 font-medium text-sm transition-colors ${
              value === tag
                ? 'border-[--primary-color] bg-[--primary-color] text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
            disabled={disabled}
            key={tag}
            onClick={() => onChange(tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>
      {showCustomInput && (
        <FormInput
          disabled={disabled}
          id="addr-address-name"
          label="Nombre personalizado"
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: Casa de mamá"
          type="text"
          value={value === 'Otro' ? '' : value}
        />
      )}
    </fieldset>
  );
}

function PhoneField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <fieldset className="relative rounded-lg border border-gray-300 bg-white px-3 pb-2 pt-3 focus-within:border-[--primary-color] focus-within:ring-1 focus-within:ring-[--primary-color]">
      <legend className="-top-2 left-3 absolute rounded bg-white px-1 font-bold text-[--primary-color] text-xs">Teléfono *</legend>
      <PhoneInput
        countries={countries}
        defaultCountry="ar"
        disabled={disabled}
        disableFormatting
        forceDialCode
        inputProps={{
          disabled,
          placeholder: 'Ej: +54 9 11 1234-5678',
          style: { height: '42px', width: '100%' },
        }}
        onChange={onChange}
        style={
          {
            width: '100%',
            '--react-international-phone-height': '42px',
            '--react-international-phone-border-radius': '8px',
            '--react-international-phone-border-color': 'transparent',
            '--react-international-phone-background-color': '#fff',
            '--react-international-phone-font-size': '14px',
            '--react-international-phone-text-color': '#111827',
            '--react-international-phone-country-selector-background-color-hover': '#f3f4f6',
          } as React.CSSProperties
        }
        value={value}
      />
    </fieldset>
  );
}

function LoadingSpinner() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        fill="currentColor"
      />
    </svg>
  );
}

function reverseGeocode(lat: number, lng: number, onResult: (parsed: ParsedAddress) => void) {
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ location: { lat, lng } }, (results, status) => {
    if (status !== 'OK' || !results?.[0]) {
      return;
    }
    const parsed = parsePlaceComponents(
      results[0].address_components ?? [],
      results[0].formatted_address
    );
    onResult(parsed);
  });
}

function getInitialFormState(initialData?: Partial<AddressFormData>) {
  return {
    firstName: initialData?.firstName ?? '',
    lastName: initialData?.lastName ?? '',
    addressName: initialData?.addressName ?? '',
    address1: initialData?.address1 ?? '',
    address2: initialData?.address2 ?? '',
    city: initialData?.city ?? '',
    province: initialData?.province ?? '',
    postalCode: initialData?.postalCode ?? '',
    countryCode: initialData?.countryCode ?? 'ar',
    phone: initialData?.phone ?? '',
    latitude: initialData?.latitude ?? null,
    longitude: initialData?.longitude ?? null,
  };
}

function applyParsedToSetters(
  parsed: ParsedAddress,
  setters: {
    setAddress1: (v: string) => void;
    setCity: (v: string) => void;
    setProvince: (v: string) => void;
    setPostalCode: (v: string) => void;
  }
) {
  setters.setAddress1(parsed.address1);
  if (parsed.city) {
    setters.setCity(parsed.city);
  }
  if (parsed.province) {
    setters.setProvince(parsed.province);
  }
  if (parsed.postalCode) {
    setters.setPostalCode(parsed.postalCode);
  }
}

/* ── Main component ────────────────────────────────── */

/**
 * Dispatcher: only mounts the Google Maps script loader when an API key is
 * configured. Without a key the plain address form renders (no map, no
 * autocomplete) and no Google script is ever injected — otherwise the
 * console fills with ApiProjectMapError.
 */
export default function AddressFormWithMap(props: AddressFormWithMapProps) {
  if (!props.googleMapsApiKey?.trim()) {
    return <AddressFormImpl {...props} isLoaded={false} />;
  }
  return <AddressFormWithMapsLoader {...props} />;
}

function AddressFormWithMapsLoader(props: AddressFormWithMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: props.googleMapsApiKey,
    libraries: LIBRARIES,
  });
  return <AddressFormImpl {...props} isLoaded={isLoaded} />;
}

function AddressFormImpl({
  isLoaded,
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = 'Guardar dirección',
  onCancel,
  error,
  hideNameFields = false,
}: AddressFormWithMapProps & { isLoaded: boolean }) {
  const defaults = getInitialFormState(initialData);
  const [firstName, setFirstName] = useState(defaults.firstName);
  const [lastName, setLastName] = useState(defaults.lastName);
  const [addressName, setAddressName] = useState(defaults.addressName);
  const [address1, setAddress1] = useState(defaults.address1);
  const [address2, setAddress2] = useState(defaults.address2);
  const [city, setCity] = useState(defaults.city);
  const [province, setProvince] = useState(defaults.province);
  const [postalCode, setPostalCode] = useState(defaults.postalCode);
  const [countryCode] = useState(defaults.countryCode);
  const [phone, setPhone] = useState(defaults.phone);
  const [latitude, setLatitude] = useState<number | null>(defaults.latitude);
  const [longitude, setLongitude] = useState<number | null>(defaults.longitude);

  const autocompleteInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [address1Input, setAddress1Input] = useState(defaults.address1);

  // Espejo síncrono de address1/city/province/postalCode: el debounce del
  // geocoding lee de acá (no del state) para no quedarse con un closure
  // viejo cuando el timeout dispara.
  const address1Ref = useRef(defaults.address1);
  const cityRef = useRef(defaults.city);
  const provinceRef = useRef(defaults.province);
  const postalCodeRef = useRef(defaults.postalCode);

  const initialGeocodeQuery =
    defaults.latitude != null
      ? composeGeocodeQuery({
          address1: defaults.address1,
          city: defaults.city,
          province: defaults.province,
          postalCode: defaults.postalCode,
        })
      : null;
  // Query que produjo el punto CONFIRMADO actual (Places, click o drag del pin). Si
  // los campos vuelven a componer esta misma query, no hay nada nuevo que geocodificar.
  const confirmedQueryRef = useRef<string | null>(initialGeocodeQuery);
  // Última query que efectivamente se mandó a geocodificar, para no repetirla.
  const lastGeocodedQueryRef = useRef<string | null>(initialGeocodeQuery);
  // Contador de pedidos de geocoding: si una respuesta vuelve con un id viejo, el
  // usuario ya siguió escribiendo y esa respuesta se descarta.
  const geocodeRequestIdRef = useRef(0);

  // Origen del punto actual: CONFIRMADO (Places, click o drag del pin) vs
  // APROXIMADO (geocoding de lo que el usuario tipeó, sin que lo haya validado).
  const [pointOrigin, setPointOrigin] = useState<'confirmed' | 'approximate' | null>(
    defaults.latitude != null ? 'confirmed' : null
  );

  const mapCenter =
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;

  // Places (autocomplete), click en el mapa o drag del pin son señales directas
  // de dónde está el punto: el usuario las eligió a propósito. Eso es
  // CONFIRMADO, a diferencia de tipear texto libre y que el geocoder adivine.
  const markConfirmed = useCallback(() => {
    const query = composeGeocodeQuery({
      address1: address1Ref.current,
      city: cityRef.current,
      province: provinceRef.current,
      postalCode: postalCodeRef.current,
    });
    confirmedQueryRef.current = query;
    lastGeocodedQueryRef.current = query;
    setPointOrigin('confirmed');
  }, []);

  const applyParsed = useCallback(
    (parsed: ParsedAddress) => {
      address1Ref.current = parsed.address1;
      if (parsed.city) {
        cityRef.current = parsed.city;
      }
      if (parsed.province) {
        provinceRef.current = parsed.province;
      }
      if (parsed.postalCode) {
        postalCodeRef.current = parsed.postalCode;
      }

      applyParsedToSetters(parsed, {
        setAddress1,
        setCity,
        setProvince,
        setPostalCode,
      });

      markConfirmed();
    },
    [markConfirmed]
  );

  const scheduleSettledWork = useCallback((work: () => void) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(work, DEBOUNCE_MS);
  }, []);

  const attemptGeocode = useCallback(() => {
    if (!isLoaded) return;

    const query = composeGeocodeQuery({
      address1: address1Ref.current,
      city: cityRef.current,
      province: provinceRef.current,
      postalCode: postalCodeRef.current,
    });

    // Sin query (dirección pobre), sin cambios desde la última confirmación, o
    // repetir la última query ya geocodificada: nada nuevo que hacer.
    if (!query || query === confirmedQueryRef.current || query === lastGeocodedQueryRef.current) {
      return;
    }

    lastGeocodedQueryRef.current = query;
    const requestId = ++geocodeRequestIdRef.current;
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query, componentRestrictions: { country: 'ar' } }, (results, status) => {
      // Respuesta fuera de orden (el usuario ya escribió algo más nuevo): se descarta.
      if (requestId !== geocodeRequestIdRef.current) return;
      // Fallar callado: ZERO_RESULTS, OVER_QUERY_LIMIT o cualquier error dejan el
      // mapa donde estaba. El form sigue funcionando sin coordenadas, como hoy.
      if (status !== 'OK' || !results?.[0]?.geometry?.location) return;

      const loc = results[0].geometry.location;
      setLatitude(loc.lat());
      setLongitude(loc.lng());
      setPointOrigin('approximate');
      mapRef.current?.panTo({ lat: loc.lat(), lng: loc.lng() });
      mapRef.current?.setZoom(15);
    });
  }, [isLoaded]);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      // Invalida cualquier geocode en vuelo para que su callback no llame a
      // setState después de desmontado.
      geocodeRequestIdRef.current += 1;
    },
    []
  );

  const handlePlace = useCallback(
    (lat: number, lng: number, parsed: ParsedAddress) => {
      setLatitude(lat);
      setLongitude(lng);
      applyParsed(parsed);
      setPhone('+54');
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(16);
    },
    [applyParsed]
  );

  const setAutocompleteInputRef = useCallback((node: HTMLInputElement | null) => {
    autocompleteInputRef.current = node;
  }, []);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (!isLoaded || query.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      try {
        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            includedRegionCodes: ['ar'],
          });
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    },
    [isLoaded]
  );

  const handleAddressInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      address1Ref.current = value;
      setAddress1Input(value);
      setAddress1(value);
      // Un solo debounce cuando el input se asienta: pide sugerencias de Places Y
      // reintenta geocodificar lo tipeado, sin sumar un segundo timer paralelo.
      scheduleSettledWork(() => {
        fetchSuggestions(value);
        attemptGeocode();
      });
    },
    [fetchSuggestions, attemptGeocode, scheduleSettledWork]
  );

  const handleCityInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      cityRef.current = e.target.value;
      setCity(e.target.value);
      scheduleSettledWork(attemptGeocode);
    },
    [attemptGeocode, scheduleSettledWork]
  );

  const handleProvinceInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      provinceRef.current = e.target.value;
      setProvince(e.target.value);
      scheduleSettledWork(attemptGeocode);
    },
    [attemptGeocode, scheduleSettledWork]
  );

  const handlePostalCodeInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      postalCodeRef.current = e.target.value;
      setPostalCode(e.target.value);
      scheduleSettledWork(attemptGeocode);
    },
    [attemptGeocode, scheduleSettledWork]
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      const pp = suggestion.placePrediction;
      if (!pp) return;
      const label = pp.mainText?.text ?? pp.text?.text ?? '';
      setSuggestions([]);
      setShowSuggestions(false);
      setAddress1Input(label);
      if (autocompleteInputRef.current) {
        autocompleteInputRef.current.value = label;
      }
      try {
        const place = pp.toPlace();
        await place.fetchFields({
          fields: ['addressComponents', 'location', 'formattedAddress'],
        });
        if (!place.location) return;
        const lat = place.location.lat();
        const lng = place.location.lng();
        const parsed = parsePlaceComponents(
          (place.addressComponents ?? []).map((c) => ({
            long_name: c.longText ?? '',
            short_name: c.shortText ?? '',
            types: c.types ?? [],
          })) as google.maps.GeocoderAddressComponent[],
          place.formattedAddress ?? undefined
        );
        handlePlace(lat, lng, parsed);
        const displayAddr = parsed.address1 || label;
        setAddress1Input(displayAddr);
        if (autocompleteInputRef.current) {
          autocompleteInputRef.current.value = displayAddr;
        }
      } catch {
        // keep label as-is
      }
    },
    [handlePlace]
  );

  const handleMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) {
        return;
      }
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setLatitude(lat);
      setLongitude(lng);
      // El click/drag ya posiciona el punto exacto que el usuario quiso: es
      // CONFIRMADO aunque el reverse-geocoding de abajo no encuentre nada
      // (dirección en una zona sin cobertura, por ejemplo).
      markConfirmed();

      reverseGeocode(lat, lng, (parsed) => {
        applyParsed(parsed);
        setPhone('+54');
        setAddress1Input(parsed.address1);
        if (autocompleteInputRef.current) {
          autocompleteInputRef.current.value = parsed.address1;
        }
      });
    },
    [applyParsed, markConfirmed]
  );

  // AdvancedMarkerElement: create/update marker imperatively when lat/lng changes
  useEffect(() => {
    if (!mapRef.current || latitude == null || longitude == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const position = { lat: latitude, lng: longitude };
    if (markerRef.current) {
      markerRef.current.position = position;
    } else {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        gmpDraggable: true,
      });
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current?.position;
        if (!pos) return;
        const latLng =
          pos instanceof google.maps.LatLng
            ? pos
            : new google.maps.LatLng(
                (pos as google.maps.LatLngLiteral).lat,
                (pos as google.maps.LatLngLiteral).lng
              );
        handleMapClick({ latLng } as google.maps.MapMouseEvent);
      });
    }
  }, [latitude, longitude, handleMapClick]);

  useEffect(() => {
    if (isLoading) {
      setShowSuggestions(false);
    }
  }, [isLoading]);

  const formValues = {
    firstName,
    lastName,
    addressName,
    address1,
    address2,
    city,
    province,
    postalCode,
    countryCode,
    phone,
    latitude,
    longitude,
  };

  const canSubmit = makeAddressSchema(hideNameFields).safeParse(formValues).success;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = makeAddressSchema(hideNameFields).safeParse(formValues);
    if (!result.success) {
      return;
    }
    onSubmit(result.data);
  };

  return (
    <form aria-busy={isLoading} className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {/* First name + Last name (hidden in checkout since personal info step handles it) */}
      {!hideNameFields && (
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            disabled={isLoading}
            id="addr-first-name"
            label="Nombre"
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Ej: Juan"
            required
            type="text"
            value={firstName}
          />
          <FormInput
            disabled={isLoading}
            id="addr-last-name"
            label="Apellido"
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Ej: Pérez"
            required
            type="text"
            value={lastName}
          />
        </div>
      )}

      <AddressNameField disabled={isLoading} onChange={setAddressName} value={addressName} />

      {/* Google Maps Autocomplete + Map */}
      <div>
        <label className="sr-only" htmlFor="address-autocomplete">
          Dirección *
        </label>
        <div className="relative">
          <FormInput
            disabled={isLoading}
            id="address-autocomplete"
            label="Dirección"
            onChange={handleAddressInput}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Ej: Av. Corrientes 1234"
            ref={setAutocompleteInputRef}
            type="text"
            autoComplete="off"
            value={address1Input}
            required
          />
          {!isLoading && showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {suggestions.map((s) => (
                <li
                  key={s.placePrediction?.placeId}
                  className="cursor-pointer px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-50"
                  onMouseDown={() => handleSelectSuggestion(s)}
                >
                  <span className="font-medium">{s.placePrediction?.mainText?.text}</span>
                  <span className="ml-1 text-gray-500 text-xs">
                    {s.placePrediction?.secondaryText?.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {isLoaded && (
          <div className="relative mt-3 overflow-hidden rounded-xl border border-gray-200">
            <GoogleMap
              center={mapCenter}
              mapContainerStyle={{ width: '100%', height: '200px' }}
              onClick={handleMapClick}
              onLoad={handleMapLoad}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'greedy',
                mapId: 'mercatto_map',
              }}
              zoom={latitude != null ? 16 : 12}
            />
            {isLoading && <div className="absolute inset-0 z-10 cursor-not-allowed bg-white/50" />}
          </div>
        )}
        {isLoaded && pointOrigin === 'approximate' && (
          <p className="mt-2 text-amber-700 text-xs">
            Ubicación aproximada — arrastrá el pin si no es exacta
          </p>
        )}
      </div>

      {/* City + Postal code */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="sr-only" htmlFor="addr-city">
            Ciudad *
          </label>
          <FormInput
            disabled={isLoading}
            id="addr-city"
            label="Ciudad"
            onChange={handleCityInput}
            placeholder="Ej: Buenos Aires"
            type="text"
            value={city}
            required
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="addr-postal">
            Código postal *
          </label>
          <FormInput
            disabled={isLoading}
            id="addr-postal"
            label="Código postal"
            onChange={handlePostalCodeInput}
            placeholder="Ej: 1414"
            type="text"
            value={postalCode}
            required
          />
        </div>
      </div>

      {/* Province + Dept/Piso */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="sr-only" htmlFor="addr-province">
            Provincia
          </label>
          <FormInput
            disabled={isLoading}
            id="addr-province"
            label="Provincia"
            onChange={handleProvinceInput}
            placeholder="Ej: Buenos Aires"
            type="text"
            value={province}
          />
        </div>
        <div>
          <label className="sr-only" htmlFor="addr-address2">
            Dept / Piso
          </label>
          <FormInput
            disabled={isLoading}
            id="addr-address2"
            label="Dept / Piso"
            onChange={(e) => setAddress2(e.target.value)}
            placeholder="Ej: 3B"
            type="text"
            value={address2}
          />
        </div>
      </div>

      {/*
        País: SIEMPRE Argentina, y ahora visible.

        La tienda tiene una única región configurada (Argentina / ARS), así que
        no hay a dónde entregar afuera: el autocompletado (`includedRegionCodes`),
        el geocoder (`componentRestrictions`) y el default de `countryCode` ya
        estaban todos fijos en `ar`. Lo que faltaba era DECIRLO. Sin este campo,
        cargar una dirección de Uruguay parecía funcionar y se guardaba como
        argentina sin un solo aviso — reportado en QA (DESDEELSUR-33).

        Se muestra deshabilitado en vez de como selector a propósito: ofrecer
        otro país prometería un checkout que el backend no puede completar (sin
        región no hay moneda, ni impuestos, ni opciones de envío). El día que la
        tienda venda afuera, esto se convierte en un select y `countryCode` pasa
        a tener setter.
      */}
      <div>
        <label className="sr-only" htmlFor="addr-country">
          País
        </label>
        <FormInput
          disabled
          id="addr-country"
          label="País"
          onChange={() => undefined}
          type="text"
          value="Argentina"
        />
        <p className="mt-1 text-gray-500 text-xs">
          Por ahora sólo realizamos entregas dentro de Argentina.
        </p>
      </div>

      <PhoneField disabled={isLoading} onChange={setPhone} value={phone} />

      {error && <div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">{error}</div>}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && (
          <button
            className="rounded-lg bg-gray-100 px-5 py-2.5 font-semibold text-gray-900 text-sm hover:bg-gray-200"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
        )}
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[--primary-color] px-5 py-2.5 font-semibold text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading || !canSubmit}
          type="submit"
        >
          {isLoading && <LoadingSpinner />}
          {isLoading ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
