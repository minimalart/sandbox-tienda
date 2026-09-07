"use client";

import {
  MagnifyingGlassIcon,
  MicrophoneIcon,
} from "@heroicons/react/24/outline";
import { FunnelIcon } from "@heroicons/react/20/solid";
import SortProducts, {
  type SortOptions,
} from "@modules/store/components/refinement-list/sort-products";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const IGNORED_VOICE_COMMAND_WORDS = [
  "buscar",
  "busca",
  "buscá",
  "agregar",
  "agrega",
  "agregá",
];

const cleanVoiceQuery = (raw: string) => {
  if (!raw) {
    return "";
  }

  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);

  while (tokens.length && IGNORED_VOICE_COMMAND_WORDS.includes(tokens[0])) {
    tokens.shift();
  }

  return tokens.join(" ").trim();
};

const SearchSortBar = ({
  sortBy,
  initialQuery = "",
  onOpenFilters,
}: {
  sortBy: SortOptions;
  initialQuery?: string;
  onOpenFilters?: () => void;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousSearchTermRef = useRef(initialQuery);
  const isUserTypingRef = useRef(false);

  // Sync local input state when the URL query (initialQuery) changes externally,
  // e.g. when filters clear the search. Cancel any pending debounce.
  useEffect(() => {
    // Si initialQuery cambió externamente (no por el usuario escribiendo)
    if (
      initialQuery !== previousSearchTermRef.current &&
      !isUserTypingRef.current
    ) {
      // Cancelar cualquier debounce pendiente
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      // Sincronizar el estado local y el ref
      setSearchTerm(initialQuery);
      previousSearchTermRef.current = initialQuery;
    }
  }, [initialQuery]);

  // Función para actualizar query params usando el valor actual de searchParams
  // para evitar race conditions con valores stale
  const updateQueryParams = useCallback(
    (updates: Record<string, string | null>) => {
      // Leer searchParams de forma funcional para evitar valores stale
      const currentParams = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value && value.length > 0) {
          currentParams.set(key, value);
        } else {
          currentParams.delete(key);
        }
      });

      // If we change the search query, reset all filters and pagination
      if (Object.hasOwn(updates, "q")) {
        currentParams.delete("category");
        currentParams.delete("collection");
        currentParams.delete("brand");
        currentParams.delete("tag");
        currentParams.delete("promotion");
        currentParams.delete("fragancia");
        currentParams.delete("sugerenciaUso");
        currentParams.delete("familiaOlfativa");
        currentParams.delete("page");
      }

      router.push(`${pathname}?${currentParams.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const handleSortChange = (name: string, value: SortOptions) => {
    updateQueryParams({ [name]: value });
  };

  const handleVoiceSearch = () => {
    if (typeof window === "undefined") {
      return;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert("Tu navegador no soporta búsqueda por voz.");
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "es-AR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript as string;
      const cleaned = cleanVoiceQuery(transcript);
      // Cancelar cualquier debounce pendiente antes de actualizar
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      setSearchTerm(cleaned);
      previousSearchTermRef.current = cleaned;
      isUserTypingRef.current = false;
      updateQueryParams({ q: cleaned });
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    },
    [],
  );

  // Debounce search - solo cuando el usuario escribe
  useEffect(() => {
    // Si el searchTerm no cambió, no hacer nada
    if (searchTerm === previousSearchTermRef.current) {
      return;
    }

    // Marcar que el usuario está escribiendo
    isUserTypingRef.current = true;

    // Cancelar cualquier debounce anterior
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Crear nuevo debounce
    debounceTimeoutRef.current = setTimeout(() => {
      const query = searchTerm.trim();
      previousSearchTermRef.current = query;
      isUserTypingRef.current = false;
      updateQueryParams({ q: query || null });
      debounceTimeoutRef.current = null;
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [searchTerm, updateQueryParams]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm focus-within:border-[#4f46e5] focus-within:ring-2 focus-within:ring-[#4f46e5]/20">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="mr-2 h-5 w-5 text-gray-400"
          />
          <input
            className="flex-1 border-none bg-transparent text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none"
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar productos, fragancias o colecciones..."
            type="text"
            value={searchTerm}
          />
          <button
            aria-label="Buscar por voz"
            className={`ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition ${
              isListening
                ? "bg-[#4f46e5]/10 text-[#4f46e5]"
                : "hover:border-[#4f46e5]"
            }`}
            onClick={handleVoiceSearch}
            type="button"
          >
            <MicrophoneIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex w-full gap-3 lg:w-56 lg:flex-none">
          <div className={onOpenFilters ? "flex-1 lg:w-56" : "w-full lg:w-56"}>
            <SortProducts
              data-testid="store-page-sort"
              hideLabel
              setQueryParams={handleSortChange}
              sortBy={sortBy}
            />
          </div>
          {onOpenFilters && (
            <button
              className="inline-flex w-[30%] items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 text-sm hover:bg-gray-50 lg:hidden"
              onClick={onOpenFilters}
              type="button"
              style={{
                opacity: 1,
                gap: 8,
                paddingTop: 8,
                paddingRight: 12,
                paddingBottom: 8,
                paddingLeft: 12,
              }}
            >
              <span className="text-sm font-medium">Filtros</span>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M7 12h10M10 18h4"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchSortBar;
