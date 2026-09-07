"use client";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type ComboboxOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type ResponsiveComboboxProps = {
  id?: string;
  name?: string;
  value: string;
  options: ComboboxOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  "data-testid"?: string;
};

export default function ResponsiveCombobox({
  id,
  name,
  value,
  options,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  className,
  triggerClassName,
  disabled,
  required,
  autoComplete,
  "data-testid": dataTestId,
}: ResponsiveComboboxProps) {
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(normalized),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selectOption = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
  };

  const optionList = (
    <>
      <div className="relative border-gray-100 border-b p-3">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-gray-400"
        />
        <input
          autoComplete="off"
          className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color]"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          value={query}
        />
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const active = option.value === value;

            return (
              <button
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-[--primary-color]/10 text-[--primary-color]"
                    : "text-gray-700 hover:bg-gray-50",
                  option.disabled && "cursor-not-allowed opacity-50",
                )}
                disabled={option.disabled}
                key={option.value}
                onClick={() => selectOption(option.value)}
                type="button"
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {active ? (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                ) : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-6 text-center text-gray-500 text-sm">
            {emptyMessage}
          </p>
        )}
      </div>
    </>
  );

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      {name ? (
        <input
          autoComplete={autoComplete}
          name={name}
          readOnly
          type="hidden"
          value={value}
        />
      ) : null}
      <button
        aria-controls={open ? `${id}-listbox` : undefined}
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 text-left text-sm text-gray-900 outline-none transition-colors focus:border-[--primary-color] focus:ring-1 focus:ring-[--primary-color] disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-gray-400",
          triggerClassName,
        )}
        data-testid={dataTestId}
        disabled={disabled}
        id={id}
        onClick={() => setOpen((current) => !current)}
        role="combobox"
        type="button"
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {required && !value ? (
        <input
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-px w-px opacity-0"
          required
          readOnly
          tabIndex={-1}
          value=""
        />
      ) : null}

      {open && isMobile ? (
        <div className="fixed inset-0 z-[99999] md:hidden">
          <button
            aria-label="Cerrar opciones"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl"
            id={`${id}-listbox`}
          >
            <div className="flex items-center justify-between border-gray-100 border-b px-5 py-4">
              <p className="font-semibold text-gray-900 text-base">
                {placeholder}
              </p>
              <button
                className="rounded-full px-3 py-1.5 text-gray-500 text-sm hover:bg-gray-100"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cerrar
              </button>
            </div>
            {optionList}
          </div>
        </div>
      ) : null}

      {open && !isMobile ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
          id={`${id}-listbox`}
        >
          {optionList}
        </div>
      ) : null}
    </div>
  );
}
