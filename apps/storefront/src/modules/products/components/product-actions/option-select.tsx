"use client";

import { CheckCircleIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";
import {
  isColorOptionTitle,
  resolveColorSwatch,
} from "@lib/util/variant-labels";
import { ColorDot } from "@modules/common/components/variant-labels";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type React from "react";
import { useState } from "react";

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption;
  current: string | undefined;
  updateOption: (title: string, value: string) => void;
  title: string;
  disabled: boolean;
  /**
   * "tiles" (default): full-width grid of tiles (desktop) + bottom sheet (mobile),
   * used on the product page. "dropdown": a compact native <select>, used in the
   * quick-view next to the price where vertical space is tight. Native <select>
   * avoids being clipped by the modal's scroll container and gives mobile users
   * the OS picker.
   */
  layout?: "tiles" | "dropdown";
  "data-testid"?: string;
};

const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  layout = "tiles",
  "data-testid": dataTestId,
  disabled,
}) => {
  const filteredOptions = (option.values ?? []).map((v) => v.value);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Cuando la option es de color, cada valor lleva su círculo (con textura de
  // vetas en los tonos de madera): se elige por color, no por nombre. Los
  // nombres que no están en el mapa se quedan solo con el texto.
  const isColor = isColorOptionTitle(option.title ?? title);
  const swatchFor = (value: string) =>
    isColor ? resolveColorSwatch(value) : null;

  if (layout === "dropdown") {
    // Un <option> de HTML no puede contener un SVG, así que para los colores el
    // <select> nativo no sirve: se reemplaza por una fila de círculos
    // clickeables. El resto de las options sigue con el select (compacto y con
    // el picker del sistema en mobile).
    if (isColor) {
      return (
        <div className="flex flex-col gap-1.5" data-testid={dataTestId}>
          <span className="font-medium text-gray-500 text-xs">
            {title}
            {current ? `: ${current}` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {filteredOptions.map((v) => {
              const swatch = swatchFor(v);
              const isSelected = v === current;
              return (
                <button
                  type="button"
                  key={v}
                  disabled={disabled}
                  onClick={() => updateOption(option.id, v)}
                  aria-label={v}
                  aria-pressed={isSelected}
                  title={v}
                  className={clx(
                    "flex items-center gap-1.5 rounded-full border p-0.5 transition-all",
                    isSelected
                      ? "border-[--primary-color] ring-1 ring-[--primary-color]"
                      : "border-gray-300 hover:border-gray-400",
                    disabled && "cursor-not-allowed opacity-60",
                    swatch ? "" : "px-2 py-1"
                  )}
                >
                  {swatch ? (
                    /* Acá el círculo ES el control, no un adorno al lado del
                       texto: va más grande que en las tiles del PDP. */
                    <ColorDot className="h-8 w-8" swatch={swatch} />
                  ) : (
                    <span className="font-medium text-gray-900 text-xs">
                      {v}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    const selectId = `option-${option.id}`;
    return (
      <div className="flex flex-col gap-1" data-testid={dataTestId}>
        <label
          className="font-medium text-gray-500 text-xs"
          htmlFor={selectId}
        >
          {title}
        </label>
        <div className="relative">
          <select
            className={clx(
              "w-full min-w-[132px] appearance-none rounded-lg border bg-white py-2 pl-3 pr-9 font-semibold text-gray-900 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-[--primary-color]",
              current
                ? "border-[--primary-color]"
                : "border-gray-300 hover:border-gray-400",
              disabled && "cursor-not-allowed bg-gray-100 opacity-60"
            )}
            disabled={disabled}
            id={selectId}
            name={option.id}
            onChange={(e) => updateOption(option.id, e.target.value)}
            value={current ?? ""}
          >
            {!current && (
              <option disabled value="">
                Elegí {title.toLowerCase()}
              </option>
            )}
            {filteredOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-gray-500"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid={dataTestId}>
      <span className="font-semibold text-gray-900 text-sm">
        Seleccioná {title}
      </span>

      {/* Desktop: grilla de opciones a la vista */}
      <div className="hidden grid-cols-1 gap-3 sm:grid sm:grid-cols-2">
        {filteredOptions.map((v) => {
          const isSelected = v === current;
          return (
            <label
              className={clx(
                "relative flex cursor-pointer rounded-lg border bg-white p-4 transition-all",
                isSelected
                  ? "-outline-offset-2 border-[--primary-color] outline outline-2 outline-[--primary-color]"
                  : "border-gray-300 hover:border-gray-400",
                disabled &&
                  "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"
              )}
              key={v}
            >
              <input
                checked={isSelected}
                className="sr-only"
                disabled={disabled}
                name={option.id}
                onChange={() => updateOption(option.id, v)}
                type="radio"
                value={v}
              />
              <div className="flex flex-1 items-center gap-2">
                {swatchFor(v) && (
                  <ColorDot className="h-6 w-6" swatch={swatchFor(v)!} />
                )}
                <span className="block font-medium text-gray-900 text-sm">
                  {v}
                </span>
              </div>
              <CheckCircleIcon
                aria-hidden="true"
                className={clx(
                  "size-5 text-[--primary-color] transition-opacity",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </label>
          );
        })}
      </div>

      {/* Mobile: disparador compacto que abre un drawer desde abajo, para no
          ocupar tanto alto ni quedar tapado por la barra fija de "Agregar". */}
      <div className="sm:hidden">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setSheetOpen(true)}
          className={clx(
            "flex w-full items-center justify-between rounded-lg border bg-white p-4 text-left transition-colors",
            current
              ? "border-[--primary-color]"
              : "border-gray-300 hover:border-gray-400",
            disabled && "cursor-not-allowed border-gray-200 bg-gray-100 opacity-60"
          )}
        >
          <span className="flex items-center gap-2">
            {current && swatchFor(current) && (
              <ColorDot className="h-6 w-6" swatch={swatchFor(current)!} />
            )}
            <span
              className={clx(
                "font-medium text-sm",
                current ? "text-gray-900" : "text-gray-500"
              )}
            >
              {current ?? `Elegí ${title.toLowerCase()}`}
            </span>
          </span>
          <ChevronDownIcon aria-hidden="true" className="size-5 text-gray-400" />
        </button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>Seleccioná {title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-2">
              {filteredOptions.map((v) => {
                const isSelected = v === current;
                return (
                  <button
                    type="button"
                    key={v}
                    onClick={() => {
                      updateOption(option.id, v);
                      setSheetOpen(false);
                    }}
                    className={clx(
                      "flex items-center justify-between rounded-lg border p-4 text-left transition-all",
                      isSelected
                        ? "-outline-offset-2 border-[--primary-color] outline outline-2 outline-[--primary-color]"
                        : "border-gray-300 hover:border-gray-400"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {swatchFor(v) && (
                        <ColorDot className="h-6 w-6" swatch={swatchFor(v)!} />
                      )}
                      <span className="font-medium text-gray-900 text-sm">
                        {v}
                      </span>
                    </span>
                    <CheckCircleIcon
                      aria-hidden="true"
                      className={clx(
                        "size-5 text-[--primary-color] transition-opacity",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default OptionSelect;
