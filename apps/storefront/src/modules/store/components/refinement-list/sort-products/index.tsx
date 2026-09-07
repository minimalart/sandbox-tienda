"use client";

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Label,
} from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { useTenant } from "@lib/site-config/context";
import { cn } from "@lib/util/cn";
import { useMemo, useState } from "react";

export type SortOptions = "relevance" | "price_asc" | "price_desc" | "created_at";

type SortProductsProps = {
  sortBy: SortOptions;
  setQueryParams: (name: string, value: SortOptions) => void;
  "data-testid"?: string;
  hideLabel?: boolean;
  isSearching?: boolean;
};

type SortOptionItem = {
  value: SortOptions;
  label: string;
};

const sortOptions: SortOptionItem[] = [
  {
    value: "relevance",
    label: "Relevancia",
  },
  {
    value: "created_at",
    label: "Recientes",
  },
  {
    value: "price_asc",
    label: "Precio: Bajo \u2192 Alto",
  },
  {
    value: "price_desc",
    label: "Precio: Alto \u2192 Bajo",
  },
];

const SortProducts = ({
  "data-testid": dataTestId,
  sortBy,
  setQueryParams,
  hideLabel = false,
  isSearching = false,
}: SortProductsProps) => {
  const tenant = useTenant();
  const [query, setQuery] = useState("");
  const isSportsTemplate = tenant.template === "sports";

  const selectedOption = useMemo(
    () =>
      sortOptions.find((option) => option.value === sortBy) ?? sortOptions[0],
    [sortBy],
  );

  const filteredOptions = useMemo(() => {
    if (!query) {
      return sortOptions;
    }
    return sortOptions.filter((option) =>
      option.label.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query]);

  const handleSelect = (option: SortOptionItem | null) => {
    if (!option) return;
    setQuery("");
    setQueryParams("sortBy", option.value);
  };

  return (
    <Combobox
      as="div"
      className="w-full"
      data-testid={dataTestId}
      onChange={handleSelect}
      value={selectedOption}
    >
      <Label
        className={
          hideLabel
            ? "sr-only"
            : "block font-medium text-gray-900 text-sm dark:text-white"
        }
      >
        Ordenar por
      </Label>
      <div className={`relative ${hideLabel ? "mt-0" : "mt-2"}`}>
        <ComboboxButton className="absolute inset-0 w-full cursor-pointer" />
        <ComboboxInput
          className={cn(
            "-outline-offset-1 focus:-outline-offset-2 block w-full bg-white py-2 pr-10 pl-3 text-gray-900 text-sm outline-1 placeholder:text-gray-400 focus:outline-2 focus:outline-[--primary-color] dark:bg-white/5 dark:text-white dark:outline-gray-700 dark:focus:outline-green-600 dark:placeholder:text-gray-500 cursor-pointer pointer-events-none",
            isSportsTemplate
              ? "rounded-none border-2 border-[--sp-ink] outline-none"
              : "rounded-xl outline-gray-300",
          )}
          displayValue={(option: SortOptionItem) => option?.label ?? ""}
          onBlur={() => setQuery("")}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Seleccionar orden"
          readOnly
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDownIcon
            aria-hidden="true"
            className="size-5 text-gray-400"
          />
        </div>

        <ComboboxOptions
          className={cn(
            "dark:-outline-offset-1 absolute z-50 mt-1 max-h-60 w-full overflow-auto bg-white py-1 text-sm shadow-lg outline outline-black/5 data-closed:data-leave:opacity-0 data-leave:transition data-leave:duration-100 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:outline-white/10",
            isSportsTemplate ? "rounded-none" : "rounded-xl",
          )}
          transition
        >
          {filteredOptions.length === 0 && query.length > 0 && (
            <div className="px-3 py-2 text-gray-500 dark:text-gray-400">
              Sin resultados
            </div>
          )}
          {filteredOptions.map((option) => (
            <ComboboxOption
              className="cursor-pointer select-none px-3 py-2 text-gray-900 data-focus:bg-[--primary-color] data-focus:text-white data-focus:outline-hidden dark:text-gray-200 dark:data-focus:bg-green-600"
              key={option.value}
              value={option}
            >
              <span className="block truncate">{option.label}</span>
            </ComboboxOption>
          ))}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
};

export default SortProducts;
