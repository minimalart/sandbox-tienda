"use client";

import { useTenant } from "@lib/site-config/context";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const SHOPPING_LIST_QUICK_TERMS = [
  "Chocolates",
  "Cereales",
  "Galletitas",
  "Chocolinas",
  "Snacks",
  "Bombones",
  "Mermeladas",
  "Helados",
];

type ShoppingListEditorProps = {
  terms: string[];
  onTermsChange: (terms: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
  autoFocus?: boolean;
  minHeightClassName?: string;
  showQuickLabel?: boolean;
};

export default function ShoppingListEditor({
  terms,
  onTermsChange,
  draft,
  onDraftChange,
  autoFocus = false,
  minHeightClassName = "min-h-[120px]",
  showQuickLabel = true,
}: ShoppingListEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  // Palabras rápidas configurables por demo; fallback a las default.
  const tenant = useTenant();
  const quickTerms = tenant.assets.shoppingList?.quickTerms?.length
    ? tenant.assets.shoppingList.quickTerms
    : SHOPPING_LIST_QUICK_TERMS;

  useEffect(() => {
    if (!autoFocus) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, [autoFocus]);

  const addTerm = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) return;

    if (!terms.some((term) => term.toLowerCase() === normalized.toLowerCase())) {
      onTermsChange([...terms, normalized].slice(0, 20));
    }
    onDraftChange("");
  };

  const removeTerm = (termToRemove: string) => {
    onTermsChange(terms.filter((term) => term !== termToRemove));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      addTerm(draft);
      return;
    }

    if (event.key === "Backspace" && !draft && terms.length > 0) {
      removeTerm(terms[terms.length - 1]);
    }
  };

  return (
    <>
      <div
        className={`${minHeightClassName} cursor-text rounded-lg border bg-white p-3 transition ${
          focused
            ? "border-[--primary-color] shadow-[0_0_0_3px_rgba(46,125,50,0.12)]"
          : "border-gray-200 shadow-sm"
        }`}
        data-testid="shopping-list-editor"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-700 text-sm"
              key={term}
            >
              {term}
              <button
                aria-label={`Quitar ${term}`}
                className="rounded-full text-gray-400 transition hover:text-gray-700"
                onClick={(event) => {
                  event.stopPropagation();
                  removeTerm(term);
                }}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <input
          aria-label="Agregar producto a la lista"
          className="mt-5 w-full border-0 bg-transparent text-gray-900 outline-none placeholder:text-gray-400"
          data-testid="shopping-list-input"
          onBlur={() => setFocused(false)}
          onChange={(event) => onDraftChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un producto y presioná Enter"
          ref={inputRef}
          value={draft}
        />
      </div>

      {showQuickLabel ? (
        <div className="mt-5 flex items-center gap-2 text-gray-500 text-sm">
          <Sparkles className="h-4 w-4 text-[--primary-color]" />
          Agregá rápido
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {quickTerms.map((term) => {
          const selected = terms.some(
            (current) => current.toLowerCase() === term.toLowerCase(),
          );

          return (
            <button
              className={`rounded-full border px-4 py-2 text-sm transition ${
                selected
                  ? "cursor-default border-gray-200 bg-gray-50 text-gray-400"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[--primary-color] hover:text-[--primary-color]"
              }`}
              disabled={selected}
              key={term}
              onClick={() => addTerm(term)}
              type="button"
            >
              {term}
            </button>
          );
        })}
      </div>
    </>
  );
}
