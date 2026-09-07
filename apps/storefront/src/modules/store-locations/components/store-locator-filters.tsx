"use client";

import CheckboxInput from "@modules/common/components/checkbox-input";
import { useEffect, useRef } from "react";
import type {
  StoreLocatorRegion,
  StoreLocatorType,
} from "@lib/types/store-locator";

type StoreLocatorFiltersProps = {
  selectedTypes: StoreLocatorType[];
  selectedRegions: StoreLocatorRegion[];
  onToggleType: (type: StoreLocatorType) => void;
  onToggleRegion: (region: StoreLocatorRegion) => void;
  isArgentinaChecked: boolean;
  isArgentinaIndeterminate: boolean;
  showOpenOnly: boolean;
  onToggleOpenOnly: () => void;
  idPrefix?: string;
  /** Bloque "Ubicación" (regiones). Configurable por demo. */
  showLocation?: boolean;
  /** Bloque "Categoría" (tipo de sucursal). Configurable por demo. */
  showCategory?: boolean;
};

const REGION_OPTIONS: { id: StoreLocatorRegion; label: string }[] = [
  { id: "caba", label: "CABA" },
  { id: "buenos-aires", label: "Buenos Aires" },
  { id: "norte", label: "Norte" },
  { id: "centro", label: "Centro" },
  { id: "sur", label: "Sur" },
  { id: "uruguay", label: "Uruguay" },
];

const TYPE_OPTIONS: { type: StoreLocatorType; label: string }[] = [
  { type: "point_of_sale", label: "Punto de venta" },
  { type: "wholesale", label: "Mayorista" },
  { type: "distribution_center", label: "Centro de distribucion" },
];

export default function StoreLocatorFilters({
  selectedTypes,
  selectedRegions,
  onToggleType,
  onToggleRegion,
  isArgentinaChecked,
  isArgentinaIndeterminate,
  showOpenOnly,
  onToggleOpenOnly,
  idPrefix = "",
  showLocation = true,
  showCategory = true,
}: StoreLocatorFiltersProps) {
  const argCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (argCheckboxRef.current) {
      argCheckboxRef.current.indeterminate = isArgentinaIndeterminate;
    }
  }, [isArgentinaIndeterminate]);

  // El toggle "Abierto" vive en el encabezado del primer bloque visible, para
  // que no desaparezca cuando el demo apaga los filtros de ubicacion.
  const openToggle = (
    <button
      aria-pressed={showOpenOnly}
      className="flex items-center gap-2"
      onClick={onToggleOpenOnly}
      type="button"
    >
      <span
        className={`font-medium text-sm transition-colors ${
          showOpenOnly ? "text-[--primary-color]" : "text-gray-400"
        }`}
      >
        Abierto
      </span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          showOpenOnly ? "bg-[--primary-color]" : "bg-gray-300"
        }`}
      >
        <span
          className={`mt-0.5 inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            showOpenOnly ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );

  if (!(showLocation || showCategory)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {showLocation && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-base text-gray-900">Ubicación</h2>
            {openToggle}
          </div>

          <div className="space-y-2">
            <label
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2.5 text-sm transition-colors ${
                isArgentinaChecked
                  ? "border-[--primary-color] bg-[--primary-color]/10 text-[--primary-color]"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              htmlFor={`${idPrefix}loc-argentina`}
            >
              <CheckboxInput
                checked={isArgentinaChecked}
                id={`${idPrefix}loc-argentina`}
                onChange={() => onToggleRegion("argentina")}
                ref={argCheckboxRef}
              />
              <span>Argentina</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {REGION_OPTIONS.map((option) => {
                const checked = selectedRegions.includes(option.id);

                return (
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2.5 text-sm transition-colors ${
                      checked
                        ? "border-[--primary-color] bg-[--primary-color]/10 text-[--primary-color]"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    htmlFor={`${idPrefix}loc-${option.id}`}
                    key={option.id}
                  >
                    <CheckboxInput
                      checked={checked}
                      id={`${idPrefix}loc-${option.id}`}
                      onChange={() => onToggleRegion(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showCategory && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-base text-gray-900">Categoría</h2>
            {!showLocation && openToggle}
          </div>
          <div className="space-y-2">
            {TYPE_OPTIONS.map((option) => {
              const checked = selectedTypes.includes(option.type);

              return (
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2.5 text-sm transition-colors ${
                    checked
                      ? "border-[--primary-color] bg-[--primary-color]/10 text-[--primary-color]"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                  htmlFor={`${idPrefix}type-${option.type}`}
                  key={option.type}
                >
                  <CheckboxInput
                    checked={checked}
                    id={`${idPrefix}type-${option.type}`}
                    onChange={() => onToggleType(option.type)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
