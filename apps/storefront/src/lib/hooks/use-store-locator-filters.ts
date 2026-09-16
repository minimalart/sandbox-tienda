"use client";

import { matchesZone } from "@lib/util/store-locator-zones";

import { useCallback, useMemo, useState } from "react";
import type React from "react";
import type {
  StoreLocatorCategory,
  StoreLocatorLocation,
  StoreLocatorRegion,
  StoreLocatorType,
  StoreLocatorZone,
} from "@lib/types/store-locator";
import { haversineKm } from "@lib/util/haversine";

const NEAREST_LIMIT = 6;

type UseStoreLocatorFiltersReturn = {
  selectedTypes: StoreLocatorType[];
  selectedRegions: StoreLocatorRegion[];
  setSelectedTypes: React.Dispatch<React.SetStateAction<StoreLocatorType[]>>;
  setSelectedRegions: React.Dispatch<
    React.SetStateAction<StoreLocatorRegion[]>
  >;
  setShowOpenOnly: React.Dispatch<React.SetStateAction<boolean>>;
  toggleType: (type: StoreLocatorType) => void;
  toggleRegion: (region: StoreLocatorRegion) => void;
  filteredStores: StoreLocatorLocation[];
  showOpenOnly: boolean;
  toggleOpenOnly: () => void;
};

export function useStoreLocatorFilters(
  stores: StoreLocatorLocation[],
  referencePoint?: { lat: number; lng: number } | null,
  regions: StoreLocatorZone[] = [],
  /** Los tipos configurados por la tienda, en orden: define el orden del listado. */
  types: StoreLocatorCategory[] = []
): UseStoreLocatorFiltersReturn {
  const [selectedTypes, setSelectedTypes] =
    useState<StoreLocatorType[]>([]);
  const [selectedRegions, setSelectedRegions] =
    useState<StoreLocatorRegion[]>([]);
  const [showOpenOnly, setShowOpenOnly] = useState(false);

  const toggleOpenOnly = useCallback(() => {
    setShowOpenOnly((prev) => !prev);
  }, []);

  const toggleType = useCallback((type: StoreLocatorType) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((current) => current !== type)
        : [...prev, type]
    );
  }, []);

  const toggleRegion = useCallback((region: StoreLocatorRegion) => {
    setSelectedRegions((prev) => {
      return prev.includes(region)
        ? prev.filter((current) => current !== region)
        : [...prev, region];
    });
  }, []);

  const filteredStores = useMemo(() => {
    const result = stores.filter((store) => {
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(store.type);
      const matchesLocation =
        selectedRegions.length === 0 ||
        regions.some((region) => selectedRegions.includes(region.id) && matchesZone(store.lat, store.lng, region));
      const matchesOpen = !showOpenOnly || store.isOpenNow === true;

      return matchesType && matchesLocation && matchesOpen;
    });

    if (referencePoint) {
      return result
        .filter((store) => store.lat !== null && store.lng !== null)
        .map((store) => ({
          store,
          distance: haversineKm(
            referencePoint.lat,
            referencePoint.lng,
            store.lat as number,
            store.lng as number
          ),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, NEAREST_LIMIT)
        .map(({ store }) => store);
    }

    /**
     * El orden lo define la tienda: es la posición del tipo en la lista que
     * configuró. Antes era un `Record` con los tres tipos clavados, y con un
     * tipo nuevo el comparador devolvía `NaN` y el orden quedaba indefinido.
     * Una sucursal sin tipo (o con uno que ya no existe) va al final.
     */
    const orderOf = (type: StoreLocatorType) => {
      const index = types.findIndex((option) => option.id === type);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };

    return [...result].sort((a, b) => orderOf(a.type) - orderOf(b.type));
  }, [stores, selectedTypes, selectedRegions, showOpenOnly, referencePoint, regions, types]);

  return {
    selectedTypes,
    selectedRegions,
    setSelectedTypes,
    setSelectedRegions,
    setShowOpenOnly,
    toggleType,
    toggleRegion,
    filteredStores,
    showOpenOnly,
    toggleOpenOnly,
  };
}
