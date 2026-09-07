"use client";

import { useScrollLock } from "@lib/hooks/use-scroll-lock";
import ShoppingListEditor from "@modules/shopping-list/components/shopping-list-editor";
import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ShoppingListEditModalProps = {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  terms: string[];
  onTermsChange: (terms: string[]) => void;
  draft: string;
  onDraftChange: (draft: string) => void;
};

/**
 * Modal de edición de la lista para la v2. A diferencia de
 * `shopping-list-modal`, no navega: edita el estado en vivo (controlado) para
 * que los resultados detrás se actualicen al instante. El peso visual del
 * editor vive acá adentro, dejando la página con el foco en los resultados.
 */
export default function ShoppingListEditModal({
  open,
  onClose,
  onApply,
  terms,
  onTermsChange,
  draft,
  onDraftChange,
}: ShoppingListEditModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visualViewport, setVisualViewport] = useState({
    height: 0,
    offsetTop: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      aria-modal="true"
      className="fixed top-0 right-0 left-0 z-[10020] flex items-stretch justify-center bg-black/70 sm:items-start sm:px-4 sm:pt-[9vh]"
      role="dialog"
      style={{
        height: visualViewport.height ? `${visualViewport.height}px` : "100dvh",
        transform: visualViewport.offsetTop
          ? `translateY(${visualViewport.offsetTop}px)`
          : undefined,
      }}
    >
      <button
        aria-label="Cerrar edición de lista"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[82vh] sm:max-w-[520px] sm:rounded-xl sm:shadow-2xl">
        <div
          className="flex items-start justify-between gap-4 border-gray-200 border-b bg-white px-6 py-5 text-gray-900"
          style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
        >
          <h2 className="font-bold text-xl leading-tight sm:text-2xl">
            Editá tu lista de compras
          </h2>
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
            onDraftChange={onDraftChange}
            onTermsChange={onTermsChange}
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
              onTermsChange([]);
              onDraftChange("");
            }}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Borrar todo
          </button>
          <button
            className="rounded-lg bg-[--primary-color] px-7 py-3 font-semibold text-sm text-white transition hover:opacity-90"
            onClick={onApply}
            type="button"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
