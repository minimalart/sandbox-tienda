"use client";

import { getChannelProductInventory } from "@lib/data/channel-products";
import { useLocationStore } from "@lib/stores";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

interface InventoryLocation {
  location_id: string;
  location_name: string;
  stocked_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
}

interface ChannelInventoryInfoProps {
  product: HttpTypes.StoreProduct;
  variant?: HttpTypes.StoreProductVariant;
  showLocations?: boolean;
}

export default function ChannelInventoryInfo({
  product,
  variant,
  showLocations = true,
}: ChannelInventoryInfoProps) {
  const [inventoryData, setInventoryData] = useState<InventoryLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Usar Zustand store para locaciones
  const { locations, selectedLocation } = useLocationStore();

  useEffect(() => {
    const fetchInventory = async () => {
      if (!product.id) return;

      setIsLoading(true);
      try {
        const inventory = await getChannelProductInventory(
          product.id,
          variant?.id
        );
        setInventoryData(inventory as unknown as InventoryLocation[]);
      } catch (error) {
        console.error("Error fetching inventory:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [product.id, variant?.id]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  // Combinar datos de inventario con locaciones reales
  const enrichedInventoryData = inventoryData
    .map((invData) => {
      const realLocation = locations.find(
        (loc) => loc.id === invData.location_id
      );
      return {
        ...invData,
        location_name:
          realLocation?.name ||
          invData.location_name ||
          `Ubicación ${invData.location_id}`,
        location: realLocation,
      };
    })
    .sort((a, b) => {
      // Ordenar por stock disponible
      return b.available_quantity - a.available_quantity;
    });

  // Calcular stock total
  const totalStock = enrichedInventoryData.reduce(
    (sum, loc) => sum + loc.available_quantity,
    0
  );
  const hasStock = totalStock > 0;

  // Ubicación prioritaria (seleccionada > con más stock)
  const priorityLocation = selectedLocation
    ? enrichedInventoryData.find(
        (inv) => inv.location_id === selectedLocation.id
      )
    : enrichedInventoryData.find((inv) => inv.available_quantity > 0);

  return (
    <div className="space-y-3">
      {/* Stock total */}
      <div className="flex items-center gap-2">
        <div
          className={clx("h-3 w-3 rounded-full", {
            "bg-green-500": hasStock,
            "bg-red-500": !hasStock,
          })}
        />
        <span
          className={clx("font-medium", {
            "text-green-700": hasStock,
            "text-red-700": !hasStock,
          })}
        >
          {hasStock ? `${totalStock} unidades disponibles` : "Sin stock"}
        </span>
      </div>

      {/* Ubicación prioritaria */}
      {priorityLocation && priorityLocation.available_quantity > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="mb-1 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-800 text-sm">
              {selectedLocation ? "Ubicación seleccionada" : "Mayor stock"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {priorityLocation.location_name}
              </p>
            </div>
            <span className="font-bold text-green-600 text-lg">
              {priorityLocation.available_quantity} disponibles
            </span>
          </div>
        </div>
      )}

      {/* Información por todas las locaciones */}
      {showLocations && enrichedInventoryData.length > 1 && (
        <div className="border-t pt-3">
          <h3 className="mb-2 font-medium text-sm text-ui-fg-base">
            Disponibilidad en otras ubicaciones:
          </h3>
          <div className="space-y-2">
            {enrichedInventoryData
              .filter(
                (location) =>
                  location.location_id !== priorityLocation?.location_id
              )
              .map((location) => (
                <div
                  className="flex items-center justify-between text-sm"
                  key={location.location_id}
                >
                  <div>
                    <span className="text-ui-fg-subtle">
                      {location.location_name}
                    </span>
                  </div>
                  <span
                    className={clx("font-medium", {
                      "text-green-600": location.available_quantity > 0,
                      "text-red-600": location.available_quantity === 0,
                    })}
                  >
                    {location.available_quantity} disponibles
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Información adicional de reservas */}
      {enrichedInventoryData.some((loc) => loc.reserved_quantity > 0) && (
        <div className="text-ui-fg-muted text-xs">
          * Algunas unidades están reservadas para otros pedidos
        </div>
      )}
    </div>
  );
}