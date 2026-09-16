import type { StoreLocatorCategory } from "@lib/types/store-locator";

/**
 * Los tipos de sucursal de la tienda, y cómo se pintan.
 *
 * Espejo de `apps/backend/src/lib/branch-types.ts`. Está duplicado por la misma
 * razón que el resto de los contratos entre el backend y el storefront: son dos
 * apps distintas y no comparten paquete. Lo que NO está allá son las clases de
 * Tailwind — el backend no compila Tailwind, y tenerlas en un solo lado evita
 * que se desincronicen.
 *
 * El nombre del archivo es `branch-types` y no `branch-type-style` porque
 * también resuelve la lista; ojo que `@lib/data/branch-types` es otra cosa (la
 * resolución de la sucursal que cubre una dirección).
 */

/** Los tres de siempre, para las tiendas que nunca configuraron la lista. */
export const LEGACY_BRANCH_TYPES: StoreLocatorCategory[] = [
  { id: "point_of_sale", label: "Punto de venta", pickup: true, color: "primary" },
  { id: "wholesale", label: "Mayorista", pickup: true, color: "blue" },
  { id: "distribution_center", label: "Centro de distribución", pickup: false, color: "slate" },
];

/**
 * Estilo de cada color de la paleta.
 *
 * Las clases están ESCRITAS ENTERAS a propósito: Tailwind escanea el código
 * fuente y no ve una clase que se arma concatenando en runtime, así que
 * `text-${color}-700` se lo comería el purge y los badges saldrían sin color.
 * `primary` usa la variable de la tienda, que es lo que hoy pinta "Punto de
 * venta".
 */
export const BRANCH_TYPE_STYLES = {
  primary: {
    text: "text-[--primary-color]",
    border: "border-[--primary-color]",
    bg: "bg-[--primary-soft-bg]",
    pin: null,
  },
  green: { text: "text-emerald-700", border: "border-emerald-500", bg: "bg-emerald-50", pin: "#059669" },
  blue: { text: "text-blue-700", border: "border-blue-500", bg: "bg-blue-50", pin: "#2563EB" },
  slate: { text: "text-slate-700", border: "border-slate-500", bg: "bg-slate-100", pin: "#475569" },
  purple: { text: "text-violet-700", border: "border-violet-500", bg: "bg-violet-50", pin: "#7C3AED" },
  amber: { text: "text-amber-700", border: "border-amber-500", bg: "bg-amber-50", pin: "#D97706" },
  red: { text: "text-red-700", border: "border-red-500", bg: "bg-red-50", pin: "#DC2626" },
  teal: { text: "text-teal-700", border: "border-teal-500", bg: "bg-teal-50", pin: "#0D9488" },
} as const;

export type BranchTypeStyle = (typeof BRANCH_TYPE_STYLES)[keyof typeof BRANCH_TYPE_STYLES];

/** Mismo orden que el backend: es el fallback por posición de los tipos sin color. */
const COLOR_ORDER = [
  "primary",
  "blue",
  "slate",
  "purple",
  "amber",
  "teal",
  "red",
  "green",
] as const;

/**
 * Los tipos efectivos de la tienda. `[]` es una elección deliberada ("no
 * clasifica sus sucursales"); ausente es "todavía no se configuró".
 */
export function resolveBranchTypes(sucursales?: {
  types?: StoreLocatorCategory[];
  categories?: { type: string; label: string }[];
}): StoreLocatorCategory[] {
  if (sucursales?.types) return sucursales.types;
  if (sucursales?.categories) {
    return sucursales.categories.map((category) => {
      const legacy = LEGACY_BRANCH_TYPES.find((type) => type.id === category.type);
      return {
        id: category.type,
        label: category.label,
        pickup: legacy?.pickup ?? true,
        ...(legacy?.color ? { color: legacy.color } : {}),
      };
    });
  }
  return LEGACY_BRANCH_TYPES;
}

/**
 * El estilo de un tipo de sucursal por su id.
 *
 * Nunca devuelve `undefined`: antes, `TYPE_CONFIG[store.type]` era un lookup
 * pelado y un tipo desconocido rompía la card al leer `.label`. Un id que ya no
 * existe en la lista de la tienda cae en un gris neutro.
 */
export function branchTypeStyle(
  types: StoreLocatorCategory[],
  id: string | null | undefined
): BranchTypeStyle {
  const index = types.findIndex((type) => type.id === id);
  if (index < 0) return BRANCH_TYPE_STYLES.slate;
  const color = types[index]?.color;
  if (color && color in BRANCH_TYPE_STYLES) {
    return BRANCH_TYPE_STYLES[color as keyof typeof BRANCH_TYPE_STYLES];
  }
  return BRANCH_TYPE_STYLES[COLOR_ORDER[index % COLOR_ORDER.length]];
}

/** El nombre configurado del tipo; `null` si la sucursal no tiene o ya no existe. */
export function branchTypeLabel(
  types: StoreLocatorCategory[],
  id: string | null | undefined
): string | null {
  if (!id) return null;
  return types.find((type) => type.id === id)?.label ?? null;
}
