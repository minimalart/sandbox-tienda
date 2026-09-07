"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Sucursal de retiro de un carrier. El shape ya contempla más de un carrier:
 * `code` cubre esquemas de identificador alfanumérico (ej. el agency_id de 3
 * chars de Correo Argentino, distinto del id numérico de Andreani) y
 * `network` cubre carriers con más de una red de retiro (Andreani: sucursal
 * propia + puntos HOP de terceros).
 */
export interface CarrierBranch {
  id: string;
  code?: string;
  description: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  type: string;
  network: string;
  latitude?: number;
  longitude?: number;
  businessHours?: string;
}

export interface UseCarrierBranchesState {
  branches: CarrierBranch[];
  isLoading: boolean;
  error: string | null;
  searchedPostalCode: string | null;
}

export interface UseCarrierBranchesActions {
  fetchBranches: (
    postalCode: string,
    serviceType?: string,
  ) => Promise<CarrierBranch[]>;
  clearBranches: () => void;
}

export type UseCarrierBranchesReturn = UseCarrierBranchesState &
  UseCarrierBranchesActions;

// ============================================================================
// API HELPER
// ============================================================================

const carrierBranchesApi = {
  async search(
    carrier: string,
    postalCode: string,
    serviceType?: string,
  ): Promise<CarrierBranch[]> {
    const searchParams = new URLSearchParams({
      carrier,
      postal_code: postalCode,
    });

    if (serviceType) {
      searchParams.set("service_type", serviceType);
    }

    const response = await fetch(
      `/api/store/carrier-branches?${searchParams.toString()}`,
    );
    const data = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(getApiErrorMessage(data));
    }

    // The /api/store/carrier-branches route already returns branches mapped
    // to the CarrierBranch UI shape — no further mapping needed here.
    return extractBranches(data);
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractBranches(data: unknown): CarrierBranch[] {
  if (Array.isArray(data)) {
    return data as CarrierBranch[];
  }

  if (!isRecord(data)) {
    return [];
  }

  const branches = (data as { branches?: unknown }).branches;
  return Array.isArray(branches) ? (branches as CarrierBranch[]) : [];
}

function getApiErrorMessage(data: unknown): string {
  if (isRecord(data)) {
    const message = data.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Error al buscar sucursales";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Error al buscar sucursales";
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * `carrier` queda sin resolver (undefined) hasta que el checkout sepa qué
 * carrier de pickup está activo — en ese estado el hook no dispara ningún
 * fetch (ni el manual ni el auto).
 */
export function useCarrierBranches(
  carrier: string | undefined,
  autoFetchPostalCode?: string,
  autoFetchServiceType?: string,
): UseCarrierBranchesReturn {
  const [branches, setBranches] = useState<CarrierBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedPostalCode, setSearchedPostalCode] = useState<string | null>(
    null,
  );
  const lastFetchedRef = useRef<string | null>(null);

  const fetchBranches = useCallback(
    async (postalCode: string, serviceType = autoFetchServiceType) => {
      if (!carrier || !postalCode || postalCode.length < 4) {
        return [];
      }

      const requestKey = `${carrier}:${postalCode}:${serviceType || ""}`;

      if (lastFetchedRef.current === requestKey) {
        return branches;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await carrierBranchesApi.search(
          carrier,
          postalCode,
          serviceType,
        );
        setBranches(result);
        setSearchedPostalCode(postalCode);
        lastFetchedRef.current = requestKey;
        return result;
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [carrier, autoFetchServiceType, branches],
  );

  const clearBranches = useCallback(() => {
    setBranches([]);
    setSearchedPostalCode(null);
    setError(null);
    lastFetchedRef.current = null;
  }, []);

  // Auto-fetch when postal code is provided
  useEffect(() => {
    if (autoFetchPostalCode && autoFetchPostalCode.length >= 4) {
      fetchBranches(autoFetchPostalCode, autoFetchServiceType);
    }
  }, [autoFetchPostalCode, autoFetchServiceType, fetchBranches]);

  return {
    branches,
    isLoading,
    error,
    searchedPostalCode,
    fetchBranches,
    clearBranches,
  };
}
