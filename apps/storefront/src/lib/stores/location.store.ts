import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Tipo de Location simplificado (sin geolocalización)
 * Solo almacena información básica de stock locations de Medusa
 */
export interface Location {
  id: string;
  name: string;
  address?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    country_code?: string;
    province?: string;
    postal_code?: string;
  } | null;
  metadata?: Record<string, any>;
}

interface LocationState {
  // Estado
  locations: Location[];
  selectedLocation: Location | null;
  isLoading: boolean;
  error: string | null;

  // Acciones
  setLocations: (locations: Location[]) => void;
  setSelectedLocation: (location: Location | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Helpers
  getLocationById: (id: string) => Location | undefined;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      locations: [],
      selectedLocation: null,
      isLoading: false,
      error: null,

      // Acciones
      setLocations: (locations) => {
        set({ locations });
        // Auto-seleccionar primera locación si no hay ninguna seleccionada
        const { selectedLocation } = get();
        if (!selectedLocation && locations.length > 0) {
          set({ selectedLocation: locations[0] });
        }
      },
      setSelectedLocation: (selectedLocation) => set({ selectedLocation }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Helpers
      getLocationById: (id) => {
        const { locations } = get();
        return locations.find((loc) => loc.id === id);
      },
    }),
    {
      name: "location-storage",
      partialize: (state) => ({ selectedLocation: state.selectedLocation }),
    }
  )
);

