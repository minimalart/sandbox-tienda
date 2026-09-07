"use client";

import { useScrollLock } from "@lib/hooks/use-scroll-lock";
import { buildShoppingListHref, parseShoppingList } from "@lib/util/shopping-list";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ShoppingListEditor from "@modules/shopping-list/components/shopping-list-editor";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

type ShoppingListModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Lee la lista que se está viendo desde `?items=` de la URL actual. La página
 * `/lista-de-compras` mantiene ese parámetro sincronizado con lo buscado, así
 * que el modal del header arranca con lo mismo que muestra la página (igual que
 * "Editar lista") en vez de aparecer vacío y hacer perder la selección.
 *
 * Se lee de `window.location` y no de `useSearchParams()` a propósito: la
 * página actualiza la query con `history.replaceState` (para no re-navegar), y
 * `window.location` es la fuente que siempre refleja ese cambio.
 */
const readTermsFromUrl = (): string[] => {
  if (typeof window === "undefined") return [];
  const items = new URLSearchParams(window.location.search).get("items") ?? "";
  return parseShoppingList(items);
};

export default function ShoppingListModal({
  open,
  onClose,
}: ShoppingListModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useScrollLock(open);

  if (!open || !mounted) {
    return null;
  }

  // El contenido se monta recién al abrir, así el estado inicial toma la lista
  // vigente en cada apertura (sin efectos ni un flash con la lista vacía).
  return createPortal(
    <ShoppingListModalContent onClose={onClose} />,
    document.body,
  );
}

function ShoppingListModalContent({ onClose }: { onClose: () => void }) {
  const [initialTerms] = useState<string[]>(readTermsFromUrl);
  const [terms, setTerms] = useState<string[]>(initialTerms);
  const [draft, setDraft] = useState("");
  const [visualViewport, setVisualViewport] = useState({
    height: 0,
    offsetTop: 0,
  });

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      setVisualViewport({
        height: viewport?.height ?? window.innerHeight,
        offsetTop: viewport?.offsetTop ?? 0,
      });
    };

    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);

    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const nextTerms = draft.trim() ? [...terms, draft] : terms;
  const searchHref = buildShoppingListHref(nextTerms);
  const canSearch = terms.length > 0 || Boolean(draft.trim());
  // Cuando ya había lista, el modal es una edición de lo que se está viendo.
  const isEditing = initialTerms.length > 0;

  return (
    <div
      aria-modal="true"
      className="fixed left-0 right-0 top-0 z-[10020] flex items-stretch justify-center bg-black/70 sm:items-start sm:px-4 sm:pt-[9vh]"
      data-testid="shopping-list-modal"
      role="dialog"
      style={{
        height: visualViewport.height ? `${visualViewport.height}px` : "100dvh",
        transform: visualViewport.offsetTop
          ? `translateY(${visualViewport.offsetTop}px)`
          : undefined,
      }}
    >
      <button
        aria-label="Cerrar lista de compras"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      {/* Mobile usa 100dvh (no h-full): cuando el teclado abre, el dynamic
          viewport se achica y el modal lo sigue, dejando el footer con los
          botones siempre visible por encima del teclado. */}
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[82vh] sm:max-w-[520px] sm:rounded-xl sm:shadow-2xl">
        <div
          className="flex items-start justify-between gap-4 border-gray-200 border-b bg-white px-6 py-5 text-gray-900"
          style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
        >
          <div>
            <h2 className="font-bold text-xl leading-tight sm:text-2xl">
              {isEditing
                ? "Editá tu lista de compras"
                : "Armá tu lista de compras"}
            </h2>
          </div>
          <button
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <ShoppingListEditor
            autoFocus
            draft={draft}
            onDraftChange={setDraft}
            onTermsChange={setTerms}
            terms={terms}
          />
        </div>

        <div
          className="flex items-center justify-between gap-3 border-gray-200 border-t px-6 py-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <button
            className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-gray-400 text-sm transition hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={terms.length === 0 && !draft.trim()}
            onClick={() => {
              setTerms([]);
              setDraft("");
            }}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Borrar todo
          </button>
          <LocalizedClientLink
            aria-disabled={!canSearch}
            className={`rounded-lg px-7 py-3 font-semibold text-sm text-white transition ${
              canSearch
                ? "bg-[--primary-color] hover:opacity-90"
                : "pointer-events-none bg-[--primary-color] opacity-50"
            }`}
            data-testid="shopping-list-submit"
            href={searchHref}
            onClick={onClose}
          >
            {isEditing ? "Ver resultados" : "Buscar productos"}
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  );
}
