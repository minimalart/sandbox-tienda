"use client";

import { useTenant } from "@lib/site-config/context";
import ShoppingListEditModal from "@modules/shopping-list/components/shopping-list-edit-modal";
import ShoppingListEditor from "@modules/shopping-list/components/shopping-list-editor";
import ShoppingListTabs from "@modules/shopping-list/components/shopping-list-tabs";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

const DEFAULT_TITLE = "Lista de compras";
const DEFAULT_SUBTITLE =
  "Escribí lo que necesitás y te sugerimos productos por cada ítem.";

type ShoppingListTemplateV2Props = {
  countryCode: string;
  initialTerms?: string[];
};

/**
 * Lista de compras v2 — estilo Mercado Libre.
 *
 * El foco está en los resultados: cuando ya hay términos, el editor se reduce
 * a una barra compacta (los chips de la lista + un botón "Editar lista") y los
 * productos quedan arriba, visibles sin scroll. El editor completo, con sus
 * sugerencias, vive en un modal. Si la lista está vacía mostramos el editor
 * grande, porque no hay resultados todavía sobre los que poner el foco.
 */
export default function ShoppingListTemplateV2({
  countryCode,
  initialTerms = [],
}: ShoppingListTemplateV2Props) {
  const [pendingTerms, setPendingTerms] = useState<string[]>(initialTerms);
  const [searchedTerms, setSearchedTerms] = useState<string[]>(initialTerms);
  const [draft, setDraft] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  // Per-demo copy for the empty-state header; falls back to the defaults.
  const tenant = useTenant();
  const title = tenant.assets.shoppingList?.title || DEFAULT_TITLE;
  const subtitle = tenant.assets.shoppingList?.subtitle || DEFAULT_SUBTITLE;

  const hasSearchedTerms = searchedTerms.length > 0;
  const canSearch = pendingTerms.length > 0 || Boolean(draft.trim());

  // Al navegar a la misma ruta con otro `?items=` (por ejemplo desde el modal
  // del header) Next re-renderiza la página pero React conserva este
  // componente, así que el `useState` inicial no se vuelve a evaluar: hay que
  // adoptar la lista nueva a mano o los resultados quedarían en la anterior.
  // `parseShoppingList` ya descartó las comas de cada término, así que la key
  // serializa la lista sin perder nada y sirve de dependencia estable.
  const initialTermsKey = initialTerms.join(",");
  useEffect(() => {
    const termsFromUrl = initialTermsKey ? initialTermsKey.split(",") : [];
    setPendingTerms(termsFromUrl);
    setSearchedTerms(termsFromUrl);
    setDraft("");
  }, [initialTermsKey]);

  // La lista vive en la URL (`?items=`), no sólo en el estado: así el botón de
  // lista del header la puede precargar (mismo comportamiento que "Editar
  // lista"), y un refresh o compartir el link no la pierde. Va por
  // `history.replaceState` en vez de `router.replace` para no re-navegar ni
  // refetchear el RSC en cada búsqueda; el pathname actual ya trae el prefijo
  // del demo, así que tampoco se pierde el slug.
  useEffect(() => {
    const url = new URL(window.location.href);
    const items = searchedTerms.join(",");

    if (items) {
      url.searchParams.set("items", items);
    } else {
      url.searchParams.delete("items");
    }

    if (url.toString() !== window.location.href) {
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [searchedTerms]);

  const buildTermsWithDraft = () => {
    const normalizedDraft = draft.trim().replace(/\s+/g, " ");
    if (!normalizedDraft) return pendingTerms;

    if (
      pendingTerms.some(
        (term) => term.toLowerCase() === normalizedDraft.toLowerCase(),
      )
    ) {
      return pendingTerms;
    }

    return [...pendingTerms, normalizedDraft].slice(0, 20);
  };

  const applySearch = () => {
    const nextTerms = buildTermsWithDraft();
    if (nextTerms.length === 0) return;

    setPendingTerms(nextTerms);
    setSearchedTerms(nextTerms);
    setDraft("");
    setEditOpen(false);
  };

  const openEditor = () => {
    setPendingTerms(searchedTerms);
    setDraft("");
    setEditOpen(true);
  };

  const closeEditor = () => {
    setPendingTerms(searchedTerms);
    setDraft("");
    setEditOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {hasSearchedTerms ? (
        <CompactBar onEdit={openEditor} />
      ) : (
        <div className="mx-auto mb-8 flex w-full max-w-2xl flex-col gap-4">
          <div className="text-center">
            <h1 className="font-bold text-2xl text-gray-900">{title}</h1>
            <p className="mt-1 text-gray-500 text-sm">{subtitle}</p>
          </div>

          <ShoppingListEditor
            draft={draft}
            minHeightClassName="min-h-[150px]"
            onDraftChange={setDraft}
            onTermsChange={setPendingTerms}
            terms={pendingTerms}
          />
          <div className="flex justify-end">
            <button
              className="rounded-lg bg-[--primary-color] px-7 py-3 font-semibold text-sm text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSearch}
              onClick={applySearch}
              type="button"
            >
              Buscar productos
            </button>
          </div>
        </div>
      )}

      <ShoppingListTabs countryCode={countryCode} terms={searchedTerms} />

      <ShoppingListEditModal
        draft={draft}
        onApply={applySearch}
        onClose={closeEditor}
        onDraftChange={setDraft}
        onTermsChange={setPendingTerms}
        open={editOpen}
        terms={pendingTerms}
      />
    </div>
  );
}

type CompactBarProps = {
  onEdit: () => void;
};

/**
 * Barra compacta con el título de la lista y un botón para editarla. Los ítems
 * se gestionan desde el modal de edición; las pestañas de abajo ya muestran las
 * categorías, así que no repetimos chips eliminables acá.
 */
function CompactBar({ onEdit }: CompactBarProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 sm:gap-4">
      <h1 className="shrink-0 font-bold text-gray-900 text-lg">Tu lista</h1>

      <button
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 text-sm transition hover:border-[--primary-color] hover:text-[--primary-color]"
        onClick={onEdit}
        type="button"
      >
        <Pencil className="h-3.5 w-3.5" />
        Editar lista
      </button>
    </div>
  );
}
