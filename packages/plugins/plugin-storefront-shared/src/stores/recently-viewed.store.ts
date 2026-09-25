import { create } from "zustand"

/**
 * Productos vistos recientemente (PRD §6, "Recently Viewed").
 *
 * Funciona igual para anónimos y logueados y NO se persiste en el backend: el PRD lo
 * permite explícitamente y localStorage alcanza.
 *
 * Guarda SÓLO ids, a diferencia de `compare.store.ts` que guarda el snapshot completo
 * del producto. La diferencia es deliberada: comparar es una foto estática, pero un
 * rail de compra tiene que mostrar precio y stock VIVOS. Un precio cacheado de hace
 * tres semanas en un rail que invita a comprar es un bug de merchandising, no un
 * detalle. Los ids se hidratan al renderizar.
 */

const STORAGE_KEY = "mercatto-recently-viewed"
export const MAX_RECENTLY_VIEWED = 20

export type RecentlyViewedEntry = {
  id: string
  handle: string | null
  viewedAt: number
}

type RecentlyViewedState = {
  items: RecentlyViewedEntry[]
  /** Falso hasta que se leyó localStorage. Evita el mismatch de hidratación. */
  isLoaded: boolean
  load: () => void
  record: (entry: { id: string; handle?: string | null }) => void
  clear: () => void
}

const readStoredItems = (): RecentlyViewedEntry[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is RecentlyViewedEntry =>
          Boolean(entry) && typeof entry === "object" && typeof entry.id === "string"
      )
      .slice(0, MAX_RECENTLY_VIEWED)
  } catch {
    // JSON corrupto o storage bloqueado: se arranca de cero en lugar de romper.
    return []
  }
}

const writeStoredItems = (items: RecentlyViewedEntry[]): void => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Modo privado o cuota llena: el rail sigue andando en memoria.
  }
}

export const useRecentlyViewedStore = create<RecentlyViewedState>((set, get) => ({
  items: [],
  isLoaded: false,

  load: () => {
    if (get().isLoaded) return
    set({ items: readStoredItems(), isLoaded: true })
  },

  record: ({ id, handle }) => {
    if (!id) return
    // Se saca el id si ya estaba y se pone al frente: LRU, sin duplicados.
    const items = [
      { id, handle: handle ?? null, viewedAt: Date.now() },
      ...get().items.filter((entry) => entry.id !== id),
    ].slice(0, MAX_RECENTLY_VIEWED)
    set({ items, isLoaded: true })
    writeStoredItems(items)
  },

  clear: () => {
    set({ items: [] })
    writeStoredItems([])
  },
}))
