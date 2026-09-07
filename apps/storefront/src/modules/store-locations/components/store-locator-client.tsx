"use client";

import { useStoreLocatorFilters } from "@lib/hooks/use-store-locator-filters";
import type {
  StoreLocatorLocation,
  StoreLocatorRegion,
  StoreLocatorType,
} from "@lib/types/store-locator";
import { useJsApiLoader } from "@react-google-maps/api";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StoreCard from "./store-card";
import StoreLocatorFilters from "./store-locator-filters";
import StoreMap from "./store-map";

type StoreLocatorClientProps = {
  stores: StoreLocatorLocation[];
  googleMapsApiKey: string;
  /**
   * Subtitulo bajo el titulo. Cadena vacia = no se muestra (lo resuelve el
   * template desde la config del demo).
   */
  subtitle?: string;
  /**
   * `full` (default): buscador + filtros + mapa, con el listado debajo.
   * `compact`: pocas sucursales — listado al lado del mapa, sin buscador ni
   * filtros.
   */
  layout?: "full" | "compact";
  showLocationFilters?: boolean;
  showCategoryFilters?: boolean;
};

const libraries: "places"[] = ["places"];
const DEBOUNCE_MS = 500;
const MIN_QUERY_LENGTH = 3;

export default function StoreLocatorClient({
  stores,
  googleMapsApiKey,
  subtitle,
  layout = "full",
  showLocationFilters = true,
  showCategoryFilters = true,
}: StoreLocatorClientProps) {
  const isCompact = layout === "compact";
  // En compacto no hay buscador ni filtros, sin importar los toggles.
  const hasFilters =
    !isCompact && (showLocationFilters || showCategoryFilters);
  const hasApiKey = Boolean(googleMapsApiKey);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: googleMapsApiKey || "missing-key",
    libraries,
  });

  const [searchLocation, setSearchLocation] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"list" | "map">("list");
  const [showFilters, setShowFilters] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);

  const {
    selectedTypes,
    selectedRegions,
    setSelectedTypes,
    setSelectedRegions,
    setShowOpenOnly,
    toggleType,
    toggleRegion,
    filteredStores,
    isArgentinaChecked,
    isArgentinaIndeterminate,
    showOpenOnly,
    toggleOpenOnly,
  } = useStoreLocatorFilters(stores, searchLocation);

  const [pendingTypes, setPendingTypes] = useState<StoreLocatorType[]>([]);
  const [pendingRegions, setPendingRegions] = useState<StoreLocatorRegion[]>(
    []
  );
  const [pendingShowOpenOnly, setPendingShowOpenOnly] = useState(false);

  const pendingArgentinaCount = useMemo(
    () =>
      pendingRegions.filter((region) =>
        ["caba", "buenos-aires", "norte", "centro", "sur"].includes(region)
      ).length,
    [pendingRegions]
  );
  const pendingIsArgentinaChecked = pendingArgentinaCount > 0;
  const pendingIsArgentinaIndeterminate =
    pendingArgentinaCount > 0 && pendingArgentinaCount < 5;

  const handleOpenFilters = () => {
    setPendingTypes([...selectedTypes]);
    setPendingRegions([...selectedRegions]);
    setPendingShowOpenOnly(showOpenOnly);
    setShowFilters(true);
  };

  const pendingToggleType = (type: StoreLocatorType) => {
    setPendingTypes((prev) =>
      prev.includes(type)
        ? prev.filter((current) => current !== type)
        : [...prev, type]
    );
  };

  const pendingToggleRegion = (region: StoreLocatorRegion) => {
    setPendingRegions((prev) => {
      const argentinaChildren: StoreLocatorRegion[] = [
        "caba",
        "buenos-aires",
        "norte",
        "centro",
        "sur",
      ];
      if (region === "argentina") {
        const allSelected = argentinaChildren.every((child) =>
          prev.includes(child)
        );
        if (allSelected) {
          return prev.filter((current) => !argentinaChildren.includes(current));
        }
        const withoutArgentina = prev.filter(
          (current) => !argentinaChildren.includes(current)
        );
        return [...withoutArgentina, ...argentinaChildren];
      }

      return prev.includes(region)
        ? prev.filter((current) => current !== region)
        : [...prev, region];
    });
  };

  const handleApplyFilters = () => {
    setSelectedTypes(pendingTypes);
    setSelectedRegions(pendingRegions);
    setShowOpenOnly(pendingShowOpenOnly);
    setShowFilters(false);
  };

  const fetchSuggestions = useCallback(
    (query: string) => {
      if (!hasApiKey || !isLoaded || query.length < MIN_QUERY_LENGTH) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        {
          componentRestrictions: { country: ["ar", "uy"] },
          input: query,
        },
        (predictions) => {
          const nextSuggestions = predictions ?? [];
          setSuggestions(nextSuggestions);
          setShowSuggestions(nextSuggestions.length > 0);
        }
      );
    },
    [hasApiKey, isLoaded]
  );

  const handleSearchInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchValue(value);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (value.length === 0) {
        setSuggestions([]);
        setShowSuggestions(false);
        setSearchLocation(null);
        return;
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(value);
      }, DEBOUNCE_MS);
    },
    [fetchSuggestions]
  );

  const handleClearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchValue("");
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchLocation(null);
    setSelectedStoreId(null);
  }, []);

  const handleSelectSuggestion = useCallback(
    (suggestion: google.maps.places.AutocompletePrediction) => {
      setSearchValue(suggestion.structured_formatting.main_text);
      setSuggestions([]);
      setShowSuggestions(false);

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ placeId: suggestion.place_id }, (results, status) => {
        if (status !== "OK" || !results?.[0]?.geometry?.location) {
          return;
        }
        const location = results[0].geometry.location;
        setSearchLocation({ lat: location.lat(), lng: location.lng() });
        setSelectedStoreId(null);
        setActiveTab("map");
      });
    },
    []
  );

  // En el layout compacto la primera sucursal ya viene seleccionada (card
  // expandida + infowindow abierto en el mapa). Solo la primera vez: si el
  // usuario la cierra no la volvemos a seleccionar.
  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (!isCompact || didAutoSelectRef.current) {
      return;
    }
    const firstStore = filteredStores[0];
    if (!firstStore) {
      return;
    }
    didAutoSelectRef.current = true;
    setSelectedStoreId(firstStore.id);
    setExpandedStoreId(firstStore.id);
  }, [isCompact, filteredStores]);

  const handleStoreSelect = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setExpandedStoreId(storeId);
  };

  const handleToggleExpand = (storeId: string) => {
    const next = expandedStoreId === storeId ? null : storeId;
    setExpandedStoreId(next);
    setSelectedStoreId(next ?? storeId);
  };

  const handleLocateMe = () => {
    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearchLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setSelectedStoreId(null);
        setActiveTab("map");
      },
      undefined,
      {
        enableHighAccuracy: true,
        maximumAge: 60000,
        timeout: 10000,
      }
    );
  };

  const handleVoiceSearch = useCallback(() => {
    if (typeof window === "undefined" || !isLoaded || !hasApiKey) {
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new (SpeechRecognitionClass as new () => any)();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "es-AR";
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;
    }

    const recognition = recognitionRef.current;
    recognition.onresult = (event: any) => {
      const transcript = (event.results[0][0].transcript as string).trim();
      if (!transcript) {
        return;
      }
      setSearchValue(transcript);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      fetchSuggestions(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }, [fetchSuggestions, hasApiKey, isLoaded, isListening]);

  const searchInput = (
    <div className="relative flex-1">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </div>
      <input
        autoComplete="off"
        className={`block w-full rounded-full border border-gray-300 bg-white py-2.5 pl-9 text-sm placeholder-gray-400 focus:border-[--primary-color] focus:outline-none focus:ring-1 focus:ring-[--primary-color] disabled:bg-gray-50 ${
          searchValue ? "pr-[4.5rem]" : "pr-9"
        }`}
        disabled={!hasApiKey || !isLoaded}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        onChange={handleSearchInput}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        placeholder={
          hasApiKey && isLoaded ? "Escribí tu ubicación..." : "Cargando mapa..."
        }
        type="text"
        value={searchValue}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((suggestion) => (
            <li
              className="cursor-pointer px-4 py-2.5 text-gray-800 text-sm hover:bg-gray-50"
              key={suggestion.place_id}
              onMouseDown={() => handleSelectSuggestion(suggestion)}
            >
              <span className="font-medium">
                {suggestion.structured_formatting.main_text}
              </span>
              <span className="ml-1 text-gray-500 text-xs">
                {suggestion.structured_formatting.secondary_text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
        {searchValue && (
          <button
            aria-label="Limpiar búsqueda"
            className="grid h-7 w-7 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            onClick={handleClearSearch}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </button>
        )}
        <button
          aria-label="Búsqueda por voz"
          aria-pressed={isListening}
          className={`grid h-8 w-8 place-items-center rounded-full border shadow-sm transition ${
            isListening
              ? "animate-pulse border-red-300 bg-red-50 text-red-600"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          disabled={!hasApiKey || !isLoaded}
          onClick={handleVoiceSearch}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 1.75a3.25 3.25 0 00-3.25 3.25v7a3.25 3.25 0 006.5 0v-7A3.25 3.25 0 0012 1.75z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
            <path
              d="M19 11v1a7 7 0 01-14 0v-1"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
            <path
              d="M12 19v3m-4 0h8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </button>
      </div>
    </div>
  );

  const header = (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-bold text-3xl text-gray-900 lg:text-4xl">
          Sucursales
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-gray-600 text-sm lg:text-base">
            {subtitle}
          </p>
        ) : null}
      </div>
      <p className="font-medium text-gray-500 text-sm">
        {isCompact
          ? `${stores.length} sucursales`
          : `${filteredStores.length} de ${stores.length} sucursales`}
      </p>
    </div>
  );

  // Layout compacto: sin buscador, filtros ni pestañas. El listado va al lado
  // del mapa en desktop y debajo en mobile.
  if (isCompact) {
    return (
      <>
        {header}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="order-2 space-y-3 lg:order-1 lg:max-h-[600px] lg:overflow-y-auto lg:pr-1">
            {filteredStores.map((store) => (
              <StoreCard
                isExpanded={expandedStoreId === store.id}
                key={store.id}
                onToggle={() => handleToggleExpand(store.id)}
                store={store}
              />
            ))}
          </div>
          <div className="order-1 min-h-[350px] overflow-hidden rounded-2xl lg:order-2 lg:min-h-[600px]">
            <StoreMap
              hasApiKey={hasApiKey}
              isLoaded={isLoaded}
              onLocateMe={handleLocateMe}
              onStoreSelect={handleStoreSelect}
              searchLocation={searchLocation}
              selectedStoreId={selectedStoreId}
              stores={filteredStores}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="mb-4 flex items-center gap-2 lg:hidden">
        {searchInput}
        {hasFilters && (
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50"
            onClick={handleOpenFilters}
            type="button"
          >
            Filtros
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M3 6h18M6 12h12M10 18h4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
              />
            </svg>
          </button>
        )}
      </div>

      <div className="mb-4 flex rounded-full bg-gray-100 p-1 lg:hidden">
        <button
          className={`flex-1 rounded-full px-4 py-2.5 font-medium text-sm transition-all ${
            activeTab === "map"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("map")}
          type="button"
        >
          Mapa
        </button>
        <button
          className={`flex-1 rounded-full px-4 py-2.5 font-medium text-sm transition-all ${
            activeTab === "list"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("list")}
          type="button"
        >
          Listado
        </button>
      </div>

      <div className="hidden gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <div className="relative mb-6">{searchInput}</div>
          {hasFilters && (
            <StoreLocatorFilters
              isArgentinaChecked={isArgentinaChecked}
              isArgentinaIndeterminate={isArgentinaIndeterminate}
              onToggleOpenOnly={toggleOpenOnly}
              onToggleRegion={toggleRegion}
              onToggleType={toggleType}
              selectedRegions={selectedRegions}
              selectedTypes={selectedTypes}
              showCategory={showCategoryFilters}
              showLocation={showLocationFilters}
              showOpenOnly={showOpenOnly}
            />
          )}
        </div>
        <div className="min-h-[500px] overflow-hidden rounded-2xl">
          <StoreMap
            hasApiKey={hasApiKey}
            isLoaded={isLoaded}
            onLocateMe={handleLocateMe}
            onStoreSelect={handleStoreSelect}
            searchLocation={searchLocation}
            selectedStoreId={selectedStoreId}
            stores={filteredStores}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:hidden">
        <div
          className={`min-h-[350px] overflow-hidden rounded-2xl ${
            activeTab === "list" ? "hidden" : ""
          }`}
        >
          <StoreMap
            hasApiKey={hasApiKey}
            isLoaded={isLoaded}
            onLocateMe={handleLocateMe}
            onStoreSelect={handleStoreSelect}
            searchLocation={searchLocation}
            selectedStoreId={selectedStoreId}
            stores={filteredStores}
          />
        </div>
      </div>

      <div
        className={`space-y-3 lg:hidden ${
          activeTab === "list" ? "block" : "hidden"
        }`}
      >
        {filteredStores.length > 0 ? (
          filteredStores.map((store) => (
            <StoreCard
              isExpanded={expandedStoreId === store.id}
              key={store.id}
              onToggle={() => handleToggleExpand(store.id)}
              store={store}
            />
          ))
        ) : (
          <div className="py-12 text-center">
            <p className="font-medium text-gray-500 text-lg">
              No se encontraron sucursales con los filtros seleccionados
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 hidden rounded-2xl bg-gray-50/70 p-6 lg:block">
        {filteredStores.length > 0 ? (
          <div className="grid grid-cols-2 items-start gap-4">
            <div className="space-y-4">
              {filteredStores
                .filter((_, index) => index % 2 === 0)
                .map((store) => (
                  <StoreCard
                    isExpanded={expandedStoreId === store.id}
                    key={store.id}
                    onToggle={() => handleToggleExpand(store.id)}
                    store={store}
                  />
                ))}
            </div>
            <div className="space-y-4">
              {filteredStores
                .filter((_, index) => index % 2 === 1)
                .map((store) => (
                  <StoreCard
                    isExpanded={expandedStoreId === store.id}
                    key={store.id}
                    onToggle={() => handleToggleExpand(store.id)}
                    store={store}
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="font-medium text-gray-500 text-lg">
              No se encontraron sucursales con los filtros seleccionados
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showFilters && hasFilters && (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              aria-hidden="true"
              className="fixed inset-0 z-[99998] bg-black/30 lg:hidden"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              animate={{ x: 0 }}
              className="fixed inset-y-0 right-0 z-[99999] flex w-full flex-col bg-white shadow-xl lg:hidden"
              exit={{ x: "100%" }}
              initial={{ x: "100%" }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex items-center justify-between border-gray-100 border-b px-5 py-4">
                <h2 className="font-semibold text-gray-900 text-lg">
                  Filtros
                </h2>
                <button
                  aria-label="Cerrar filtros"
                  className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100"
                  onClick={() => setShowFilters(false)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5">
                <StoreLocatorFilters
                  idPrefix="mobile-"
                  isArgentinaChecked={pendingIsArgentinaChecked}
                  isArgentinaIndeterminate={pendingIsArgentinaIndeterminate}
                  onToggleOpenOnly={() =>
                    setPendingShowOpenOnly((prev) => !prev)
                  }
                  onToggleRegion={pendingToggleRegion}
                  onToggleType={pendingToggleType}
                  selectedRegions={pendingRegions}
                  selectedTypes={pendingTypes}
                  showCategory={showCategoryFilters}
                  showLocation={showLocationFilters}
                  showOpenOnly={pendingShowOpenOnly}
                />
              </div>

              <div className="border-gray-100 border-t px-5 py-4">
                <button
                  className="w-full rounded-2xl bg-[--primary-color] py-3 font-semibold text-sm text-white transition hover:opacity-90"
                  onClick={handleApplyFilters}
                  type="button"
                >
                  Aplicar filtros
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
