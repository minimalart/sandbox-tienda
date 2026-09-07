import { create } from 'zustand';

/**
 * Color elegido para entonar una base, compartido entre el configurador del PDP y
 * `ProductActions`.
 *
 * Existe porque el PDP tenía DOS botones de agregar: el del configurador y el del
 * footer fijo. El del footer agregaba la base pelada, así que se podía comprar una
 * base sin color — que no es un producto vendible. Ahora hay un solo botón (el del
 * footer, que además lleva el color de la marca) y necesita saber qué color se
 * eligió y a qué precio.
 *
 * El precio que se guarda es el UNITARIO cotizado por el ERP para UN envase: la
 * cantidad la maneja el carrito, igual que en cualquier otro producto.
 */
export type TintSelectionColor = {
  code: string;
  name: string;
  collection: string;
  hex: string | null;
};

type TintSelectionState = {
  /** Variante para la que vale esta selección. Cambiar de variante la invalida. */
  variantId: string | null;
  /**
   * ¿Esta variante necesita color para venderse? Lo contesta el backend (que sabe
   * si hay carta cargada y si la feature está prendida), no la metadata del
   * producto: la metadata puede estar sin refrescar o servida de un cache viejo, y
   * de eso depende que el botón de comprar quede bloqueado.
   *
   * `null` = todavía no contestó ⇒ manda la metadata del producto.
   */
  tintable: boolean | null;
  /**
   * ¿El color es OPCIONAL? El artículo también se vende terminado, así que la
   * carta se ofrece pero el botón no se bloquea. Es el blanco de las líneas sin
   * base P (Albalux Balance, Satinol Balance, Texturados): el mismo producto se
   * compra como blanco y hace de base de los colores claros.
   *
   * Lo contesta el backend junto con `tintable`; `null` = todavía no contestó.
   */
  optional: boolean | null;
  color: TintSelectionColor | null;
  /** Precio por envase con el entonado, ya normalizado por el backend. */
  unitPrice: number | null;
  /** Sobreprecio del entonado sobre el precio de catálogo, informativo. */
  surcharge: number | null;
  currencyCode: string | null;
  /** Hay una cotización en vuelo: el botón espera en vez de agregar mal. */
  quoting: boolean;
  /** El ERP rechazó o no contestó. Con esto el botón queda deshabilitado. */
  error: string | null;

  setTintable: (variantId: string, tintable: boolean, optional?: boolean) => void;
  setQuoting: (variantId: string, quoting: boolean) => void;
  setSelection: (input: {
    variantId: string;
    color: TintSelectionColor;
    unitPrice: number;
    surcharge: number | null;
    currencyCode: string | null;
  }) => void;
  setError: (variantId: string, error: string | null) => void;
  clear: () => void;
};

export const useTintSelectionStore = create<TintSelectionState>((set) => ({
  variantId: null,
  tintable: null,
  optional: null,
  color: null,
  unitPrice: null,
  surcharge: null,
  currencyCode: null,
  quoting: false,
  error: null,

  setTintable: (variantId, tintable, optional = false) =>
    set({ variantId, tintable, optional }),
  setQuoting: (variantId, quoting) => set({ variantId, quoting }),
  setSelection: ({ variantId, color, unitPrice, surcharge, currencyCode }) =>
    set({ variantId, color, unitPrice, surcharge, currencyCode, quoting: false, error: null }),
  // Un error INVALIDA el precio: si no, el botón podría agregar con el precio del
  // color anterior.
  setError: (variantId, error) =>
    set({ variantId, error, unitPrice: null, surcharge: null, quoting: false }),
  clear: () =>
    set({
      variantId: null,
      tintable: null,
      optional: null,
      color: null,
      unitPrice: null,
      surcharge: null,
      currencyCode: null,
      quoting: false,
      error: null,
    }),
}));

/**
 * ¿Esta variante es una base entonable? `metadataSaysTintable` es la pista que
 * viaja en el producto (sirve para el primer render, antes de que el backend
 * conteste); en cuanto el backend contesta, gana su respuesta — así un producto
 * con metadata vieja no queda incomprable si la feature se apagó, ni comprable
 * sin color si la metadata todavía no se refrescó.
 *
 * OJO: "es base entonable" ya no implica "hay que elegir color". Para eso está
 * `requiresTintColor`, que además mira si la base se vende terminada.
 */
export const requiresTintSelection = (
  state: Pick<TintSelectionState, 'variantId' | 'tintable'>,
  variantId: string | null | undefined,
  metadataSaysTintable: boolean
): boolean => {
  if (variantId && state.variantId === variantId && typeof state.tintable === 'boolean') {
    return state.tintable;
  }
  return metadataSaysTintable;
};

/**
 * ¿El color es opcional en esta base? Misma precedencia que `tintable`: manda el
 * backend en cuanto contesta, y hasta entonces la metadata del producto
 * (`tint_optional`), que es lo que evita que el blanco arranque con el botón
 * bloqueado durante el primer render.
 */
export const isTintingOptional = (
  state: Pick<TintSelectionState, 'variantId' | 'optional'>,
  variantId: string | null | undefined,
  metadataSaysOptional: boolean
): boolean => {
  if (variantId && state.variantId === variantId && typeof state.optional === 'boolean') {
    return state.optional;
  }
  return metadataSaysOptional;
};

/**
 * ¿Hay que elegir color sí o sí antes de comprar? Una `BASE P` sola no es un
 * producto vendible; el blanco que además hace de base, sí.
 */
export const requiresTintColor = (
  state: Pick<TintSelectionState, 'variantId' | 'tintable' | 'optional'>,
  variantId: string | null | undefined,
  metadataSaysTintable: boolean,
  metadataSaysOptional: boolean
): boolean =>
  requiresTintSelection(state, variantId, metadataSaysTintable) &&
  !isTintingOptional(state, variantId, metadataSaysOptional);

/**
 * ¿El comprador eligió un color para ESTA variante? Es lo que decide por qué
 * ruta va el alta al carrito: con color la escribe el backend con el precio del
 * ERP, sin color es un producto común. Distinto de `isTintSelectionReady`, que
 * además exige que la cotización haya vuelto.
 */
export const hasTintColor = (
  state: Pick<TintSelectionState, 'variantId' | 'color'>,
  variantId: string | null | undefined
): boolean => Boolean(variantId && state.variantId === variantId && state.color);

/**
 * ¿Se puede agregar al carrito? Requiere color elegido, precio del ERP y que la
 * selección sea de ESTA variante. Es el equivalente a "elegí una variante" de
 * cualquier otro producto.
 */
export const isTintSelectionReady = (
  state: Pick<TintSelectionState, 'variantId' | 'color' | 'unitPrice' | 'quoting' | 'error'>,
  variantId: string | null | undefined
): boolean =>
  Boolean(
    variantId &&
      state.variantId === variantId &&
      state.color &&
      typeof state.unitPrice === 'number' &&
      !state.quoting &&
      !state.error
  );
