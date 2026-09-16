"use client";

import { CheckCircleIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/react";
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
import { Fragment, useState } from "react";

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption;
  current: string | undefined;
  updateOption: (title: string, value: string) => void;
  title: string;
  disabled: boolean;
  /**
   * "tiles" (default): full-width grid of tiles (desktop) + bottom sheet (mobile),
   * used on the product page. "dropdown": a compact listbox, used in the
   * quick-view next to the price where vertical space is tight. Its panel se
   * ancla por fuera del contenedor con scroll del modal, así que no se recorta.
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

    // El `<select>` nativo pintaba la lista con el widget del sistema (resalte
    // azul del SO, tipografía del SO): dentro del quick view desentonaba con el
    // resto del sitio. El Listbox de Headless UI da el mismo control accesible
    // con nuestros tokens, y al ser del MISMO paquete que el `Dialog` del quick
    // view, su panel portaleado no cuenta como click afuera ni pelea con el
    // focus trap del modal (un popover de Radix acá sí cerraría el modal).
    const labelId = `option-${option.id}-label`;
    return (
      <div className="flex flex-col gap-1" data-testid={dataTestId}>
        <span className="font-medium text-gray-500 text-xs" id={labelId}>
          {title}
        </span>
        <Listbox
          disabled={disabled}
          onChange={(value: string) => updateOption(option.id, value)}
          value={current ?? ""}
        >
          <ListboxButton
            aria-labelledby={labelId}
            className={clx(
              "group flex w-full min-w-[132px] items-center justify-between gap-2 rounded-xl border bg-white py-2.5 pl-3 pr-2.5 text-left font-semibold text-gray-900 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] data-[open]:border-[--primary-color]",
              current
                ? "border-[--primary-color]"
                : "border-gray-300 hover:border-gray-400",
              disabled && "cursor-not-allowed bg-gray-100 opacity-60"
            )}
          >
            <span className={clx("truncate", !current && "text-gray-500")}>
              {current || `Elegí ${title.toLowerCase()}`}
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-gray-500 transition-transform group-data-[open]:rotate-180"
            />
          </ListboxButton>
          {/* z por encima del quick view (`z-[10000]`), que es el lugar más
              alto desde donde se abre este dropdown. */}
          <ListboxOptions
            anchor={{ to: "bottom start", gap: 6 }}
            className="z-[10001] max-h-64 w-[var(--button-width)] min-w-[132px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg focus:outline-none"
            transition
          >
            {filteredOptions.map((v) => (
              <ListboxOption as={Fragment} key={v} value={v}>
                {({ focus, selected }) => (
                  <li
                    className={clx(
                      "flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                      focus && "bg-[--mc-green-soft]",
                      selected
                        ? "font-semibold text-[--primary-color]"
                        : "font-medium text-gray-900"
                    )}
                  >
                    <span className="truncate">{v}</span>
                    <CheckCircleIcon
                      aria-hidden="true"
                      className={clx(
                        "size-4 shrink-0 text-[--primary-color]",
                        selected ? "visible" : "invisible"
                      )}
                    />
                  </li>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Listbox>
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
