"use client";

import { useCallback, useMemo, useState } from "react";
import type React from "react";
import type {
  StoreLocatorLocation,
  StoreLocatorRegion,
  StoreLocatorType,
} from "@lib/types/store-locator";
import { haversineKm } from "@lib/util/haversine";

const NEAREST_LIMIT = 6;

export const ARGENTINA_CHILDREN: StoreLocatorRegion[] = [
  "caba",
  "buenos-aires",
  "norte",
  "centro",
  "sur",
];

export const ALL_REGIONS: StoreLocatorRegion[] = [
  ...ARGENTINA_CHILDREN,
  "uruguay",
];

export const ALL_STORE_TYPES: StoreLocatorType[] = [
  "point_of_sale",
  "wholesale",
  "distribution_center",
];

const PROVINCE_MAP: Record<string, string[]> = {
  caba: [
    "CABA",
    "Ciudad Autonoma de Buenos Aires",
    "Ciudad Autónoma de Buenos Aires",
    "Capital Federal",
    "C.A.B.A.",
  ],
  "buenos-aires": [
    "Buenos Aires",
    "Provincia de Buenos Aires",
    "GBA",
    "Gran Buenos Aires",
  ],
  norte: [
    "Salta",
    "Jujuy",
    "Tucuman",
    "Tucumán",
    "Catamarca",
    "Santiago del Estero",
    "Formosa",
    "Chaco",
    "Misiones",
    "Corrientes",
  ],
  centro: [
    "Cordoba",
    "Córdoba",
    "Santa Fe",
    "Entre Rios",
    "Entre Ríos",
    "Mendoza",
    "San Juan",
    "San Luis",
    "La Rioja",
  ],
  sur: [
    "Neuquen",
    "Neuquén",
    "Rio Negro",
    "Río Negro",
    "Chubut",
    "Santa Cruz",
    "Tierra del Fuego",
    "La Pampa",
  ],
};

function stripDiacritics(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const NORMALIZED_PROVINCE_MAP: Record<string, string[]> = Object.fromEntries(
  Object.entries(PROVINCE_MAP).map(([key, provinces]) => [
    key,
    provinces.map(stripDiacritics),
  ])
);

function matchesRegion(
  store: StoreLocatorLocation,
  region: StoreLocatorRegion
): boolean {
  if (region === "argentina") {
    return stripDiacritics(store.country).includes("argentina");
  }
  if (region === "uruguay") {
    return stripDiacritics(store.country).includes("uruguay");
  }

  const provinces = NORMALIZED_PROVINCE_MAP[region];
  if (!provinces) {
    return false;
  }

  const province = stripDiacritics(store.province);
  const city = stripDiacritics(store.city);

  return provinces.some((candidate) => {
    return province.includes(candidate) || city.includes(candidate);
  });
}

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
  isArgentinaChecked: boolean;
  isArgentinaIndeterminate: boolean;
  showOpenOnly: boolean;
  toggleOpenOnly: () => void;
};

export function useStoreLocatorFilters(
  stores: StoreLocatorLocation[],
  referencePoint?: { lat: number; lng: number } | null
): UseStoreLocatorFiltersReturn {
  const [selectedTypes, setSelectedTypes] =
    useState<StoreLocatorType[]>(ALL_STORE_TYPES);
  const [selectedRegions, setSelectedRegions] =
    useState<StoreLocatorRegion[]>(ALL_REGIONS);
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
      if (region === "argentina") {
        const allSelected = ARGENTINA_CHILDREN.every((child) =>
          prev.includes(child)
        );
        if (allSelected) {
          return prev.filter((current) => !ARGENTINA_CHILDREN.includes(current));
        }
        const withoutArgentinaChildren = prev.filter(
          (current) => !ARGENTINA_CHILDREN.includes(current)
        );
        return [...withoutArgentinaChildren, ...ARGENTINA_CHILDREN];
      }

      return prev.includes(region)
        ? prev.filter((current) => current !== region)
        : [...prev, region];
    });
  }, []);

  const argentinaSelectedCount = useMemo(
    () =>
      selectedRegions.filter((region) => ARGENTINA_CHILDREN.includes(region))
        .length,
    [selectedRegions]
  );

  const isArgentinaChecked = argentinaSelectedCount > 0;
  const isArgentinaIndeterminate =
    argentinaSelectedCount > 0 &&
    argentinaSelectedCount < ARGENTINA_CHILDREN.length;

  const filteredStores = useMemo(() => {
    const result = stores.filter((store) => {
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(store.type);
      const matchesLocation =
        selectedRegions.length === 0 ||
        selectedRegions.some((region) => matchesRegion(store, region));
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

    const typeOrder: Record<StoreLocatorType, number> = {
      distribution_center: 0,
      wholesale: 1,
      point_of_sale: 2,
    };

    return [...result].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
  }, [stores, selectedTypes, selectedRegions, showOpenOnly, referencePoint]);

  return {
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
  };
}
