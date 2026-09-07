"use client";

import ShoppingListEditor from "@modules/shopping-list/components/shopping-list-editor";
import TermCarousel from "@modules/shopping-list/components/term-carousel";
import { useState } from "react";

type ShoppingListTemplateProps = {
  countryCode: string;
  initialTerms?: string[];
};

export default function ShoppingListTemplate({
  countryCode,
  initialTerms = [],
}: ShoppingListTemplateProps) {
  const [terms, setTerms] = useState<string[]>(initialTerms);
  const [draft, setDraft] = useState("");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="mx-auto mb-8 flex w-full max-w-2xl flex-col gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Lista de compras
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Escribí lo que necesitás y te sugerimos productos por cada ítem.
          </p>
        </div>

        <ShoppingListEditor
          draft={draft}
          minHeightClassName="min-h-[150px]"
          onDraftChange={setDraft}
          onTermsChange={setTerms}
          terms={terms}
        />
      </div>

      <div className="flex flex-col gap-10">
        {terms.map((term) => (
          <TermCarousel countryCode={countryCode} key={term} term={term} />
        ))}
      </div>
    </div>
  );
}
