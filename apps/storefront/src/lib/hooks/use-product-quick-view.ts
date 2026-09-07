"use client";

import { useState, useCallback } from "react";
import type { HttpTypes } from "@medusajs/types";

interface UseProductQuickViewReturn {
  isOpen: boolean;
  product: HttpTypes.StoreProduct | null;
  region: HttpTypes.StoreRegion | null;
  isLoading: boolean;
  error: string | null;
  openModal: (handle: string, countryCode: string) => Promise<void>;
  closeModal: () => void;
}

export function useProductQuickView(): UseProductQuickViewReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [product, setProduct] = useState<HttpTypes.StoreProduct | null>(null);
  const [region, setRegion] = useState<HttpTypes.StoreRegion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = useCallback(async (handle: string, countryCode: string) => {
    setIsLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const response = await fetch(
        `/api/store/product?handle=${encodeURIComponent(handle)}&countryCode=${encodeURIComponent(countryCode)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch product");
      }

      setProduct(data.product);
      setRegion(data.region);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading product");
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setProduct(null);
    setRegion(null);
    setError(null);
  }, []);

  return {
    isOpen,
    product,
    region,
    isLoading,
    error,
    openModal,
    closeModal,
  };
}
