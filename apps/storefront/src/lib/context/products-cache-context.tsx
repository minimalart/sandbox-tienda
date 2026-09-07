"use client";

import type { HttpTypes } from "@medusajs/types";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ProductsCacheContextType = {
  products: HttpTypes.StoreProduct[];
  isLoading: boolean;
  isFullyCached: boolean;
  addProducts: (newProducts: HttpTypes.StoreProduct[]) => void;
  getProductById: (id: string) => HttpTypes.StoreProduct | undefined;
};

const ProductsCacheContext = createContext<ProductsCacheContextType | undefined>(undefined);

type ProductsCacheProviderProps = {
  children: ReactNode;
  initialProducts?: HttpTypes.StoreProduct[];
};

export function ProductsCacheProvider({ children, initialProducts = [] }: ProductsCacheProviderProps) {
  const [products, setProducts] = useState<HttpTypes.StoreProduct[]>(initialProducts);
  const [isLoading, setIsLoading] = useState(false);
  const [isFullyCached, setIsFullyCached] = useState(false);

  // Agregar productos al caché sin duplicados
  const addProducts = (newProducts: HttpTypes.StoreProduct[]) => {
    setProducts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id));
      const uniqueNewProducts = newProducts.filter((p) => !existingIds.has(p.id));
      return [...prev, ...uniqueNewProducts];
    });
  };

  // Obtener producto por ID del caché
  const getProductById = (id: string) => {
    return products.find((p) => p.id === id);
  };

  // Cargar todos los productos en background después del montaje inicial
  useEffect(() => {
    if (initialProducts.length > 0 && !isFullyCached) {
      setIsLoading(true);
      
      // Simular carga en background (esto se puede conectar a una API real)
      const loadAllProducts = async () => {
        try {
          // Aquí podrías hacer una llamada para cargar todos los productos
          // Por ahora, marcamos como cacheado después de un tiempo
          await new Promise((resolve) => setTimeout(resolve, 2000));
          setIsFullyCached(true);
        } catch (error) {
          console.error("Error loading all products:", error);
        } finally {
          setIsLoading(false);
        }
      };

      // Cargar en background sin bloquear la UI
      loadAllProducts();
    }
  }, [initialProducts.length, isFullyCached]);

  return (
    <ProductsCacheContext.Provider
      value={{
        products,
        isLoading,
        isFullyCached,
        addProducts,
        getProductById,
      }}
    >
      {children}
    </ProductsCacheContext.Provider>
  );
}

export function useProductsCache() {
  const context = useContext(ProductsCacheContext);
  if (context === undefined) {
    throw new Error("useProductsCache must be used within a ProductsCacheProvider");
  }
  return context;
}
