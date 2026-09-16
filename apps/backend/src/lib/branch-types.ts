import { z } from 'zod';

/**
 * Tipos de sucursal — la taxonomía que cada TIENDA define para sus sucursales.
 *
 * Hasta acá los tres tipos (`point_of_sale`, `wholesale`, `distribution_center`)
 * estaban clavados en un `z.enum` del validador, en cuatro tablas de labels y en
 * un orden de sorteo del storefront. Ahora viven en
 * `content_config.sucursales.types` del sitio y `store_location.store_type`
 * guarda uno de esos ids — que es TEXT libre en la base desde siempre, así que
 * el cambio no necesitó migración.
 *
 * Este archivo es CORE, sin dueño: lo comparten la extensión `multistore` (que
 * edita la lista en la ficha de la tienda) y `store-locations` (que la consume
 * en la ficha de la sucursal). Ponerlo dentro de cualquiera de las dos haría que
 * la otra se rompiera cuando esa extensión no está seleccionada.
 */

/**
 * Paleta cerrada. NO es un hex libre a propósito: el storefront pinta la card y
 * el chip con clases de Tailwind (`text-blue-700 border-blue-500 bg-blue-50`) y
 * Tailwind no ve las clases que se arman en runtime — se las come el purge. Cada
 * token es una entrada estática, y las clases viven en el helper del storefront
 * (`lib/util/branch-types.ts`); acá sólo lo que necesita el backend.
 *
 * `badge` es el color del `StatusBadge` del admin, que sólo acepta ese set.
 * `pin` es el color del marcador del mapa; `null` en `primary` significa "usá
 * `--primary-color` de la tienda", que es lo que hoy hace "Punto de venta".
 */
export const BRANCH_TYPE_COLORS = {
  primary: { badge: 'green', pin: null },
  green: { badge: 'green', pin: '#059669' },
  blue: { badge: 'blue', pin: '#2563EB' },
  slate: { badge: 'grey', pin: '#475569' },
  purple: { badge: 'purple', pin: '#7C3AED' },
  amber: { badge: 'orange', pin: '#D97706' },
  red: { badge: 'red', pin: '#DC2626' },
  teal: { badge: 'blue', pin: '#0D9488' },
} as const satisfies Record<string, { badge: string; pin: string | null }>;

export type BranchTypeColor = keyof typeof BRANCH_TYPE_COLORS;

/**
 * Orden en el que se ofrecen los colores y en el que se preasignan a los tipos
 * nuevos (el primero libre), para que dos tipos no nazcan del mismo color. Es
 * también el fallback por índice de los tipos que no traen `color`, y arranca
 * con los tres colores históricos en su orden histórico para que un sitio
 * migrado se siga viendo igual.
 */
export const BRANCH_TYPE_COLOR_ORDER: BranchTypeColor[] = [
  'primary',
  'blue',
  'slate',
  'purple',
  'amber',
  'teal',
  'red',
  'green',
];

export type BranchType = {
  id: string;
  label: string;
  /** Si las sucursales de este tipo se ofrecen como punto de retiro. */
  pickup: boolean;
  color?: BranchTypeColor;
};

/** Máximo de tipos por tienda. Antes eran 3 y era un `.max(3)` del schema. */
export const MAX_BRANCH_TYPES = 20;

/**
 * Los tres de siempre. Se aplican a los sitios que todavía no tienen la clave
 * `types` — NO a los que la tienen vacía, que es una elección deliberada del
 * operador ("esta tienda no clasifica sus sucursales").
 */
export const LEGACY_BRANCH_TYPES: BranchType[] = [
  { id: 'point_of_sale', label: 'Punto de venta', pickup: true, color: 'primary' },
  { id: 'wholesale', label: 'Mayorista', pickup: true, color: 'blue' },
  {
    id: 'distribution_center',
    label: 'Centro de distribución',
    pickup: false,
    color: 'slate',
  },
];

/** Forma mínima de `content_config.sucursales` que necesita el resolver. */
export type BranchTypesSource = {
  types?: BranchType[] | null;
  /** Clave vieja: se sigue LEYENDO, ya no se escribe. */
  categories?: { type: string; label: string }[] | null;
} | null;

/**
 * Los tipos efectivos de un sitio.
 *
 * El orden de los tres estados importa y es la parte que se rompe fácil:
 *
 *  - `types` presente (incluso `[]`) gana siempre. Vacío = sin tipos.
 *  - `categories` presente = sitio que configuró el filtro con la UI vieja: se
 *    convierte, heredando `pickup` y `color` del tipo legacy homónimo.
 *  - nada = sitio que nunca tocó la pantalla: los tres de siempre.
 */
export function resolveBranchTypes(sucursales?: BranchTypesSource): BranchType[] {
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

/** El color efectivo de un tipo: el elegido, o el de la paleta por posición. */
export function branchTypeColor(type: BranchType | undefined, index: number): BranchTypeColor {
  if (type?.color && type.color in BRANCH_TYPE_COLORS) return type.color;
  return BRANCH_TYPE_COLOR_ORDER[index % BRANCH_TYPE_COLOR_ORDER.length]!;
}

export const BRANCH_TYPE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/**
 * Slug a partir del label, único contra `taken`.
 *
 * El id es INMUTABLE una vez creado porque `store_location.store_type` lo
 * referencia y no hay foreign key que lo arrastre: renombrar el label es
 * gratis, cambiar el id dejaría huérfanas a las sucursales.
 */
export function slugifyBranchType(label: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const base =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40)
      .replace(/^[^a-z0-9]+/, '') || 'tipo';
  if (!used.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 36)}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base.slice(0, 30)}_${Date.now().toString(36)}`;
}

/** El primer color de la paleta que ninguno de `types` esté usando. */
export function nextBranchTypeColor(types: readonly BranchType[]): BranchTypeColor {
  const used = new Set(types.map((type) => type.color).filter(Boolean));
  return BRANCH_TYPE_COLOR_ORDER.find((color) => !used.has(color)) ?? BRANCH_TYPE_COLOR_ORDER[0]!;
}

export const branchTypeColorSchema = z.enum(
  Object.keys(BRANCH_TYPE_COLORS) as [BranchTypeColor, ...BranchTypeColor[]]
);

export const branchTypeSchema = z.object({
  id: z.string().trim().regex(BRANCH_TYPE_ID_RE),
  label: z.string().trim().min(1).max(80),
  pickup: z.boolean(),
  color: branchTypeColorSchema.optional(),
});
